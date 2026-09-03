import EditedGPXLibraryRefreshCoordinator from "../../src/js/core/EditedGPXLibraryRefreshCoordinator.js";
import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import GPXBackupIndexService, {
    BACKUP_INDEX_FILE_NAME
} from "../../src/js/services/GPXBackupIndexService.js";
import GPXEditingSaveService from "../../src/js/services/GPXEditingSaveService.js";
import GPXEditingSourceLoader from "../../src/js/services/GPXEditingSourceLoader.js";
import GPXEditingSerializer from "../../src/js/services/GPXEditingSerializer.js";
import TrackDateCorrectionService from "../../src/js/services/TrackDateCorrectionService.js";
import {
    TRAILBOOK_BACKUP_FOLDER_NAME
} from "../../src/js/services/LibraryReservedFolderPolicy.js";

const output = document.getElementById("result");
const encoder = new TextEncoder();
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function xml(times, trackName = null) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">` +
        `<trk>${trackName === null ? "" : `<name>${trackName}</name>`}<trkseg>${times.map((time, index) =>
            `<trkpt lat="${35 + index / 1000}" lon="135"><time>${time}</time></trkpt>`
        ).join("")}</trkseg></trk></gpx>\n`;
}

class MemoryFileHandle {
    constructor(name, text = "") {
        this.kind = "file";
        this.name = name;
        this.bytes = encoder.encode(text);
        this.lastModified = 100;
    }
    async getFile() {
        return new File([this.bytes], this.name, { lastModified: this.lastModified });
    }
    async createWritable() {
        const handle = this;
        let pending;
        return {
            async write(bytes) { pending = new Uint8Array(bytes).slice(); },
            async close() { handle.bytes = pending; handle.lastModified += 1; },
            async abort() { pending = null; }
        };
    }
}

class MemoryDirectoryHandle {
    constructor(name, entries = []) {
        this.kind = "directory";
        this.name = name;
        this.entries = new Map(entries.map(entry => [entry.name, entry]));
    }
    async queryPermission() { return "granted"; }
    async requestPermission() { return "granted"; }
    async getFileHandle(name, { create = false } = {}) {
        const entry = this.entries.get(name);
        if (entry?.kind === "file") return entry;
        if (!create) throw new DOMException("missing", "NotFoundError");
        const handle = new MemoryFileHandle(name);
        this.entries.set(name, handle);
        return handle;
    }
    async getDirectoryHandle(name, { create = false } = {}) {
        const entry = this.entries.get(name);
        if (entry?.kind === "directory") return entry;
        if (!create) throw new DOMException("missing", "NotFoundError");
        const handle = new MemoryDirectoryHandle(name);
        this.entries.set(name, handle);
        return handle;
    }
    async removeEntry(name) {
        if (!this.entries.delete(name)) throw new DOMException("missing", "NotFoundError");
    }
}

async function sourceFor(name, times) {
    const handle = new MemoryFileHandle(name, xml(times));
    const source = await new GPXEditingSourceLoader().load(handle, `rides/${name}`);
    return { handle, source };
}

async function testNamesAndHistory() {
    const service = new TrackDateCorrectionService();
    const cases = [
        [["2022-05-31T01:00:00Z"], "2022_05_31.gpx"],
        [["2025-09-22T01:00:00Z", "2025-09-23T01:00:00Z"], "2025_09_22-09_23.gpx"],
        [["2015-01-31T01:00:00Z", "2015-02-01T01:00:00Z"], "2015_01_31-02_01.gpx"],
        [["2010-12-29T01:00:00Z", "2011-01-02T01:00:00Z"], "2010_12_29-2011_01_02.gpx"]
    ];

    for (const [times, expected] of cases) {
        const { source } = await sourceFor("source.gpx", times);
        assert(service.createDateFileName(source) === expected, `filename ${expected}`);
    }

    const { source } = await sourceFor("foo.gpx", ["2022-05-31T01:00:00Z"]);
    const session = new GPXEditingSession(source, {
        desiredFileName: "2022_05_31.gpx"
    });
    const offset = service.calculateOffset(source, "2022-06-01");
    const nextName = service.createDateFileName(source, offset);
    session.applyDateOffset(offset, nextName);
    assert(session.getDesiredFileName() === "2022_06_01.gpx",
        "date Apply did not update filename candidate");
    assert(session.undo() && session.getDesiredFileName() === "2022_05_31.gpx",
        "Undo did not restore filename state");
    assert(session.redo() && session.getDesiredFileName() === "2022_06_01.gpx",
        "Redo did not restore filename state");
    session.cancel();
    assert(!session.isActive && session.getDesiredFileName() === "foo.gpx",
        "Cancel did not discard filename draft");
}

