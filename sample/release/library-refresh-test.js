import LibraryRefreshCoordinator from "../../src/js/core/LibraryRefreshCoordinator.js";
import EventBus from "../../src/js/core/EventBus.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import Folder from "../../src/js/models/Folder.js";
import Library from "../../src/js/models/Library.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";
import TreeMetadataBuilder from "../../src/js/ui/TreeMetadataBuilder.js";

const output = document.getElementById("result");
let assertions = 0;
const assert = (condition, message) => {
    assertions += 1;
    if (!condition) throw new Error(message);
};

function fileHandle(name, size, lastModified) {
    return {
        kind: "file", name,
        getFile: async () => ({ name, size, lastModified })
    };
}

function library(name, files) {
    const handle = {
        kind: "directory", name,
        queryPermission: async () => "granted"
    };
    const root = new Folder(name, handle);

    root.gpxFiles.push(...files);
    return new Library(name, root, 1, files.length);
}

function createTree(initialLibrary) {
    const builder = new TreeMetadataBuilder();
    const tree = {
        expandedPaths: new Set([""]),
        nodeMetadata: new Map(),
        selected: null,
        async render(value) {
            const prepared = builder.build(value);
            this.nodeMetadata = prepared.nodeMetadata;
            this.entries = builder.getFileEntries(this.nodeMetadata);
        },
        getFileEntries() { return this.entries; },
        hasFile(path) { return this.nodeMetadata.get(path)?.kind === "file"; },
        refreshAllFileRows() {},
        refreshAllFolderRows() {},
        setSelectedPath(path) { this.selected = path; }
    };

    return tree.render(initialLibrary).then(() => tree);
}

async function testRefreshAndReconciliation() {
    const oldA = fileHandle("A.gpx", 10, 1);
    const oldB = fileHandle("B.gpx", 20, 1);
    const oldD = fileHandle("D.gpx", 40, 1);
    const oldLibrary = library("GPX", [oldA, oldB, oldD]);
    const newA = fileHandle("A.gpx", 10, 1);
    const newB = fileHandle("B.gpx", 21, 2);
    const newC = fileHandle("C.gpx", 30, 3);
    const actualLibrary = library("GPX", [newA, newB, newC]);
    const tree = await createTree(oldLibrary);
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const summaryBuilder = new TrackSummaryBuilder();
    const summaries = [oldA, oldB, oldD].map((handle, index) =>
        summaryBuilder.build(handle.name, {
            name: handle.name,
            size: [10, 20, 40][index],
            lastModified: 1
        }, null)
    );
    const discoveryCalls = [];
    const discovery = {
        getSnapshotState: () => ({ entries: summaries }),
        reconcileLibrary(value) { discoveryCalls.push(value); return true; }
    };

    displayState.setLibrary(oldLibrary.rootFolder.handle);
    tree.getFileEntries().forEach(({ path, fileHandle: handle }) =>
        displayState.registerFile(path, handle, "#123456")
    );
    displayState.setChecked("A.gpx", true);
    displayState.setChecked("B.gpx", true);
    selectionState.select("B.gpx", "test");
    const removed = [];
    const reloaded = [];
    const invalidated = [];
    let currentLibrary = oldLibrary;
    let scanCount = 0;
    let now = 100;
    const eventBus = new EventBus();
    const previous = {
        isLoading: () => false,
        getRefreshHandle: () => currentLibrary.rootFolder.handle,
        queryRefreshPermission: async () => "granted",
        refreshPreviousIfGranted: async () => false
    };
    const coordinator = new LibraryRefreshCoordinator({
        eventBus,
        scanner: { scan: async () => { scanCount += 1; return actualLibrary; } },
        previousLibraryCoordinator: previous,
        librarySnapshotService: { isProvisional: () => false },
        treeView: tree,
        discoveryCoordinator: discovery,
        displayState,
        selectionState,
        repository: {
            invalidate: async (namespace, path) => invalidated.push([namespace, path])
        },
        getNamespace: () => "local:GPX",
        getLibrary: () => currentLibrary,
        setLibrary: value => { currentLibrary = value; },
        getColor: () => "#123456",
        removePath: path => removed.push(path),
        reloadVisiblePath: async value => reloaded.push(value.path),
        onLibraryUpdated: () => {},
        now: () => now
    });

    coordinator.bind();
    const first = coordinator.refresh();
    const duplicate = coordinator.refresh();

    assert(first === duplicate, "simultaneous sidebar refresh was duplicated");
    const result = await first;
    assert(scanCount === 1, "sidebar open did not run exactly one scan");
    assert(result.added === 1 && result.removed === 1 && result.modified === 1,
        "Library diff counts were incorrect");
    assert(displayState.getDisplay("C.gpx")?.checked === false,
        "new GPX was not registered unchecked");
    assert(displayState.getDisplay("A.gpx")?.checked === true,
        "existing visibility was not preserved");
    assert(selectionState.getSelectedPath() === "B.gpx" && tree.selected === "B.gpx",
        "selected Track was not preserved");
    assert(removed.includes("D.gpx") && !displayState.getDisplay("D.gpx"),
        "removed GPX was not reconciled");
    assert(invalidated.some(([, path]) => path === "B.gpx"),
        "modified GPX cache was not invalidated");
    assert(reloaded.includes("B.gpx") && !reloaded.includes("C.gpx"),
        "only a visible modified GPX should reload");
    assert(discoveryCalls[0].entries.some(entry => entry.relativePath === "C.gpx"),
        "new GPX was not added to Discovery/Date/Search metadata");
    now += 100;
    assert(await coordinator.refresh() === false && scanCount === 1,
        "rapid sidebar reopen bypassed refresh throttling");
}

async function testPromptDoesNotRequestOrScan() {
    let scans = 0;
    let requests = 0;
    const coordinator = new LibraryRefreshCoordinator({
        eventBus: new EventBus(),
        scanner: { scan: async () => { scans += 1; } },
        previousLibraryCoordinator: {
            isLoading: () => false,
            getRefreshHandle: () => ({}),
            queryRefreshPermission: async () => "prompt",
            refreshPreviousIfGranted: async () => { requests += 1; }
        },
        librarySnapshotService: { isProvisional: () => true },
        treeView: {}, discoveryCoordinator: {}, displayState: {},
        selectionState: {}, repository: {}, getNamespace: () => null,
        getLibrary: () => null, setLibrary: () => {}, getColor: () => null,
        removePath: () => {}, reloadVisiblePath: async () => {},
        onLibraryUpdated: () => {}
    });

    assert(await coordinator.refresh() === false,
        "permission prompt unexpectedly refreshed the Library");
    assert(scans === 0 && requests === 0,
        "permission prompt triggered scan or requestPermission");
}

try {
    await testRefreshAndReconciliation();
    await testPromptDoesNotRequestOrScan();
    output.textContent = `PASS: ${assertions} assertions`;
    document.documentElement.dataset.testStatus = "pass";
} catch (error) {
    output.textContent = `FAIL: ${error.message}\n${error.stack}`;
    document.documentElement.dataset.testStatus = "fail";
}
