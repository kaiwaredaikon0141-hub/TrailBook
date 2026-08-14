// Static contract for Original Backup + In-place Edited GPX saving.
import EditedGPXLibraryRefreshCoordinator from "../../src/js/core/EditedGPXLibraryRefreshCoordinator.js";
import GPXEditingSaveService from "../../src/js/services/GPXEditingSaveService.js";
import GPXEditingSaveVerifier from "../../src/js/services/GPXEditingSaveVerifier.js";
import GPXEditingSourceLoader from "../../src/js/services/GPXEditingSourceLoader.js";
import FolderScanner from "../../src/js/services/FolderScanner.js";
import {
    TRAILBOOK_BACKUP_FOLDER_NAME,
    isReservedLibraryFolderName
} from "../../src/js/services/LibraryReservedFolderPolicy.js";
import GPXEditingSaveDialog from "../../src/js/ui/GPXEditingSaveDialog.js";

const output = document.getElementById("result");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

const SOURCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"
 xmlns:x="urn:test"><metadata><name>Source</name></metadata>
 <wpt lat="35" lon="135"><name>W</name></wpt><rte><name>R</name></rte>
 <trk><name>T</name><extensions><x:track>keep</x:track></extensions>
  <trkseg><trkpt lat="35" lon="135"><ele>1</ele><time>2026-08-08T00:00:00Z</time><extensions><x:p>one</x:p></extensions></trkpt>
   <trkpt lat="35.001" lon="135.001"><ele>2</ele><time>2026-08-08T00:01:00Z</time></trkpt>
   <trkpt lat="35.002" lon="135.002"><ele>3</ele><time>2026-08-08T00:02:00Z</time><extensions><x:p>three</x:p></extensions></trkpt>
  </trkseg></trk>