async function testCollisionAndIndex() {
    const directory = new MemoryDirectoryHandle("rides", [
        new MemoryFileHandle("2022_05_31.gpx", "x"),
        new MemoryFileHandle("2022_05_31-02.gpx", "x")
    ]);
    const service = new GPXEditingSaveService();
    const resolved = await service.resolveTargetFileName(
        directory,
        "foo.gpx",
        "2022_05_31.gpx"
    );
    assert(resolved === "2022_05_31-03.gpx", "collision suffix was not -03");
    assert(await service.resolveTargetFileName(
        directory,
        "2022_05_31.gpx",
        "2022_05_31.gpx"
    ) === "2022_05_31.gpx", "current file was treated as collision");

    const backup = new MemoryDirectoryHandle(TRAILBOOK_BACKUP_FOLDER_NAME);
    const indexService = new GPXBackupIndexService();
    await indexService.write(backup, { "2022_05_31.gpx": "foo.gpx" });
    const read = await indexService.read(backup);
    const text = new TextDecoder().decode(backup.entries.get(BACKUP_INDEX_FILE_NAME).bytes);
    assert(read.entries["2022_05_31.gpx"] === "foo.gpx",
        "Backup association did not round-trip");
    assert(text.endsWith("\n") && !text.startsWith("\uFEFF") && text.includes("  \"entries\""),
        "Backup index serialization contract failed");
}

async function testRenameLifecycle() {
    const firstHandle = new MemoryFileHandle(
        "foo.gpx",
        xml(["2022-05-31T01:00:00Z"], "Track 20220531")
    );
    const first = {
        handle: firstHandle,
        source: await new GPXEditingSourceLoader().load(
            firstHandle,
            "rides/foo.gpx"
        )
    };
    const original = first.source.getSourceBytes();
    const directory = new MemoryDirectoryHandle("rides", [first.handle]);
    const service = new GPXEditingSaveService();
    const masks = [[[true]]];
    const saved = await service.save({
        source: first.source,
        retainedPointMasks: masks,
        desiredFileName: "2022_05_31.gpx",
        directoryHandle: directory,
        relativePath: "rides/foo.gpx"
    });
    const backupDirectory = directory.entries.get(TRAILBOOK_BACKUP_FOLDER_NAME);
    const backupFile = backupDirectory.entries.get("foo.gpx");

    assert(saved.renamed && saved.relativePath === "rides/2022_05_31.gpx",
        "initial Backup + rename did not return new path");
    assert(!directory.entries.has("foo.gpx") && directory.entries.has("2022_05_31.gpx"),
        "old source was not replaced by new source");
    assert(saved.source.tracks[0].name === "2022_05_31",
        "single Track name did not follow the new filename");
    assert(backupFile.name === "foo.gpx" && backupFile.bytes.every(
        (value, index) => value === original[index]
    ), "original Backup name or bytes changed");
    assert(new TextDecoder().decode(backupFile.bytes).includes("Track 20220531"),
        "Backup Track name was modified");
    let index = await new GPXBackupIndexService().read(backupDirectory);
    assert(index.entries["2022_05_31.gpx"] === "foo.gpx",
        "initial rename association is wrong");

    const secondSource = await new GPXEditingSourceLoader().load(
        saved.fileHandle,
        saved.relativePath
    );
    const backupTimestamp = backupFile.lastModified;
    const renamedAgain = await service.save({
        source: secondSource,
        retainedPointMasks: masks,
        timeOffsetMs: 24 * 60 * 60 * 1000,
        desiredFileName: "2022_06_01.gpx",
        directoryHandle: directory,
        relativePath: saved.relativePath
    });

    index = await new GPXBackupIndexService().read(backupDirectory);
    assert(renamedAgain.relativePath === "rides/2022_06_01.gpx" &&
        index.entries["2022_06_01.gpx"] === "foo.gpx" &&
        !index.entries["2022_05_31.gpx"],
    "re-rename did not preserve original Backup association");
    assert(backupFile.name === "foo.gpx" && backupFile.lastModified === backupTimestamp,
        "re-rename modified original Backup");
}

