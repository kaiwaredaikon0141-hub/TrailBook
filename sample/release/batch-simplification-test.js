import BatchSimplificationCoordinator, {
    collectBatchEntries
} from "../../src/js/core/BatchSimplificationCoordinator.js";
import BatchSimplificationService from "../../src/js/services/BatchSimplificationService.js";
import TrackEditingCoordinator from "../../src/js/core/TrackEditingCoordinator.js";
import BatchSimplificationPanel from "../../src/js/ui/BatchSimplificationPanel.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function handle(name, { points = 3, removed = 1, version = 1, fail = null } = {}) {
    return { name, points, removed, version, fail };
}

function sourceFor(fileHandle, path) {
    return Object.freeze({
        fileHandle,
        relativePath: path,
        sourceFileName: fileHandle.name,
        fingerprint: Object.freeze({ size: fileHandle.points, lastModified: fileHandle.version }),
        tracks: Object.freeze([{ segments: Object.freeze([{
            points: Object.freeze(Array.from({ length: fileHandle.points }, (_, index) => ({
                latitude: index,
                longitude: index
            })))
        }]) }])
    });
}

function previewFor(source) {
    const removed = Math.min(source.fileHandle.removed, source.fileHandle.points);
    const retained = source.fileHandle.points - removed;
    const mask = Array.from({ length: source.fileHandle.points }, (_, index) => index < retained);
    return Object.freeze({
        retainedPointMasks: Object.freeze([[Object.freeze(mask)]]),
        metrics: Object.freeze({
            sourcePointCount: source.fileHandle.points,
            retainedPointCount: retained,
            removedPointCount: removed
        })
    });
}

function entry(path, fileHandle, directoryHandle = { name: "folder" }) {
    return { relativePath: path, fileHandle, directoryHandle };
}

function rootPermission(result = "granted") {
    return {
        queryPermission: async () => result,
        requestPermission: async () => result
    };
}