</gpx>
`;

class MemoryFileHandle {

    constructor(name, text = "", { failWrite = false } = {}) {
        this.kind = "file";
        this.name = name;
        this.bytes = encoder.encode(text);
        this.lastModified = 100;
        this.failWrite = failWrite;
        this.createWritableCalls = 0;
    }

    get text() { return decoder.decode(this.bytes); }
    set text(value) { this.bytes = encoder.encode(value); }

    async getFile() {
        return new File([this.bytes], this.name, {
            type: "application/gpx+xml",
            lastModified: this.lastModified
        });
    }

    async createWritable() {
        this.createWritableCalls += 1;
        const handle = this;
        let pending = null;

        return {
            async write(bytes) {
                if (handle.failWrite) throw new Error("write failed");
                pending = new Uint8Array(bytes).slice();
            },
            async close() {
                if (!pending) throw new Error("nothing written");
                handle.bytes = pending;
                handle.lastModified += 1;
            },
            async abort() { pending = null; }
        };
    }
}

class MemoryDirectoryHandle {

    constructor(name, entries = [], permission = "prompt") {
        this.kind = "directory";
        this.name = name;
        this.entries = new Map(entries.map(handle => [handle.name, handle]));
        this.permission = permission;
        this.queryCalls = 0;
        this.requestCalls = 0;
        this.createdFiles = [];
        this.createdDirectories = [];
        this.failBackupWrite = false;
    }

    async queryPermission(options) {
        this.queryCalls += 1;
        assert(options.mode === "readwrite", "permission query was not readwrite");
        return this.permission;
    }

    async requestPermission(options) {
        this.requestCalls += 1;
        assert(options.mode === "readwrite", "permission request was not readwrite");
        return this.permission === "prompt" ? "granted" : this.permission;
    }

    async getFileHandle(name, { create = false } = {}) {
        const existing = this.entries.get(name);

        if (existing?.kind === "file") return existing;
        if (!create) throw new DOMException("missing", "NotFoundError");

        const handle = new MemoryFileHandle(name, "", {
            failWrite: this.failBackupWrite
        });
        this.entries.set(name, handle);
        this.createdFiles.push(name);
        return handle;
    }

    async getDirectoryHandle(name, { create = false } = {}) {
        const existing = this.entries.get(name);

        if (existing?.kind === "directory") return existing;
        if (!create) throw new DOMException("missing", "NotFoundError");

        const handle = new MemoryDirectoryHandle(name, [], this.permission);
        handle.failBackupWrite = this.failBackupWrite;
        this.entries.set(name, handle);
        this.createdDirectories.push(name);
        return handle;
    }

    async *values() { yield* this.entries.values(); }
}

async function expectCode(promise, code) {
    try {
        await promise;
    } catch (error) {
        assert(error.code === code, `expected ${code}, received ${error.code}`);
        return error;
    }
    throw new Error(`expected ${code}`);
}

async function createEditingSource(handle = new MemoryFileHandle("source.gpx", SOURCE_XML)) {
    const source = await new GPXEditingSourceLoader().load(
        handle,
        "rides/source.gpx"
    );
    return { handle, source };
}

async function testFirstAndLaterSave() {
    const { handle: sourceHandle, source } = await createEditingSource();
    const directory = new MemoryDirectoryHandle("rides", [sourceHandle], "prompt");
    const service = new GPXEditingSaveService();
    const originalBytes = source.getSourceBytes();

    assert(!(await service.inspectBackup(directory, sourceHandle.name)).exists,
        "missing Backup was reported as existing");
    assert(directory.requestCalls === 0, "permission was requested before Save");

    const saved = await service.save({
        source,
        retainedPointMasks: [[[true, false, true]]],
        directoryHandle: directory,
        relativePath: "rides/source.gpx"
    });
    const backupDirectory = directory.entries.get(TRAILBOOK_BACKUP_FOLDER_NAME);
    const backupHandle = backupDirectory.entries.get("source.gpx");

    assert(saved.relativePath === "rides/source.gpx" &&
        saved.fileHandle === sourceHandle, "Save changed source identity");
    assert(saved.backupCreated, "first Save did not report Backup creation");
    assert(directory.createdDirectories.length === 1,
        "first Save did not create exactly one Backup folder");
    assert(backupDirectory.createdFiles.length === 1,
        "first Save did not create exactly one Backup file");
    assert(backupHandle.bytes.length === originalBytes.length &&
        backupHandle.bytes.every((value, index) => value === originalBytes[index]),
    "Backup does not preserve original bytes exactly");
    assert(sourceHandle.text.includes("<trkpt") &&
        new DOMParser().parseFromString(sourceHandle.text, "application/xml")
            .querySelectorAll("trkpt").length === 2,
    "source path does not contain the edited GPX");
    assert(!directory.entries.has("source-simplified.gpx"),
        "legacy simplified sibling was created");

    const secondSource = (await createEditingSource(sourceHandle)).source;
    const backupTimestamp = backupHandle.lastModified;
    const second = await service.save({
        source: secondSource,
        retainedPointMasks: [[[true, false]]],
        directoryHandle: directory,
        relativePath: "rides/source.gpx"
    });

    assert(!second.backupCreated, "later Save recreated the Backup");
    assert(backupHandle.createWritableCalls === 1 &&
        backupHandle.lastModified === backupTimestamp,
    "later Save overwrote the first original Backup");
    assert(new DOMParser().parseFromString(sourceHandle.text, "application/xml")
        .querySelectorAll("trkpt").length === 1,
    "later Save did not update only the source GPX");
}

async function testFailureSafety() {
    const masks = [[[true, false, true]]];
    const service = new GPXEditingSaveService();

    {
        const { handle, source } = await createEditingSource();
        const directory = new MemoryDirectoryHandle("rides", [handle], "denied");
        await expectCode(service.save({
            source, retainedPointMasks: masks, directoryHandle: directory,
            relativePath: "rides/source.gpx"
        }), "PERMISSION_DENIED");
        assert(handle.text === SOURCE_XML && directory.entries.size === 1,
            "permission denial changed Library files");
    }

    {
        const { handle, source } = await createEditingSource();
        const directory = new MemoryDirectoryHandle("rides", [handle], "granted");
        directory.failBackupWrite = true;
        await expectCode(service.save({
            source, retainedPointMasks: masks, directoryHandle: directory,
            relativePath: "rides/source.gpx"
        }), "BACKUP_WRITE_FAILED");
        assert(handle.text === SOURCE_XML && handle.createWritableCalls === 0,
            "Backup write failure changed source GPX");
    }

    {
        const { handle, source } = await createEditingSource();
        const invalidBackup = new MemoryFileHandle("source.gpx", "broken");
        const backupDirectory = new MemoryDirectoryHandle(
            TRAILBOOK_BACKUP_FOLDER_NAME,
            [invalidBackup],
            "granted"
        );
        const directory = new MemoryDirectoryHandle(
            "rides",
            [handle, backupDirectory],
            "granted"
        );
        await expectCode(service.save({
            source, retainedPointMasks: masks, directoryHandle: directory,
            relativePath: "rides/source.gpx"
        }), "BACKUP_VERIFICATION_FAILED");
        assert(handle.text === SOURCE_XML && handle.createWritableCalls === 0,
            "invalid existing Backup allowed source modification");
    }

    {
        const { handle, source } = await createEditingSource();
        handle.failWrite = true;
        const directory = new MemoryDirectoryHandle("rides", [handle], "granted");
        const error = await expectCode(service.save({
            source, retainedPointMasks: masks, directoryHandle: directory,
            relativePath: "rides/source.gpx"
        }), "SOURCE_WRITE_FAILED");
        assert(error.backupAvailable &&
            directory.entries.has(TRAILBOOK_BACKUP_FOLDER_NAME),
        "source write failure did not retain the verified Backup");
    }

    {
        const { handle, source } = await createEditingSource();
        const verifier = new GPXEditingSaveVerifier();
        const failingService = new GPXEditingSaveService({
            verifier: {
                verifyBackup: (...args) => verifier.verifyBackup(...args),
                async verify() { throw new Error("invalid edited GPX"); }
            }
        });
        const directory = new MemoryDirectoryHandle("rides", [handle], "granted");
        const error = await expectCode(failingService.save({
            source, retainedPointMasks: masks, directoryHandle: directory,
            relativePath: "rides/source.gpx"
        }), "EDITED_VERIFICATION_FAILED");
        assert(error.backupAvailable, "edited verification failure hid recovery Backup");
    }

    {
        const { handle, source } = await createEditingSource();
        handle.text += " ";
        await expectCode(service.save({
            source, retainedPointMasks: masks,
            directoryHandle: new MemoryDirectoryHandle("rides", [handle], "granted"),
            relativePath: "rides/source.gpx"
        }), "SOURCE_CHANGED");
        assert(handle.createWritableCalls === 0,
            "changed source was written before conflict detection");
    }
}

async function testReservedFolderScan() {
    const normal = new MemoryDirectoryHandle("normal", [
        new MemoryFileHandle("visible.gpx", SOURCE_XML)
    ]);
    const nestedBackup = new MemoryDirectoryHandle(TRAILBOOK_BACKUP_FOLDER_NAME, [
        new MemoryFileHandle("hidden.gpx", SOURCE_XML),
        new MemoryDirectoryHandle("nested", [
            new MemoryFileHandle("also-hidden.gpx", SOURCE_XML)
        ])
    ]);
    const root = new MemoryDirectoryHandle("Library", [normal, nestedBackup]);
    const library = await new FolderScanner().scan(root);

    assert(isReservedLibraryFolderName("TrailBook_Backup") &&
        isReservedLibraryFolderName("trailbook_backup"),
    "Backup reserved-name comparison is not case-insensitive");
    assert(library.folderCount === 2 && library.gpxFileCount === 1,
        "reserved Backup folder affected Library counts");
    assert(library.rootFolder.folders.length === 1 &&
        library.rootFolder.folders[0].name === "normal",
    "reserved Backup folder entered the Library model");
}

async function testInPlaceRefresh() {
    const sourceHandle = new MemoryFileHandle("source.gpx", SOURCE_XML);
    const library = { name: "Library", gpxFileCount: 1 };
    const metadata = new Map([
        ["rides/source.gpx", {
            kind: "file", path: "rides/source.gpx", model: sourceHandle
        }]
    ]);
    const displays = new Map([
        ["rides/source.gpx", {
            path: "rides/source.gpx", fileHandle: sourceHandle,
            checked: true, state: "loaded", error: null, color: "#123456"
        }]
    ]);
    let cacheInvalidations = 0;
    let discoveryRefreshes = 0;
    let reloads = 0;
    const coordinator = new EditedGPXLibraryRefreshCoordinator({
        treeView: {
            nodeMetadata: metadata,
            hasFile: path => metadata.get(path)?.kind === "file",
            refreshAllFileRows() {}, refreshAllFolderRows() {},
            setSelectedPath() {}
        },
        displayState: {
            getDisplay: path => displays.get(path),
            getDisplays: () => displays,
            invalidateCachedResult() { cacheInvalidations += 1; },
            registerFile(path, fileHandle, color) {
                Object.assign(displays.get(path), { fileHandle, color });
            },
            setIdle(path) { displays.get(path).state = "idle"; }
        },
        selectionState: {
            isSelected: path => path === "rides/source.gpx",
            getSelectedPath: () => "rides/source.gpx"
        },
        discoveryCoordinator: {
            async refreshFileEntry({ path }) {
                discoveryRefreshes += 1;
                return path === "rides/source.gpx";
            }
        },
        getLibrary: () => library,
        getColor: () => "#abcdef",
        async reloadVisiblePath({ path, wasChecked, wasSelected }) {
            reloads += 1;
            return path === "rides/source.gpx" && wasChecked && wasSelected;
        }
    });

    const result = await coordinator.refreshVerifiedFile({
        sourcePath: "rides/source.gpx",
        fileHandle: sourceHandle
    });

    assert(result.path === "rides/source.gpx" && result.checked && result.selected,
        "in-place refresh changed path or presentation state");
    assert(library.gpxFileCount === 1,
        "in-place refresh changed Library GPX count");
    assert(cacheInvalidations === 1 && discoveryRefreshes === 1 && reloads === 1,
        "in-place refresh did not target cache, Discovery, and Viewer once");
}

async function testConfirmationDialog() {
    const dialog = new GPXEditingSaveDialog();
    const origin = document.createElement("button");

    document.body.append(origin);
    dialog.attach(document.body);
    const confirmation = dialog.confirm({
        targetPath: "rides/source.gpx",
        backupExists: false,
        metrics: {
            sourcePointCount: 3,
            retainedPointCount: 2,
            distanceDifferenceMeters: -1.5
        },
        origin
    });

    assert(dialog.dialog.open, "Save confirmation did not open");
    assert(dialog.dialog.querySelector("[data-save-backup]").textContent
        .includes(TRAILBOOK_BACKUP_FOLDER_NAME),
    "first Save did not explain the Backup lifecycle");
    assert(document.activeElement === dialog.dialog.querySelector(
        "[data-save-confirm='cancel']"
    ), "Save confirmation did not default focus to Cancel");
    dialog.dialog.querySelector("[data-save-confirm='save']").click();
    assert(await confirmation, "explicit confirmation did not allow Save");
    assert(document.activeElement === origin, "Save confirmation lost focus return");
}

async function run() {
    await testFirstAndLaterSave();
    await testFailureSafety();
    await testReservedFolderScan();
    await testInPlaceRefresh();
    await testConfirmationDialog();
    output.textContent = `PASS: ${assertions} assertions`;
}

run().catch(error => {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
});