async function testTrackNameSynchronization() {
    const serializer = new GPXEditingSerializer();
    const named = await sourceFor("named.gpx", ["2026-08-02T00:00:00Z"]);
    const originalNamedXml = xml(["2026-08-02T00:00:00Z"], "Original name");
    const namedHandle = new MemoryFileHandle("named.gpx", originalNamedXml);
    const namedSource = await new GPXEditingSourceLoader().load(
        namedHandle,
        "rides/named.gpx"
    );
    const masks = [[[true]]];
    const unchanged = serializer.serialize(namedSource, masks);
    const renamed = serializer.serialize(namedSource, masks, {
        trackNameFileName: "2026_08_02.gpx"
    });

    assert(unchanged.includes("<name>Original name</name>"),
        "rename OFF changed Track name");
    assert(renamed.includes("<name>2026_08_02</name>"),
        "single Track name did not use filename basename");

    const missingNameOutput = serializer.serialize(named.source, masks, {
        trackNameFileName: "2026_08_02-02.gpx"
    });

    assert(missingNameOutput.includes("<name>2026_08_02-02</name>"),
        "missing Track name was not added with collision suffix");

    const multiXml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">` +
        `<trk><name>First</name><trkseg><trkpt lat="35" lon="135"/></trkseg></trk>` +
        `<trk><name>Second</name><trkseg><trkpt lat="36" lon="136"/></trkseg></trk>` +
        `</gpx>\n`;
    const multiHandle = new MemoryFileHandle("multi.gpx", multiXml);
    const multiSource = await new GPXEditingSourceLoader().load(
        multiHandle,
        "rides/multi.gpx"
    );
    const multiOutput = serializer.serialize(multiSource, [[[true]], [[true]]], {
        trackNameFileName: "2026_08_02.gpx"
    });

    assert(multiOutput.includes("<name>First</name>") &&
        multiOutput.includes("<name>Second</name>"),
    "multiple Track names were changed");

    const collisionSource = await sourceFor(
        "collision.gpx",
        ["2026-08-02T00:00:00Z"]
    );
    const collisionDirectory = new MemoryDirectoryHandle("rides", [
        collisionSource.handle,
        new MemoryFileHandle("2026_08_02.gpx", "occupied")
    ]);
    const collisionSaved = await new GPXEditingSaveService().save({
        source: collisionSource.source,
        retainedPointMasks: masks,
        desiredFileName: "2026_08_02.gpx",
        directoryHandle: collisionDirectory,
        relativePath: "rides/collision.gpx"
    });

    assert(collisionSaved.fileName === "2026_08_02-02.gpx" &&
        collisionSaved.source.tracks[0].name === "2026_08_02-02",
    "collision suffix was not synchronized to Track name");
}