async function run() {
    const realPanel = new BatchSimplificationPanel();

    assert(realPanel.getOptions().toleranceMeters === 10,
        "default tolerance is not 10 meters");
    assert(realPanel.element.querySelectorAll("[data-batch-action]").length === 3,
        "batch panel actions are incomplete");

    const rootHandle = { name: "root" };
    const folderA = { name: "A", handle: { name: "A" } };
    const nested = { name: "nested", handle: { name: "nested" } };
    const folderB = { name: "B", handle: { name: "B" } };
    const backup = { name: "TrailBook_Backup", handle: { name: "backup" } };
    const a = handle("a.gpx");
    const child = handle("child.gpx");
    const b = handle("b.gpx");
    const hiddenBackup = handle("original.gpx");
    const metadata = new Map([
        ["", { kind: "folder", path: "", model: { handle: rootHandle } }],
        ["A", { kind: "folder", path: "A", model: folderA }],
        ["A/nested", { kind: "folder", path: "A/nested", model: nested }],
        ["B", { kind: "folder", path: "B", model: folderB }],
        ["TrailBook_Backup", { kind: "folder", path: "TrailBook_Backup", model: backup }],
        ["A/a.gpx", { kind: "file", path: "A/a.gpx", parentPath: "A", model: a }],
        ["A/nested/child.gpx", { kind: "file", path: "A/nested/child.gpx", parentPath: "A/nested", model: child }],
        ["B/b.gpx", { kind: "file", path: "B/b.gpx", parentPath: "B", model: b }],
        ["TrailBook_Backup/original.gpx", {
            kind: "file", path: "TrailBook_Backup/original.gpx",
            parentPath: "TrailBook_Backup", model: hiddenBackup
        }]
    ]);
    const treeView = {
        focusedPath: "A",
        nodeMetadata: metadata,
        isDescendant: (path, parent) => path.startsWith(`${parent}/`)
    };
    const folderEntries = collectBatchEntries(treeView, "folder");
    const libraryEntries = collectBatchEntries(treeView, "library");

    assert(folderEntries.length === 2, "nested Folder scope is incomplete");
    assert(libraryEntries.length === 3, "Library scope or reserved exclusion failed");
    assert(!libraryEntries.some(item => item.relativePath.includes("TrailBook_Backup")),
        "reserved Backup entered the batch scope");

    const writes = [];
    const refreshes = [];
    const progress = [];
    const sourceLoader = {
        load: async (fileHandle, path) => {
            if (fileHandle.fail === "parse") throw new Error("parse failed");
            return sourceFor(fileHandle, path);
        }
    };
    const simplification = {
        createPreview: async source => previewFor(source)
    };
    const saveService = {
        save: async options => {
            if (options.source.fileHandle.fail === "save") {
                const error = new Error("save failed");
                error.code = "SAVE_FAILED";
                throw error;
            }
            writes.push(options);
            options.source.fileHandle.removed = 0;
            options.source.fileHandle.version += 1;
            return { fileHandle: options.source.fileHandle };
        }
    };
    const service = new BatchSimplificationService({
        sourceLoader,
        simplification,
        saveService,
        yieldControl: async () => {}
    });
    const changed = handle("changed.gpx", { points: 5, removed: 2 });
    const unchanged = handle("unchanged.gpx", { points: 4, removed: 0 });
    const broken = handle("broken.gpx", { fail: "parse" });
    const analysis = await service.analyze([
        entry("A/changed.gpx", changed),
        entry("A/unchanged.gpx", unchanged),
        entry("A/broken.gpx", broken)
    ], 10, { onProgress: value => progress.push(value) });

    assert(writes.length === 0, "analysis wrote to the filesystem");
    assert(analysis.changedCount === 1 && analysis.unchangedCount === 1,
        "analysis change counts are invalid");
    assert(analysis.errorCount === 1 && progress.length === 3,
        "analysis error/progress accounting is invalid");
    assert(analysis.sourcePointCount === 9 && analysis.retainedPointCount === 7,
        "analysis point totals are invalid");

    const result = await service.execute(analysis, {
        rootDirectoryHandle: rootPermission(),
        refreshSavedFile: async saved => { refreshes.push(saved); return true; },
        onProgress: value => progress.push(value)
    });

    assert(writes.length === 1, "unchanged GPX was written");
    assert(writes[0].desiredFileName === "changed.gpx",
        "batch save changed the filename");
    assert(writes[0].timeOffsetMs === undefined && writes[0].translation === undefined,
        "batch save changed date or translation");
    assert(result.successCount === 1 && result.unchangedCount === 1,
        "execution summary is invalid");
    realPanel.showResult(result);
    assert(realPanel.summary.textContent.includes("成功 1") &&
        realPanel.summary.textContent.includes("points"),
    "final summary was not presented");
    assert(refreshes.length === 1 && refreshes[0].sourcePath === "A/changed.gpx",
        "successful GPX did not use targeted refresh");

    const second = await service.analyze([
        entry("A/changed.gpx", changed)
    ], 10);
    await service.execute(second, { rootDirectoryHandle: rootPermission() });
    assert(second.changedCount === 0 && writes.length === 1,
        "same tolerance caused an unnecessary second write");

    const stale = handle("stale.gpx", { points: 5, removed: 2 });
    const after = handle("after.gpx", { points: 5, removed: 2 });
    const staleAnalysis = await service.analyze([
        entry("stale.gpx", stale), entry("after.gpx", after)
    ], 10);
    stale.version += 1;
    const staleResult = await service.execute(staleAnalysis, {
        rootDirectoryHandle: rootPermission()
    });
    assert(staleResult.errorCount === 1 && staleResult.successCount === 1,
        "stale source stopped the batch or was not skipped");
    assert(staleResult.errors[0].code === "STALE_SOURCE",
        "stale source reason was not recorded");

    const deniedAnalysis = await service.analyze([
        entry("denied.gpx", handle("denied.gpx"))
    ], 10);
    let denied = false;
    try {
        await service.execute(deniedAnalysis, {
            rootDirectoryHandle: rootPermission("denied")
        });
    } catch (error) {
        denied = error.code === "PERMISSION_DENIED";
    }
    assert(denied, "Library permission denial did not abort before execution");

    const cancelFirst = handle("first.gpx", { points: 5, removed: 2 });
    const cancelSecond = handle("second.gpx", { points: 5, removed: 2 });
    const cancelAnalysis = await service.analyze([
        entry("first.gpx", cancelFirst), entry("second.gpx", cancelSecond)
    ], 10);
    let cancel = false;
    const cancelResult = await service.execute(cancelAnalysis, {
        rootDirectoryHandle: rootPermission(),
        shouldCancel: () => cancel,
        onProgress: () => { cancel = true; }
    });
    assert(cancelResult.successCount === 1 && cancelResult.skippedCount === 1,
        "cancel did not stop at a file boundary");

    const fakePanel = {
        getOptions: () => ({ scope: "library", toleranceMeters: 10 }),
        setAvailable() {}, setFolderScopeAvailable() {}, showError(message) {
            this.error = message;
        }
    };
    let called = false;
    const coordinator = new BatchSimplificationCoordinator({
        getEntries: () => [entry("x.gpx", handle("x.gpx"))],
        getRootDirectoryHandle: () => rootPermission(),
        getLibraryToken: () => "library",
        isLibraryAvailable: () => true,
        isEditorBusy: () => true,
        refreshSavedFile: async () => true,
        service: { analyze: async () => { called = true; } },
        panel: fakePanel
    });
    assert(await coordinator.analyze() === false && !called,
        "batch started while Track Editor was active");

    const editing = new TrackEditingCoordinator({
        eventBus: {}, selectionState: { getSelectedPath: () => "x.gpx" },
        mapView: {}, getFileEntry: () => ({ fileHandle: {} }),
        isExternalBusy: () => true,
        previewLayers: { setTranslationPreviewHandler() {} },
        interactionGuard: {}, panel: {}, saveDialog: {}
    });
    assert(await editing.start() === false,
        "Track Editor started during a batch operation");

    output.textContent = `PASS: ${assertions} assertions`;
}

run().catch(error => {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
});
