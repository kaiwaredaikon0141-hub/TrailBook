import LibraryRefreshCoordinator from "../../src/js/core/LibraryRefreshCoordinator.js";
import EventBus from "../../src/js/core/EventBus.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import Folder from "../../src/js/models/Folder.js";
import Library from "../../src/js/models/Library.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";
import TreeMetadataBuilder from "../../src/js/ui/TreeMetadataBuilder.js";
import FolderScanner from "../../src/js/services/FolderScanner.js";
import LibrarySnapshotService from "../../src/js/services/LibrarySnapshotService.js";
import PreviousLibraryCoordinator from "../../src/js/core/PreviousLibraryCoordinator.js";

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
        async render(value) {
            const prepared = builder.build(value);
            this.nodeMetadata = prepared.nodeMetadata;
            this.entries = builder.getFileEntries(this.nodeMetadata);
        },
        getFileEntries() { return this.entries; },
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
    const summaries = [oldA, oldB, oldD, oldF].map((handle, index) =>
        summaryBuilder.build(handle.name, {
            name: handle.name,
            size: [10, 20, 40, 50][index],
            lastModified: 1
        }, null)
    );
    const discoveryCalls = [];
    const discovery = {
        getSnapshotState: () => ({ entries: summaries }),
        reconcileLibrary(value) { discoveryCalls.push(value); return true; }
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
    selectionState.select("B.gpx", "test");
    const removed = [];
    const reloaded = [];
    const invalidated = [];
    let currentLibrary = null;
    let scanCount = 0;
    let previousOpenCount = 0;
    let snapshotUpdates = 0;
    let updateContext = null;
    let now = 100;
    const eventBus = new EventBus();
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
        librarySnapshotService: { isProvisional: () => true },
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
        getColor: path => path === "C.gpx" ? "#555555" : "#666666",
        removePath: path => removed.push(path),
        reloadVisiblePath: async value => reloaded.push(value.path),
        onLibraryUpdated: (value, context) => {
            snapshotUpdates += 1;
            updateContext = context;
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
    assert(result.added === 2 && result.removed === 1 && result.modified === 1,
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
        displayState.getDisplay("F.gpx")?.color === "#333333",
    "existing colors were reassigned after scan-order changes");
    assert(displayState.getDisplay("C.gpx")?.color === "#555555" &&
        displayState.getDisplay("E.gpx")?.color === "#666666",
    "new Tracks did not receive newly resolved colors");
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
    assert(snapshotUpdates === 1,
        "reconciled Tree metadata was not offered to Snapshot persistence");
    assert(updateContext?.preserveExistingPresentation === true,
        "incremental refresh allowed Folder color presentation reassignment");
    assert(coordinator.getDiagnostic().scannedCount === 5 &&
        coordinator.getDiagnostic().addedCount === 2,
    "refresh diagnostic did not report actual/cached diff counts");
    const performance = coordinator.getDiagnostic().performance;

    assert(performance.mode === "incremental" &&
        performance.scannedCount === 5 &&
        performance.unchangedCount === 2 &&
        performance.addedCount === 2 &&
        performance.removedCount === 1 &&
        performance.modifiedCount === 1,
    "incremental refresh performance counters lost diff results");
    assert(performance.getFileCount === 5 &&
        performance.existingGetFileCount === 3 &&
        performance.addedGetFileCount === 2 &&
        performance.existingMetadataValidationCount === 3 &&
        performance.addedMetadataValidationCount === 2 &&
        performance.bodyReadCount === 0 && performance.parseCount === 0 &&
        performance.metadataExtractionCount === 2 &&
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
    await testPromptDoesNotRequestOrScan();
    testInitialStateHydrationOrdering();
    testRefreshContextGetters();
    output.textContent = `PASS: ${assertions} assertions`;
    document.documentElement.dataset.testStatus = "pass";
} catch (error) {
    output.textContent = `FAIL: ${error.message}\n${error.stack}`;
    document.documentElement.dataset.testStatus = "fail";
}