async function testFailureSafetyAndRefresh() {
    const failed = await sourceFor("foo.gpx", ["2022-05-31T01:00:00Z"]);
    const directory = new MemoryDirectoryHandle("rides", [failed.handle]);
    const service = new GPXEditingSaveService({
        backupIndex: {
            async read() { return { exists: false, entries: {} }; },
            async write() { const error = new Error(); error.code = "BACKUP_INDEX_WRITE_FAILED"; throw error; }
        }
    });
    let code = null;
    try {
        await service.save({
            source: failed.source,
            retainedPointMasks: [[[true]]],
            desiredFileName: "2022_05_31.gpx",
            directoryHandle: directory,
            relativePath: "rides/foo.gpx"
        });
    } catch (error) { code = error.code; }
    assert(code === "BACKUP_INDEX_WRITE_FAILED" && directory.entries.has("foo.gpx"),
        "index failure removed old source");

    const verifyFailed = await sourceFor("verify.gpx", ["2022-05-31T01:00:00Z"]);
    const verifyDirectory = new MemoryDirectoryHandle("rides", [verifyFailed.handle]);
    const verifyService = new GPXEditingSaveService({
        verifier: {
            async verifyBackup() { return true; },
            async verify() { throw new Error("verify failed"); }
        }
    });
    code = null;
    try {
        await verifyService.save({
            source: verifyFailed.source,
            retainedPointMasks: [[[true]]],
            desiredFileName: "2022_05_31.gpx",
            directoryHandle: verifyDirectory,
            relativePath: "rides/verify.gpx"
        });
    } catch (error) { code = error.code; }
    assert(code === "EDITED_VERIFICATION_FAILED" &&
        verifyDirectory.entries.has("verify.gpx"),
    "new source verification failure removed old source");

    const legacySource = await sourceFor("legacy.gpx", ["2022-05-31T01:00:00Z"]);
    const legacyBackup = new MemoryFileHandle("legacy.gpx", xml(["2020-01-01T00:00:00Z"]));
    const legacyDirectory = new MemoryDirectoryHandle("rides", [
        legacySource.handle,
        new MemoryDirectoryHandle(TRAILBOOK_BACKUP_FOLDER_NAME, [legacyBackup])
    ]);
    const legacyInspection = await new GPXEditingSaveService().inspectBackup(
        legacyDirectory,
        "legacy.gpx"
    );
    assert(legacyInspection.exists && legacyInspection.backupFileName === "legacy.gpx",
        "v1.5 same-name Backup fallback was not recognized");

    const original = await sourceFor("old.gpx", ["2022-05-31T01:00:00Z"]);
    const replacement = new MemoryFileHandle("new.gpx", xml(["2022-05-31T01:00:00Z"]));
    const folder = { gpxFiles: [original.handle] };
    const metadata = new Map([
        ["rides", { kind: "folder", model: folder }],
        ["rides/old.gpx", {
            kind: "file", parentPath: "rides", name: "old.gpx", model: original.handle
        }]
    ]);
    const displays = new Map([["rides/old.gpx", {
        path: "rides/old.gpx", checked: true, state: "loaded", requestId: 1
    }]]);
    let selected = "rides/old.gpx";
    let reboundSource = null;
    const sourceOrder = [];
    const treeView = {
        nodeMetadata: metadata,
        hasFile: path => metadata.get(path)?.kind === "file",
        async render() {
            metadata.delete("rides/old.gpx");
            metadata.set("rides/new.gpx", {
                kind: "file", parentPath: "rides", name: "new.gpx", model: replacement
            });
        },
        refreshAllFileRows() {}, refreshAllFolderRows() {}, setSelectedPath() {}
    };
    const coordinator = new EditedGPXLibraryRefreshCoordinator({
        treeView,
        displayState: {
            getDisplay: path => displays.get(path), getDisplays: () => displays,
            replaceFilePath(oldPath, newPath, handle) {
                const value = displays.get(oldPath); displays.delete(oldPath);
                displays.set(newPath, { ...value, path: newPath, fileHandle: handle });
                return true;
            }
        },
        selectionState: {
            isSelected: path => selected === path,
            select(path) { selected = path; return { selectedPath: path }; },
            getSelectedPath: () => selected
        },
        discoveryCoordinator: {
            async renameFileEntry() {
                sourceOrder.push("discovery");
                return reboundSource?.targetPath === "rides/new.gpx";
            }
        },
        getLibrary: () => ({ rootFolder: {}, gpxFileCount: 1 }),
        getColor: () => "#000000",
        rebindTrackSource: source => {
            reboundSource = source;
            sourceOrder.push("catalog");
        },
        reloadVisiblePath: async ({ sourcePath, path, wasChecked }) =>
            sourcePath === "rides/old.gpx" && path === "rides/new.gpx" && wasChecked
    });
    const refreshed = await coordinator.refreshVerifiedFile({
        sourcePath: "rides/old.gpx",
        targetPath: "rides/new.gpx",
        fileHandle: replacement
    });
    assert(refreshed.renamed && folder.gpxFiles[0] === replacement,
        "Library refresh did not replace old path with new path");
    assert(selected === "rides/new.gpx" && displays.has("rides/new.gpx") &&
        !displays.has("rides/old.gpx"),
    "visibility or selection did not migrate to new path");
    assert(reboundSource?.sourcePath === "rides/old.gpx" &&
        reboundSource.targetPath === "rides/new.gpx" &&
        reboundSource.fileHandle === replacement,
    "renamed Track actual source was not rebound before Viewer refresh");
    assert(sourceOrder.join(",") === "catalog,discovery",
        "Discovery reloaded the renamed path before Catalog source binding");
}

try {
    await testNamesAndHistory();
    await testCollisionAndIndex();
    await testTrackNameSynchronization();
    await testRenameLifecycle();
    await testFailureSafetyAndRefresh();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL: ${error.stack || error}`;
    throw error;
}
