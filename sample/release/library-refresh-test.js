import LibraryRefreshCoordinator from "../../src/js/core/LibraryRefreshCoordinator.js";
import EventBus from "../../src/js/core/EventBus.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import Folder from "../../src/js/models/Folder.js";
import Library from "../../src/js/models/Library.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";
import TreeMetadataBuilder from "../../src/js/ui/TreeMetadataBuilder.js";
import FolderScanner from "../../src/js/services/FolderScanner.js";
import LibrarySnapshotService, {
    normalizeLibrarySnapshot
} from "../../src/js/services/LibrarySnapshotService.js";
import PreviousLibraryCoordinator from "../../src/js/core/PreviousLibraryCoordinator.js";
import TreeView from "../../src/js/ui/TreeView.js";
import TreeIncrementalReconciler from "../../src/js/ui/TreeIncrementalReconciler.js";
import LibraryAccessPanel from "../../src/js/ui/LibraryAccessPanel.js";
import GPXGeometryLoader from "../../src/js/services/GPXGeometryLoader.js";

const output = document.getElementById("result");
const focusedIncremental = new URLSearchParams(
    globalThis.location?.search || ""
).get("focus") === "incremental";
let assertions = 0;
const assert = (condition, message) => {
    assertions += 1;
    if (!condition) throw new Error(message);
};

function fileHandle(name, size, lastModified) {
    return {
        kind: "file", name,
        getFile: async () => ({
            name, size, lastModified,
            text: async () => "<gpx></gpx>"
        })
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

function directoryHandle(name, entries) {
    return {
        kind: "directory", name,
        async *values() { yield* entries; }
    };
}

async function testFreshRecursiveScan() {
    const rootFile = fileHandle("root.gpx", 1, 1);
    const nestedFile = fileHandle("nested.gpx", 1, 1);
    const ignoredFile = fileHandle("ignored.gpx", 1, 1);
    const root = directoryHandle("GPX", [
        rootFile,
        directoryHandle("Trips", [nestedFile]),
        directoryHandle("TrailBook_Backup", [ignoredFile])
    ]);
    const scanned = await new FolderScanner().scan(root);
    const paths = new TreeMetadataBuilder().getFileEntries(
        new TreeMetadataBuilder().build(scanned).nodeMetadata
    ).map(entry => entry.path);

    assert(paths.includes("root.gpx"), "fresh scan missed a root GPX");
    assert(paths.includes("Trips/nested.gpx"), "fresh scan missed a nested GPX");
    assert(!paths.some(path => path.includes("TrailBook_Backup")),
        "fresh scan included the reserved Backup folder");
    const diagnostic = new FolderScanner();
    const diagnosticRoot = directoryHandle("GPX", [
        rootFile,
        directoryHandle("Trips", [nestedFile]),
        directoryHandle("TrailBook_Backup", [ignoredFile])
    ]);

    await diagnostic.scan(diagnosticRoot);
    assert(diagnostic.getLastScanDiagnostic().directoryEntryCount === 4 &&
        diagnostic.getLastScanDiagnostic().gpxCandidateCount === 2,
    "recursive enumeration diagnostic did not count actual yielded entries");
}

function createTree(initialLibrary) {
    const builder = new TreeMetadataBuilder();
    const tree = {
        expandedPaths: new Set([""]),
        nodeMetadata: new Map(),
        selected: null,
        renderCount: 0,
        reconcileCount: 0,
        async render(value) {
            this.renderCount += 1;
            this.apply(value);
        },
        async reconcileLibrary(value) {
            this.reconcileCount += 1;
            this.apply(value);
        },
        apply(value) {
            const prepared = builder.build(value);
            this.nodeMetadata = prepared.nodeMetadata;
            this.entries = builder.getFileEntries(this.nodeMetadata);
        },
        getFileEntries() { return this.entries; },
        getSearchSourceEntries() {
            return builder.getSearchSourceEntries(this.nodeMetadata);
        },
        hasFile(path) { return this.nodeMetadata.get(path)?.kind === "file"; },
        refreshAllFileRows() {},
        refreshAllFolderRows() {},
        setDisplayChecked(path, checked) {
            const metadata = this.nodeMetadata.get(path);

            if (metadata) metadata.checked = checked;
        },
        setSelectedPath(path) { this.selected = path; }
    };

    return tree.render(initialLibrary).then(() => tree);
}

async function testRefreshAndReconciliation() {
    const oldA = fileHandle("A.gpx", 10, 1);
    const oldB = fileHandle("B.gpx", 20, 1);
    const oldD = fileHandle("D.gpx", 40, 1);
    const oldF = fileHandle("F.gpx", 50, 1);
    const staleE = fileHandle("E.gpx", 45, 4);
    const oldLibrary = library("GPX", [oldA, oldB, oldD, oldF]);
    const newA = fileHandle("A.gpx", 10, 1);
    const newB = fileHandle("B.gpx", 21, 2);
    const newC = fileHandle("C.gpx", 30, 3);
    const newE = fileHandle("E.gpx", 45, 4);
    const newF = fileHandle("F.gpx", 50, 1);
    const actualLibrary = library(
        "GPX",
        [newE, newB, newF, newA, newC]
    );
    const tree = await createTree(oldLibrary);
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const summaryBuilder = new TrackSummaryBuilder();
    const summaries = [oldA, oldB, oldD, oldF, staleE].map((handle, index) =>
        summaryBuilder.build(handle.name, {
            name: handle.name,
            size: [10, 20, 40, 50, 45][index],
            lastModified: 1
        }, null)
    );
    const discoveryCalls = [];
    let discoveryEntries = summaries;
    const discovery = {
        getSnapshotState: () => ({
            entries: discoveryEntries,
            mode: "folder",
            filter: null,
            expandedDateIds: []
        }),
        reconcileLibrary(value) {
            discoveryCalls.push(value);
            discoveryEntries = value.entries;
            return true;
        }
    };

    displayState.setLibrary(oldLibrary.rootFolder.handle);
    const previousColors = new Map([
        ["A.gpx", "#111111"],
        ["B.gpx", "#222222"],
        ["D.gpx", "#444444"],
        ["F.gpx", "#333333"]
    ]);

    tree.getFileEntries().forEach(({ path, fileHandle: handle }) =>
        displayState.registerFile(path, handle, previousColors.get(path))
    );
    displayState.setChecked("A.gpx", true);
    displayState.setChecked("B.gpx", true);
    displayState.setChecked("F.gpx", false);
    oldF.provisional = true;
    displayState.setError("F.gpx", new DOMException(
        "Cached handle cannot load",
        "NotAllowedError"
    ));
    displayState.registerFile("E.gpx", staleE, "#999999");
    displayState.setChecked("E.gpx", true);
    selectionState.select("B.gpx", "test");
    const removed = [];
    const reloaded = [];
    const invalidated = [];
    let currentLibrary = null;
    let scanCount = 0;
    let previousOpenCount = 0;
    let snapshotUpdates = 0;
    let updateContext = null;
    let persistedLibrarySnapshot = null;
    let now = 100;
    const eventBus = new EventBus();
    const snapshotService = new LibrarySnapshotService({
        treeView: tree,
        discoveryCoordinator: discovery,
        displayState,
        getColor: path => displayState.getDisplay(path)?.color || null,
        accessPanel: { setProvisionalLibrary() {} },
        eventBus
    });

    snapshotService.provisional = true;
    snapshotService.cacheNamespace = "local:GPX";
    snapshotService.provisionalPaths = new Set([
        "A.gpx", "B.gpx", "D.gpx", "F.gpx"
    ]);
    const previous = {
        isLoading: () => false,
        getRefreshHandle: () => oldLibrary.rootFolder.handle,
        queryRefreshPermission: async () => "granted",
        requestRefreshPermission: async () => "granted",
        refreshPreviousIfGranted: async () => false,
        openPrevious: async () => {
            previousOpenCount += 1;
            return false;
        }
    };
    const coordinator = new LibraryRefreshCoordinator({
        eventBus,
        scanner: { scan: async () => { scanCount += 1; return actualLibrary; } },
        previousLibraryCoordinator: previous,
        librarySnapshotService: snapshotService,
        treeView: tree,
        treeReconciler: {
            reconcile: (view, value) => view.reconcileLibrary(value)
        },
        discoveryCoordinator: discovery,
        displayState,
        selectionState,
        repository: {
            invalidate: async (namespace, path) => invalidated.push([namespace, path])
        },
        getNamespace: () => "local:GPX",
        getLibrary: () => currentLibrary,
        setLibrary: value => { currentLibrary = value; },
        getColor: path => path === "C.gpx" ? "#555555" : "#666666",
        getFolderColor: () => "#f08000",
        getEntryPresentationDiagnostic: () => ({
            folderResolvedColor: "#f08000",
            folderDomColor: "rgb(240, 128, 0)",
            trackDomColor: "rgb(240, 128, 0)"
        }),
        removePath: path => removed.push(path),
        reloadVisiblePath: async value => reloaded.push(value.path),
        onLibraryUpdated: (value, context) => {
            snapshotUpdates += 1;
            updateContext = context;
            persistedLibrarySnapshot = snapshotService.capture({
                libraryIdentity: "local:GPX",
                rootName: value.name
            });
            snapshotService.markReady();
            return true;
        },
        now: () => now
    });

    coordinator.bind();
    const first = coordinator.refresh({
        reason: "manual-refresh",
        reconnect: true
    });
    const duplicate = coordinator.refresh({
        reason: "manual-refresh",
        reconnect: true
    });

    assert(first === duplicate, "simultaneous sidebar refresh was duplicated");
    const result = await first;
    assert(scanCount === 1, "sidebar open did not run exactly one scan");
    assert(previousOpenCount === 0,
        "manual refresh called the full previous-Library reopen path");
    assert(currentLibrary === actualLibrary,
        "incremental refresh did not promote the scanned actual Library");
    assert(result.added === 1 && result.recovered === 1 &&
        result.removed === 1 && result.modified === 0,
        "Library diff counts were incorrect");
    assert(displayState.getDisplay("C.gpx")?.checked === false &&
        displayState.getDisplay("E.gpx")?.checked === false,
    "new GPX files were not both registered unchecked");
    assert(displayState.getDisplay("A.gpx")?.checked === true,
        "existing visibility was not preserved");
    assert(displayState.getDisplay("F.gpx")?.checked === false,
        "existing hidden state was not preserved");
    assert(displayState.getDisplay("A.gpx")?.color === "#111111" &&
        displayState.getDisplay("B.gpx")?.color === "#222222" &&
        displayState.getDisplay("F.gpx")?.color === "#f08000",
    "existing colors were reassigned after scan-order changes");
    assert(displayState.getDisplay("F.gpx")?.state === "idle" &&
        displayState.getDisplay("F.gpx")?.error === null &&
        displayState.getDisplay("F.gpx")?.fileHandle === newF &&
        tree.nodeMetadata.get("F.gpx")?.state === "idle",
    "cached-handle error was not normalized after actual FileHandle rebinding");
    assert(displayState.getDisplay("C.gpx")?.color === "#f08000" &&
        displayState.getDisplay("E.gpx")?.color === "#f08000",
    "new Tracks did not inherit the existing Folder presentation color");
    assert(selectionState.getSelectedPath() === "B.gpx" && tree.selected === "B.gpx",
        "selected Track was not preserved");
    assert(removed.includes("D.gpx") && !displayState.getDisplay("D.gpx"),
        "removed GPX was not reconciled");
    assert(invalidated.length === 0 && reloaded.length === 0,
        "fast refresh performed blocking modified-file validation/reload");
    assert(discoveryCalls[0].entries.some(entry => entry.relativePath === "C.gpx"),
        "new GPX was not added to Discovery/Date/Search metadata");
    const incrementalEntry = discoveryCalls[0].entries.find(
        entry => entry.relativePath === "C.gpx"
    );
    const fullEntry = summaryBuilder.build("C.gpx", {
        name: "C.gpx", size: 30, lastModified: 3
    }, { tracks: [], metadata: {} });

    assert(incrementalEntry.status === "ready" &&
        Object.keys(incrementalEntry.toRecord()).join("|") ===
            Object.keys(fullEntry.toRecord()).join("|") &&
        incrementalEntry.relativePath === "C.gpx" &&
        incrementalEntry.folderPath === "" &&
        incrementalEntry.fileSize === 30 &&
        incrementalEntry.lastModified === 3,
    "incremental discovery entry schema/status differs from full-open entry");
    assert(snapshotUpdates === 1,
        "reconciled Tree metadata was not offered to Snapshot persistence");
    assert(updateContext?.preserveExistingPresentation === true,
        "incremental refresh allowed Folder color presentation reassignment");
    assert(persistedLibrarySnapshot?.entries.some(
        entry => entry.relativePath === "C.gpx"
    ) && persistedLibrarySnapshot.entries.some(
        entry => entry.relativePath === "E.gpx"
    ), "new/recovered Tracks were not committed to Library Snapshot metadata");
    const restartedSnapshot = normalizeLibrarySnapshot(
        persistedLibrarySnapshot,
        "local:GPX"
    );

    assert(restartedSnapshot?.entries.some(
        entry => entry.relativePath === "C.gpx"
    ) && restartedSnapshot.entries.some(
        entry => entry.relativePath === "E.gpx"
    ), "restart normalization lost newly committed Library Tree entries");
    assert(tree.reconcileCount === 1 && tree.renderCount === 1,
        "incremental refresh used full Tree apply instead of DOM reconcile");
    assert(coordinator.getDiagnostic().scannedCount === 5 &&
        coordinator.getDiagnostic().addedCount === 1 &&
        coordinator.getDiagnostic().recoveredCount === 1,
    "refresh diagnostic did not report actual/cached diff counts");
    const entryTrace = coordinator.getDiagnostic().entryTrace;

    assert(entryTrace?.path === "E.gpx" &&
        entryTrace.classification === "recovered" && entryTrace.scanned &&
        entryTrace.reconcileInput && entryTrace.runtimeLibrary &&
        entryTrace.treeMetadata,
    "new Track path was lost between scan, reconcile, and Tree metadata");
    assert(entryTrace.folderResolvedColor === "#F08000" &&
        entryTrace.folderDomColor === "#F08000" &&
        entryTrace.trackDomColor === "#F08000",
    `entry color diagnostics were not normalized: ${JSON.stringify(entryTrace)}`);
    assert(entryTrace.fileHandleActual && !entryTrace.fileHandleProvisional,
        "entry FileHandle diagnostic did not report the actual handle");
    eventBus.emit("library-refresh:entry-diagnostic", {
        path: "E.gpx", stage: "click", status: "received-on"
    });
    eventBus.emit("library-refresh:entry-diagnostic", {
        path: "E.gpx", stage: "resolver", status: "actual",
        fileHandleKind: "file", fileHandleActual: true,
        fileHandleProvisional: false
    });
    eventBus.emit("library-refresh:entry-diagnostic", {
        path: "E.gpx", stage: "getFile", status: "success"
    });
    const checkboxTrace = coordinator.getDiagnostic().entryTrace;

    assert(checkboxTrace.resolverResult === "actual" &&
        checkboxTrace.getFileResult === "success" &&
        checkboxTrace.checkboxStage === "getFile: success" &&
        checkboxTrace.checkboxTrace.join("|").includes("click: received-on"),
    "runtime checkbox diagnostics did not retain the observed stage path");
    eventBus.emit("library-refresh:entry-diagnostic", {
        path: "E.gpx", stage: "getFile", status: "failure",
        errorName: "NotAllowedError", errorMessage: "permission required"
    });
    const failedTrace = coordinator.getDiagnostic().entryTrace;

    assert(failedTrace.getFileResult === "failure" &&
        failedTrace.getFileErrorName === "NotAllowedError" &&
        failedTrace.getFileErrorMessage === "permission required",
    "runtime getFile failure diagnostics lost the actual error");
    const performance = coordinator.getDiagnostic().performance;

    assert(performance.mode === "incremental" &&
        performance.scannedCount === 5 &&
        performance.unchangedCount === 3 &&
        performance.addedCount === 2 &&
        performance.removedCount === 1 &&
        performance.modifiedCount === 0,
    "incremental refresh performance counters lost diff results");
    assert(performance.getFileCount === 2 &&
        performance.existingGetFileCount === 0 &&
        performance.addedGetFileCount === 2 &&
        performance.existingMetadataValidationCount === 0 &&
        performance.addedMetadataValidationCount === 2 &&
        performance.bodyReadCount === 0 && performance.parseCount === 0 &&
        performance.metadataExtractionCount === 1 &&
        performance.cacheLookupCount === 0 &&
        performance.geometryGenerationCount === 0,
    "incremental refresh performance counters changed observed work");
    assert([
        performance.totalMs,
        performance.enumerationMs,
        performance.diffMs,
        performance.validationMs,
        performance.addedProcessingMs,
        performance.modifiedProcessingMs,
        performance.reconcileMs,
        performance.snapshotUpdateMs
    ].every(Number.isFinite),
    "incremental refresh stage timings were incomplete");
    now += 100;
    assert(await coordinator.refresh() === false && scanCount === 1,
        "rapid sidebar reopen bypassed refresh throttling");
    now += 3000;
    const repeated = await coordinator.refresh({ reason: "sidebar-open" });

    assert(repeated.added === 0,
        "repeated actual scan rediscovered an existing GPX as new");
}

async function testIncrementalTreeDomReconcile() {
    const createNestedLibrary = tripFiles => {
        const rootHandle = directoryHandle("GPX", []);
        const root = new Folder("GPX", rootHandle);
        const trips = new Folder("Trips", directoryHandle("Trips", []));
        const other = new Folder("Other", directoryHandle("Other", []));

        trips.gpxFiles.push(...tripFiles);
        other.gpxFiles.push(fileHandle("Other.gpx", 1, 1));
        root.folders.push(trips, other);
        return new Library("GPX", root, 3, tripFiles.length + 1);
    };
    const before = createNestedLibrary([fileHandle("A.gpx", 1, 1)]);
    const after = createNestedLibrary([
        fileHandle("A.gpx", 1, 1),
        fileHandle("NEW.gpx", 2, 2)
    ]);
    const eventBus = new EventBus();
    const tree = new TreeView(eventBus);

    await tree.render(before);
    tree.expandFolder("Trips");
    const unaffectedFolderRow = tree.folderNodes.get("Other");

    await new TreeIncrementalReconciler().reconcile(tree, after, {
        affectedPaths: ["Trips/NEW.gpx"]
    });
    assert(tree.fileNodes.has("Trips/NEW.gpx"),
        "new Track was not inserted into the currently opened Folder DOM");
    assert(tree.folderNodes.get("Other") === unaffectedFolderRow,
        "incremental DOM reconcile rebuilt an unaffected Folder");

    const detachedTripsRow = document.createElement("div");

    tree.folderNodes.set("Trips", detachedTripsRow);
    const recovered = createNestedLibrary([
        fileHandle("A.gpx", 1, 1),
        fileHandle("RECOVERED.gpx", 4, 4)
    ]);
    const recoveredResult = await new TreeIncrementalReconciler().reconcile(
        tree,
        recovered,
        { affectedPaths: ["Trips/RECOVERED.gpx"] }
    );

    assert(tree.fileNodes.has("Trips/RECOVERED.gpx") &&
        tree.element.contains(tree.folderNodes.get("Trips")) &&
        recoveredResult.metadataPaths.includes("Trips/RECOVERED.gpx") &&
        recoveredResult.renderedPaths.includes("Trips/RECOVERED.gpx"),
    "recovered Track was applied to a detached row instead of the live Tree DOM");
    let loadReached = false;
    let toggledPath = null;
    const loaderDiagnostics = [];
    const loader = new GPXGeometryLoader({
        parser: { parse: () => ({ tracks: [], metadata: {} }) },
        repository: {},
        diagnosticObserver: value => loaderDiagnostics.push(value)
    });

    eventBus.on("gpx:display-toggled", ({ path, fileHandle, checked }) => {
        toggledPath = path;
        if (checked) {
            void loader.load(path, fileHandle).then(() => {
                loadReached = true;
            });
        }
    });
    const recoveredCheckbox = tree.fileNodes.get("Trips/RECOVERED.gpx")
        .querySelector(".gpx-display-toggle");

    recoveredCheckbox.checked = true;
    recoveredCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert(toggledPath === "Trips/RECOVERED.gpx" && loadReached &&
        tree.fileHandlesByPath.get(toggledPath)?.provisional !== true,
    "checkbox did not resolve the incremental relativePath to an actual FileHandle");
    assert(loaderDiagnostics.some(value =>
        value.stage === "getFile" && value.status === "success"
    ) && loaderDiagnostics.some(value =>
        value.stage === "parser" && value.status === "success"
    ), "GPX loader diagnostics did not observe getFile/parser success");
    const failedLoaderDiagnostics = [];
    const failedLoader = new GPXGeometryLoader({
        parser: { parse: () => ({ tracks: [], metadata: {} }) },
        repository: {},
        diagnosticObserver: value => failedLoaderDiagnostics.push(value)
    });
    const deniedHandle = {
        kind: "file", name: "Denied.gpx", provisional: true,
        async getFile() {
            throw new DOMException("permission required", "NotAllowedError");
        }
    };

    try {
        await failedLoader.load("Trips/Denied.gpx", deniedHandle);
    } catch {
        // The unchanged loader contract rejects; diagnostics only observe it.
    }
    assert(failedLoaderDiagnostics.some(value =>
        value.stage === "getFile" && value.status === "failure" &&
        value.errorName === "NotAllowedError" &&
        value.fileHandleProvisional === true
    ), "GPX loader diagnostics lost the getFile failure/provisional identity");
}

async function testFastRefreshScale() {
    const existingCount = 1123;
    let existingGetFileCount = 0;
    let addedGetFileCount = 0;
    const oldFiles = Array.from({ length: existingCount }, (_, index) => ({
        kind: "file",
        name: `Track-${index}.gpx`,
        getFile: async () => {
            existingGetFileCount += 1;
            return { name: `Track-${index}.gpx`, size: 1, lastModified: 1 };
        }
    }));
    const scannedExisting = oldFiles.map(({ name }) => ({
        kind: "file", name,
        getFile: async () => {
            existingGetFileCount += 1;
            return { name, size: 1, lastModified: 1 };
        }
    }));
    const addedFiles = ["New-A.gpx", "New-B.gpx"].map(name => ({
        kind: "file", name,
        getFile: async () => {
            addedGetFileCount += 1;
            return { name, size: 2, lastModified: 2 };
        }
    }));
    const before = library("Scale", oldFiles);
    const after = library("Scale", [...scannedExisting, ...addedFiles]);
    const tree = await createTree(before);
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    let currentLibrary = before;

    tree.getFileEntries().forEach(({ path, fileHandle: handle }) => {
        displayState.registerFile(path, handle, "#f08000");
    });
    selectionState.select("Track-100.gpx", "test");
    const discoveryEntries = oldFiles.map(({ name }) => ({
        relativePath: name
    }));
    const coordinator = new LibraryRefreshCoordinator({
        eventBus: new EventBus(),
        scanner: { scan: async () => after },
        previousLibraryCoordinator: {
            isLoading: () => false,
            getRefreshHandle: () => before.rootFolder.handle,
            requestRefreshPermission: async () => "granted"
        },
        librarySnapshotService: {
            isProvisional: () => true,
            hasProvisionalPath: path => path.startsWith("Track-"),
            getRefreshContext: () => ({
                provisional: true,
                libraryState: "provisional",
                cachedCount: existingCount
            })
        },
        treeView: tree,
        treeReconciler: {
            reconcile: (view, value) => view.reconcileLibrary(value)
        },
        discoveryCoordinator: {
            getSnapshotState: () => ({ entries: discoveryEntries }),
            reconcileLibrary() { return true; }
        },
        displayState,
        selectionState,
        repository: {},
        getNamespace: () => "local:scale",
        getLibrary: () => currentLibrary,
        setLibrary: value => { currentLibrary = value; },
        getColor: () => "#008080",
        getFolderColor: () => "#f08000",
        removePath() {},
        reloadVisiblePath() {},
        onLibraryUpdated: () => true,
        now: () => 100
    });

    const result = await coordinator.refresh({
        reason: "manual-refresh",
        reconnect: true
    });
    const performance = coordinator.getDiagnostic().performance;

    globalThis.__libraryRefreshScale = Object.freeze({
        totalMs: performance.totalMs,
        enumerationMs: performance.enumerationMs,
        diffMs: performance.diffMs,
        addedProcessingMs: performance.addedProcessingMs,
        reconcileMs: performance.reconcileMs,
        existingGetFileCount,
        addedGetFileCount
    });

    assert(result.added === 2 && result.removed === 0 &&
        result.modified === 0 && performance.mode === "incremental",
    "1123+2 fixture did not use path-only incremental diff");
    assert(existingGetFileCount === 0 && addedGetFileCount === 2 &&
        performance.existingGetFileCount === 0 &&
        performance.existingMetadataValidationCount === 0,
    "fast refresh called getFile/metadata validation for existing Tracks");
    assert(displayState.getDisplay("New-A.gpx")?.color === "#f08000" &&
        displayState.getDisplay("New-B.gpx")?.color === "#f08000" &&
        !displayState.getDisplay("New-A.gpx")?.checked &&
        !displayState.getDisplay("New-B.gpx")?.checked,
    "new Tracks did not preserve Folder presentation and unchecked state");
    assert(selectionState.getSelectedPath() === "Track-100.gpx" &&
        tree.renderCount === 1 && tree.reconcileCount === 1,
    "fast refresh lost selection or used a full Tree apply");
}

function testRefreshCompletionFeedback() {
    const panel = new LibraryAccessPanel();
    const base = {
        permission: "granted", hasHandle: true,
        libraryState: "ready", canManualRefresh: false,
        reason: "manual-refresh"
    };

    panel.setLibraryRefreshAction(() => {});
    panel.setLibraryRefreshState({ ...base, result: "checking" });
    assert(!panel.libraryRefreshButton.hidden &&
        panel.libraryRefreshButton.disabled &&
        panel.libraryRefreshButton.textContent === "確認中…",
    "running refresh feedback was not visible and disabled");
    panel.setLibraryRefreshState({
        ...base, result: "success", addedCount: 1, recoveredCount: 1
    });
    assert(panel.libraryRefreshButton.textContent === "更新完了（+2件）",
        "refresh completion did not include added and recovered counts");
    panel.setLibraryRefreshState({
        ...base, result: "success", addedCount: 0, recoveredCount: 0
    });
    assert(panel.libraryRefreshButton.textContent === "更新完了（変更なし）",
        "no-change refresh completion feedback was incorrect");
    panel.setLibraryRefreshState({ ...base, result: "failure" });
    assert(panel.libraryRefreshButton.textContent === "更新失敗",
        "refresh failure feedback was not visible");
    clearTimeout(panel.libraryRefreshFeedbackTimer);
}

async function testPromptDoesNotRequestOrScan() {
    let scans = 0;
    let requests = 0;
    let refreshAction = null;
    let refreshState = null;
    let persistenceListener = null;
    let provisional = true;
    const publishOrder = [];
    const eventBus = new EventBus();
    const coordinator = new LibraryRefreshCoordinator({
        eventBus,
        scanner: { scan: async () => { scans += 1; } },
        previousLibraryCoordinator: {
            isLoading: () => false,
            getRefreshHandle: () => ({}),
            queryRefreshPermission: async () => "prompt",
            refreshPreviousIfGranted: async () => false,
            requestRefreshPermission: async () => {
                requests += 1;
                return "denied";
            },
            openPrevious: async () => {
                throw new Error("manual refresh must not reopen the Library");
            },
            setPersistenceStatusListener(listener) {
                persistenceListener = listener;
            }
        },
        librarySnapshotService: { isProvisional: () => provisional },
        accessPanel: {
            setLibraryRefreshAction(action) {
                refreshAction = action;
                publishOrder.push("action");
            },
            setLibraryRefreshState(state) {
                refreshState = state;
                publishOrder.push("state");
            }
        },
        treeView: {}, discoveryCoordinator: {}, displayState: {},
        selectionState: {}, repository: {}, getNamespace: () => null,
        getLibrary: () => null, setLibrary: () => {}, getColor: () => null,
        removePath: () => {}, reloadVisiblePath: async () => {},
        onLibraryUpdated: () => {}
    });

    coordinator.bind();
    assert(publishOrder[0] === "action" && publishOrder.includes("state"),
        "refresh action connection did not trigger state publication in order");
    assert(refreshState.canManualRefresh === false,
        "refresh action was visible before Coordinator received permission state");
    persistenceListener({ permission: "prompt", hasHandle: true });
    assert(refreshState.canManualRefresh === true &&
        refreshState.libraryState === "provisional",
    "late prompt/Handle state did not enable provisional manual refresh");
    assert(refreshState === coordinator.refreshState &&
        Object.isFrozen(refreshState),
    "Panel did not receive the Coordinator's immutable state object directly");
    assert(refreshState.cachedCount === null && refreshState.scannedCount === null,
        "unknown cached/scanned counts incorrectly blocked refresh state");
    assert(await coordinator.refresh() === false,
        "permission prompt unexpectedly refreshed the Library");
    assert(scans === 0 && requests === 0,
        "permission prompt triggered scan or requestPermission");
    assert(coordinator.getDiagnostic().permission === "prompt" &&
        coordinator.getDiagnostic().result === "waiting" &&
        coordinator.getDiagnostic().reason === "waiting-permission",
    "permission prompt was not exposed by the refresh diagnostic");
    assert(refreshState.canManualRefresh && typeof refreshAction === "function",
        "permission prompt did not expose the explicit refresh action");
    assert(refreshState.permission === "prompt" && refreshState.hasHandle &&
        refreshState.cachedCount === 0 && refreshState.scannedCount === null,
    "initial prompt diagnostic was not wired to the Library panel");
    assert(!await coordinator.refresh({
        reason: "manual-refresh",
        reconnect: true
    }), "denied explicit refresh unexpectedly changed the cached Library");
    assert(scans === 0 && requests === 1,
        "explicit refresh did not limit denied access to permission request");
    assert(!refreshState.canManualRefresh &&
        refreshState.permission === "denied" &&
        refreshState.result === "permission-denied",
    "denied refresh did not preserve cached state and update diagnostics");
    persistenceListener({ permission: "denied", hasHandle: true });
    assert(!refreshState.canManualRefresh,
        "denied permission exposed the prompt-only refresh action");
    provisional = false;
    persistenceListener({ permission: "prompt", hasHandle: true });
    eventBus.emit("library:provisional-state-changed", { provisional: false });
    assert(refreshState.libraryState === "none" && !refreshState.canManualRefresh,
        "actual/non-provisional state retained manual refresh action");
}

function createHydrationHarness({
    previousState = { permission: "unknown", hasHandle: false },
    snapshotState = {
        provisional: false, libraryState: "none", cachedCount: null
    }
} = {}) {
    let persistenceListener = null;
    let previous = { ...previousState };
    let snapshot = { ...snapshotState };
    const published = [];
    const hydrationDiagnostics = [];
    const eventBus = new EventBus();
    const coordinator = new LibraryRefreshCoordinator({
        eventBus,
        scanner: {},
        previousLibraryCoordinator: {
            isLoading: () => false,
            getRefreshHandle: () => previous.hasHandle ? {} : null,
            getRefreshContext: () => ({ ...previous }),
            setPersistenceStatusListener(listener) {
                persistenceListener = listener;
                listener({ ...previous });
            }
        },
        librarySnapshotService: {
            isProvisional: () => snapshot.libraryState === "provisional",
            getRefreshContext: () => ({ ...snapshot })
        },
        accessPanel: {
            setLibraryRefreshAction() {},
            setLibraryRefreshState(state) { published.push(state); },
            setLibraryRefreshHydrationDiagnostic(diagnostic) {
                hydrationDiagnostics.push(diagnostic);
            }
        },
        treeView: {}, discoveryCoordinator: {}, displayState: {},
        selectionState: {}, repository: {}, getNamespace: () => null,
        getLibrary: () => null, setLibrary: () => {}, getColor: () => null,
        removePath: () => {}, reloadVisiblePath: async () => {},
        onLibraryUpdated: () => {}, canRefresh: () => false
    });

    coordinator.bind();
    return {
        coordinator,
        eventBus,
        published,
        hydrationDiagnostics,
        setPrevious(value) {
            previous = { ...value };
            persistenceListener({ ...previous });
        },
        setSnapshot(value) {
            snapshot = { ...value };
            eventBus.emit("library:provisional-state-changed", {
                provisional: snapshot.libraryState === "provisional"
            });
        }
    };
}

function assertManualRefreshState(state, message) {
    assert(state.permission === "prompt" && state.hasHandle === true &&
        state.libraryState === "provisional" &&
        state.canManualRefresh === true && state.cachedCount === 1123 &&
        state.reason === "waiting-permission" && state.result === "waiting",
    message);
}

function testInitialStateHydrationOrdering() {
    const existing = createHydrationHarness({
        previousState: { permission: "prompt", hasHandle: true },
        snapshotState: {
            provisional: true,
            libraryState: "provisional",
            cachedCount: 1123
        }
    });

    assertManualRefreshState(existing.coordinator.getDiagnostic(),
        "existing Previous/Fast Restore state was not hydrated at construction");
    assert(existing.published.length === 1,
        "unchanged constructor/bind hydration published duplicate state");
    assert(existing.hydrationDiagnostics.length === 3 &&
        existing.hydrationDiagnostics.at(-1).coordinator.reason === "bind",
    "constructor/listener/bind hydration reasons were not diagnosed");
    const initialRaw = existing.hydrationDiagnostics.at(-1);

    assert(initialRaw.previous.getterCalled &&
        initialRaw.previous.hasHandle === true &&
        initialRaw.previous.permission === "prompt",
    "raw Previous getter diagnostic lost its returned state");
    assert(initialRaw.snapshot.getterCalled && initialRaw.snapshot.provisional &&
        initialRaw.snapshot.cachedCount === 1123,
    "raw Snapshot getter diagnostic lost its returned state");
    assert(initialRaw.coordinator.permission === "prompt" &&
        initialRaw.coordinator.hasHandle === true &&
        initialRaw.coordinator.libraryState === "provisional" &&
        initialRaw.coordinator.runtimeBuildId === "local",
    "correct raw getter state was lost during Coordinator hydration");
    assert(existing.coordinator.getDiagnostic().runtimeBuildId === "local" &&
        existing.coordinator.getDiagnostic().runtimeMarkerSource === "loaded",
    "runtime module marker was not published independently of hydration output");
    existing.eventBus.emit("library:provisional-state-changed", {
        provisional: true
    });
    assert(existing.published.length === 1,
        "unchanged provisional notification published duplicate state");
    const beforeSidebarHydration = existing.hydrationDiagnostics.length;

    existing.eventBus.emit("library:sidebar-opened");
    assert(existing.hydrationDiagnostics.length === beforeSidebarHydration + 1 &&
        existing.hydrationDiagnostics.at(-1).coordinator.reason ===
            "sidebar-open",
    "sidebar open did not re-read current hydration sources");

    const later = createHydrationHarness();

    later.setPrevious({ permission: "prompt", hasHandle: true });
    assert(later.coordinator.getDiagnostic().libraryState === "none" &&
        !later.coordinator.getDiagnostic().canManualRefresh,
    "Previous state alone incorrectly enabled provisional refresh");
    later.setSnapshot({
        provisional: true, libraryState: "provisional", cachedCount: 1123
    });
    assertManualRefreshState(later.coordinator.getDiagnostic(),
        "late Previous then provisional state did not converge");

    const provisionalFirst = createHydrationHarness({
        snapshotState: {
            provisional: true,
            libraryState: "provisional",
            cachedCount: 1123
        }
    });

    assert(provisionalFirst.coordinator.getDiagnostic().libraryState ===
        "provisional",
    "pre-existing provisional state was not hydrated");
    provisionalFirst.setPrevious({ permission: "prompt", hasHandle: true });
    assertManualRefreshState(provisionalFirst.coordinator.getDiagnostic(),
        "provisional then late Previous state did not converge");
}

function testRefreshContextGetters() {
    const handle = { kind: "directory" };
    const previous = new PreviousLibraryCoordinator({
        store: {}, scanner: {}, toolbar: {},
        accessPanel: {
            setPreviousLibraryAction() {}, setManualLibraryAction() {}
        },
        statusBar: {}, canSwitchLibrary: () => true,
        flushViewState() {}, beforeLoad() {}, applyLibrary() {},
        getCurrentLibrary: () => null
    });

    previous.previousHandle = handle;
    previous.previousPermission = "prompt";
    previous.persistenceStatus = "saved / prompt";
    previous.persistenceInitializationStage = "complete";
    const previousContext = previous.getRefreshContext();

    assert(previousContext.handle === handle && previousContext.hasHandle &&
        previousContext.permission === "prompt" &&
        previousContext.handleType === "directory" &&
        previousContext.initialized &&
        previousContext.status === "saved / prompt" &&
        Object.isFrozen(previousContext),
    "Previous Library current refresh context was incomplete");

    const snapshot = new LibrarySnapshotService({});

    snapshot.provisional = true;
    snapshot.provisionalPaths = new Set(["A.gpx", "B.gpx", "C.gpx"]);
    snapshot.cacheNamespace = "local:test";
    const snapshotContext = snapshot.getRefreshContext();

    assert(snapshotContext.provisional &&
        snapshotContext.libraryState === "provisional" &&
        snapshotContext.cachedCount === 3 &&
        snapshotContext.libraryIdentity === "local:test" &&
        Object.isFrozen(snapshotContext),
    "Fast Restore current refresh context was incomplete");
}

try {
    await testFreshRecursiveScan();
    await testRefreshAndReconciliation();
    await testIncrementalTreeDomReconcile();
    await testFastRefreshScale();
    testRefreshCompletionFeedback();
    if (!focusedIncremental) {
        await testPromptDoesNotRequestOrScan();
        testInitialStateHydrationOrdering();
        testRefreshContextGetters();
    }
    output.textContent = `PASS: ${assertions} assertions`;
    document.documentElement.dataset.testStatus = "pass";
} catch (error) {
    output.textContent = `FAIL: ${error.message}\n${error.stack}`;
    document.documentElement.dataset.testStatus = "fail";
}
