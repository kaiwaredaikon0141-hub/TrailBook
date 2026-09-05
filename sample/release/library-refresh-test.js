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
import LibraryDiscoveryIndexService from
    "../../src/js/services/LibraryDiscoveryIndexService.js";
import LibraryTrackCatalog, {
    LibraryPathCollisionError,
    normalizeTrackRelativePath
} from "../../src/js/core/LibraryTrackCatalog.js";
import LibraryTrackCatalogCoordinator from
    "../../src/js/core/LibraryTrackCatalogCoordinator.js";
import TrackSourceResolver, {
    isTrackSourceUnavailable
} from "../../src/js/core/TrackSourceResolver.js";
import { settleUnavailableTrackDisplay } from
    "../../src/js/core/TrackDisplaySourceBoundary.js";

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
    const scanDiagnostic = diagnostic.getLastScanDiagnostic();

    assert(scanDiagnostic.directoryEntryCount === 4 &&
        scanDiagnostic.gpxCandidateCount === 2 &&
        scanDiagnostic.totalFileCount === 2 &&
        scanDiagnostic.totalDirectoryCount === 2 &&
        scanDiagnostic.rootHandleName === "GPX" &&
        scanDiagnostic.rootHandleKind === "directory" &&
        scanDiagnostic.gpxTailPaths.join("|") ===
            "root.gpx|Trips/nested.gpx" &&
        typeof scanDiagnostic.enumerationStartedAt === "string" &&
        typeof scanDiagnostic.enumerationFinishedAt === "string",
    "recursive enumeration diagnostic did not count actual yielded entries");
}

async function testLibraryTrackCatalog() {
    const libraryA = "local:library-a";
    const libraryB = "local:library-b";
    const catalog = new LibraryTrackCatalog();
    const handles = Array.from({ length: 1123 }, (_, index) =>
        fileHandle(`Track-${index}.gpx`, index + 1, index + 1)
    );

    catalog.replaceFromCompleteScan(libraryA, handles.map(handle => ({
        path: `Trips\\${handle.name}`,
        fileHandle: handle
    })));
    assert(catalog.paths(libraryA).length === 1123,
        "Catalog did not retain 1123 unique normalized Track paths");
    assert(normalizeTrackRelativePath("Trips\\Track-1.gpx") ===
        "Trips/Track-1.gpx",
    "Catalog relativePath normalization is not canonical");
    catalog.replaceProvisional(libraryB, [{
        relativePath: "Trips/Track-1.gpx",
        provisionalMetadata: {
            displayName: "Cached",
            color: "#ff0000",
            checked: true,
            getFile() {},
            queryPermission() {},
            requestPermission() {},
            loader: { getFile() {} },
            status() {}
        }
    }]);
    const cached = catalog.get(libraryB, "Trips/Track-1.gpx");

    assert(cached.actualFileHandle === null &&
        typeof cached.provisionalMetadata.getFile === "undefined" &&
        typeof cached.provisionalMetadata.queryPermission === "undefined" &&
        typeof cached.provisionalMetadata.requestPermission === "undefined" &&
        typeof cached.provisionalMetadata.loader === "undefined" &&
        typeof cached.provisionalMetadata.status === "undefined" &&
        !Object.hasOwn(cached.provisionalMetadata, "color") &&
        !Object.hasOwn(cached.provisionalMetadata, "checked"),
    "provisional Catalog entry exposed a loadable FileHandle capability");
    assert(cached.actualFileHandle !== handles[1],
        "Library B provisional restore inherited Library A actual handle");
    const handleB = fileHandle("Track-1.gpx", 3, 3);
    const actualMetadata = Object.freeze({ source: "actual" });

    catalog.replaceFromCompleteScan(libraryB, [{
        path: "Trips/Track-1.gpx", fileHandle: handleB
    }], {
        metadataByPath: new Map([["Trips/Track-1.gpx", actualMetadata]])
    });
    assert(catalog.get(libraryB, "Trips/Track-1.gpx").actualFileHandle ===
        handleB &&
        catalog.get(libraryB, "Trips/Track-1.gpx").metadata ===
            actualMetadata &&
        catalog.get(libraryB, "Trips/Track-1.gpx").metadataSource === "actual" &&
        catalog.get(libraryB, "Trips/Track-1.gpx")
            .provisionalMetadata.displayName === "Cached",
    "Library B complete scan did not replace the same-path source binding");
    const partial = Array.from({ length: 100 }, (_, index) => ({
        path: `Track-${index}.gpx`,
        fileHandle: fileHandle(`Track-${index}.gpx`, index, index)
    }));

    catalog.replaceFromCompleteScan(libraryB, partial);
    let identityRejected = false;

    try {
        catalog.mergeActual(libraryA, []);
    } catch {
        identityRejected = true;
    }
    assert(identityRejected,
        "partial merge accepted a mismatched Library identity");
    catalog.mergeActual(libraryB, [{
        path: "Track-0.gpx", fileHandle: fileHandle("Track-0.gpx", 2, 2)
    }]);
    assert(catalog.paths(libraryB).length === 100,
        "partial actual merge removed Tracks absent from its input");
    catalog.replaceFromCompleteScan(libraryB, partial.slice(0, 99));
    assert(catalog.paths(libraryB).length === 99 &&
        !catalog.has(libraryB, "Track-99.gpx"),
    "complete scan replacement did not remove its missing Track");
    let invalidRejected = false;

    try {
        catalog.mergeActual(libraryB, [{
            path: "invalid.gpx", fileHandle: { kind: "file" }
        }]);
    } catch {
        invalidRejected = true;
    }
    assert(invalidRejected && !catalog.has(libraryB, "invalid.gpx"),
        "Catalog accepted an actual handle without getFile capability");
    let collision = null;

    try {
        catalog.mergeActual(libraryB, [
            { path: "Trips//a.gpx", fileHandle: fileHandle("a.gpx", 1, 1) },
            { path: "Trips/a.gpx", fileHandle: fileHandle("a.gpx", 1, 1) }
        ]);
    } catch (error) {
        collision = error;
    }
    assert(collision instanceof LibraryPathCollisionError &&
        !catalog.has(libraryB, "Trips/a.gpx"),
    "normalization collision silently overwrote a Catalog entry");
    catalog.replaceFromCompleteScan(libraryB, [
        { path: "root.gpx", fileHandle: fileHandle("root.gpx", 1, 1) },
        {
            path: "Trips/Deep/nested.gpx",
            fileHandle: fileHandle("nested.gpx", 1, 1)
        }
    ]);
    assert(catalog.get(libraryB, "root.gpx").folderPath === "" &&
        catalog.get(libraryB, "Trips/Deep/nested.gpx").folderPath ===
            "Trips/Deep",
    "root or nested Track folder identity was incorrect");
    const removedHandle = catalog.get(libraryB, "root.gpx").actualFileHandle;

    catalog.remove(libraryB, "root.gpx");
    const reboundHandle = fileHandle("root.gpx", 5, 5);

    catalog.mergeActual(libraryB, [{
        path: "root.gpx", fileHandle: reboundHandle
    }]);
    assert(catalog.get(libraryB, "root.gpx").actualFileHandle === reboundHandle &&
        catalog.get(libraryB, "root.gpx").actualFileHandle !== removedHandle,
    "removed/re-added Track retained its old actual source");
    catalog.replaceFromCompleteScan(libraryB, []);
    const diagnostic = catalog.getDiagnostics(libraryB, []);

    assert(diagnostic.pathCount === 0 &&
        diagnostic.actualHandleCount === 0 &&
        diagnostic.provisionalCount === 0 &&
        diagnostic.missingFromCatalog.length === 0 &&
        diagnostic.extraInCatalog.length === 0,
    "empty Library left stale Catalog entries");
    let reported = null;
    const isolated = new LibraryTrackCatalogCoordinator({
        catalog: {
            replaceFromCompleteScan() {
                throw new Error("catalog-only failure");
            }
        },
        reportError: state => { reported = state; }
    });
    let runtimeContinued = false;
    const applied = await isolated.applyCompleteLibrary({
        libraryIdentity: libraryB,
        apply: async () => {
            runtimeContinued = true;
            return true;
        },
        getEntries: () => []
    });

    assert(applied && runtimeContinued && reported?.result === "failure" &&
        reported.errorMessage === "catalog-only failure",
    "Catalog failure was silent or stopped the existing runtime path");
}

async function testCatalogTrackSourceResolution() {
    const libraryA = "local:source-a";
    const libraryB = "local:source-b";
    const path = "Trips/source.gpx";
    const catalog = new LibraryTrackCatalog();
    let activeLibrary = libraryB;
    let getFileCount = 0;
    const resolver = new TrackSourceResolver({
        catalog,
        getLibraryIdentity: () => activeLibrary
    });
    const provisional = {
        relativePath: path,
        provisionalMetadata: { displayName: "Cached source" }
    };

    catalog.replaceProvisional(libraryB, [provisional]);
    const unavailable = resolver.resolve(path);

    assert(isTrackSourceUnavailable(unavailable) &&
        unavailable.reason === "provisional-only",
    "provisional-only Catalog entry was exposed as a loadable source");
    const displayState = new DisplayState();
    const cachedHandle = {
        kind: "file", name: "source.gpx", provisional: true,
        async getFile() { getFileCount += 1; throw new Error("must not load"); }
    };

    displayState.setLibrary({ kind: "directory" });
    displayState.registerFile(path, cachedHandle, "#123456");
    displayState.setChecked(path, true);
    const restoredGeometry = { tracks: [{ segments: [] }] };

    displayState.setLoaded(path, restoredGeometry);
    displayState.setCachedResult(path, restoredGeometry);
    const treeCalls = [];
    let removedMapLayers = 0;
    const displayBoundary = {
        displayState,
        treeView: {
            setDisplayIdle: value => treeCalls.push(["idle", value]),
            setDisplayChecked: (value, checked) =>
                treeCalls.push(["checked", value, checked])
        },
        mapView: { removeGPX() { removedMapLayers += 1; } },
        updateDisplayStatus() {},
        scheduleSearchRefresh() {}
    };
    const preserved = settleUnavailableTrackDisplay(
        displayBoundary,
        path,
        unavailable,
        { rollbackRequested: false }
    );

    assert(preserved && displayState.getDisplay(path).checked &&
        displayState.getDisplay(path).state === "loaded" &&
        displayState.getDisplay(path).error === null &&
        displayState.getCachedResult(path) === restoredGeometry &&
        removedMapLayers === 0 && treeCalls.length === 0,
    "Fast Restore display was mutated by a source-unavailable result");
    displayState.setChecked(path, false);
    displayState.setIdle(path);
    displayState.setChecked(path, true);
    displayState.setLoading(path, 2);
    const settled = settleUnavailableTrackDisplay({
        ...displayBoundary
    }, path, unavailable, { rollbackRequested: true });
    const display = displayState.getDisplay(path);

    assert(settled && getFileCount === 0 && !display.checked &&
        display.state === "idle" && display.error === null &&
        treeCalls.some(call => call[0] === "checked" && call[2] === false),
    "source unavailable became a Viewer error or attempted provisional getFile");
    const discoveryLoader = new GPXGeometryLoader({
        parser: { parse: () => { throw new Error("must not parse"); } },
        repository: {}
    });
    const discovery = new LibraryDiscoveryIndexService({
        loader: discoveryLoader,
        sourceResolver: resolver
    });

    discoveryLoader.setSourceResolver(resolver);
    discovery.setLibrary({
        namespace: libraryB,
        generation: 1,
        fileEntries: [{ path, fileHandle: cachedHandle }]
    });
    const provisionalEntries = await discovery.build();

    assert(provisionalEntries[0]?.status === "ready" &&
        discovery.getFailures().size === 0 && getFileCount === 0,
    "provisional-only Discovery entry became an error or read its cached handle");
    const actualHandle = fileHandle("source.gpx", 10, 20);
    const originalGetFile = actualHandle.getFile;

    actualHandle.getFile = async () => {
        getFileCount += 1;
        return originalGetFile();
    };
    catalog.mergeActual(libraryB, [{ path, fileHandle: actualHandle }]);
    const ready = resolver.resolve(path);

    assert(ready.status === "ready" &&
        ready.actualFileHandle === actualHandle,
    "Phase B actual binding did not make the Catalog source ready");
    const loader = new GPXGeometryLoader({
        parser: { parse: () => ({ tracks: [], metadata: {} }) },
        repository: {
            getWithSummary: async () => null,
            set: async () => false
        }
    });

    loader.setLibraryNamespace(libraryB);
    loader.setSourceResolver(resolver);
    const loaded = await loader.load(path, cachedHandle);

    assert(loaded?.tracks?.length === 0 && getFileCount === 1,
        "GPX loader did not use exactly one Catalog actual source read");
    let legacyFallbackReads = 0;
    const failingDiscovery = new LibraryDiscoveryIndexService({
        loader: {
            setLibraryNamespace() {},
            async loadSummary() { throw new Error("actual source failed"); }
        },
        sourceResolver: resolver
    });

    failingDiscovery.setLibrary({
        namespace: libraryB,
        generation: 1,
        fileEntries: [{
            path,
            fileHandle: {
                name: "legacy.gpx",
                async getFile() { legacyFallbackReads += 1; }
            }
        }]
    });
    const failedEntries = await failingDiscovery.build();

    assert(legacyFallbackReads === 0 &&
        failingDiscovery.getFailures().size === 1 &&
        failedEntries[0]?.status === "error",
    "Discovery actual failure read a legacy entry FileHandle fallback");
    activeLibrary = libraryA;
    assert(resolver.resolve(path).reason === "library-mismatch",
        "resolver returned a source from a different active Library");
    const throwingIdentity = new TrackSourceResolver({
        catalog,
        getLibraryIdentity: () => { throw new Error("identity unavailable"); }
    });

    assert(throwingIdentity.resolve(path).reason === "library-mismatch",
        "resolver leaked an identity-provider exception");
    assert(resolver.resolve("../outside.gpx").reason === "missing",
        "resolver leaked an invalid relativePath exception");
    activeLibrary = libraryB;
    catalog.remove(libraryB, path);
    assert(resolver.resolve(path).reason === "missing",
        "removed Catalog Track remained loadable");
}

function createTree(initialLibrary) {
    const builder = new TreeMetadataBuilder();
    const tree = {
        metadataBuilder: builder,
        element: { scrollTop: 0, contains: () => false },
        renderRequestId: 0,
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
        applyFocusState() {},
        parentPath: path => builder.parentPath(path),
        isDescendant(path, candidate) {
            return candidate === "" || path.startsWith(`${candidate}/`);
        },
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
        ["A.gpx", "#f08000"],
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
    displayState.rebindFileHandle("F.gpx", {
        ...oldF,
        provisional: true
    });
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
    let sharedSettingsReconciliations = 0;
    let sharedSettingsReady = false;
    const colorMutations = [];
    let updateContext = null;
    let persistedLibrarySnapshot = null;
    let now = 100;
    const eventBus = new EventBus();
    const originalSetColor = displayState.setColor.bind(displayState);

    displayState.setColor = (path, color) => {
        const changed = originalSetColor(path, color);

        if (changed) colorMutations.push([path, color]);
        return changed;
    };
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
    const refreshCatalog = new LibraryTrackCatalog();

    refreshCatalog.replaceFromCompleteScan(
        "local:GPX",
        tree.getFileEntries()
    );
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
        trackCatalogCoordinator: new LibraryTrackCatalogCoordinator({
            catalog: refreshCatalog
        }),
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
        getColor: () => {
            assert(sharedSettingsReady,
                "Track color resolved before shared settings reconciliation");
            return "#f08000";
        },
        reconcileSharedSettings: async ({
            library: scannedLibrary,
            rootHandle,
            folderPaths
        }) => {
            sharedSettingsReconciliations += 1;
            assert(scannedLibrary === actualLibrary &&
                rootHandle === actualLibrary.rootFolder.handle &&
                folderPaths.includes(""),
            "manual incremental refresh did not reconcile actual shared settings");
            sharedSettingsReady = true;
            return { applied: true, source: "shared-json" };
        },
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
    assert(sharedSettingsReconciliations === 1,
        "manual incremental refresh did not load shared settings exactly once");
    assert(scanCount === 1, "sidebar open did not run exactly one scan");
    assert(previousOpenCount === 0,
        "manual refresh called the full previous-Library reopen path");
    assert(currentLibrary === actualLibrary,
        "incremental refresh did not promote the scanned actual Library");
    assert(result.added === 1 && result.recovered === 1 &&
        result.removed === 1 && result.modified === 0,
        "Library diff counts were incorrect");
    assert(refreshCatalog.has("local:GPX", "D.gpx"),
        "incremental removed candidate deleted its Catalog source binding");
    assert(displayState.getDisplay("C.gpx")?.checked === false &&
        displayState.getDisplay("E.gpx")?.checked === false,
    "new GPX files were not both registered unchecked");
    assert(displayState.getDisplay("A.gpx")?.checked === true,
        "existing visibility was not preserved");
    assert(displayState.getDisplay("F.gpx")?.checked === false,
        "existing hidden state was not preserved");
    assert(displayState.getDisplay("A.gpx")?.color === "#f08000" &&
        displayState.getDisplay("B.gpx")?.color === "#f08000" &&
        displayState.getDisplay("F.gpx")?.color === "#f08000",
    "existing Tracks did not converge to the current Folder color");
    assert(colorMutations.length === 1 &&
        colorMutations[0][0] === "B.gpx" &&
        colorMutations[0][1] === "#f08000",
    "non-no-op refresh did not mutate only a stale existing Track color");
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
    const enumeration = coordinator.getDiagnostic().enumerationDiagnostic;

    assert(enumeration.actualPathCount === 5 &&
        enumeration.knownPathCount === 5 &&
        enumeration.treePathCount === 4 &&
        enumeration.snapshotPathCount === 4 &&
        enumeration.handleSource === "actual" &&
        enumeration.sameAsSavedHandle === true &&
        enumeration.candidatePaths.some(item =>
            item.path === "C.gpx" && !item.known && !item.tree &&
            !item.snapshot
        ),
    "enumeration diagnostic lost actual/known/Tree/Snapshot comparison");
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

    const unavailable = await failedLoader.load(
        "Trips/Denied.gpx",
        deniedHandle
    );

    assert(isTrackSourceUnavailable(unavailable) &&
        unavailable.reason === "provisional-only" &&
        !failedLoaderDiagnostics.some(value => value.stage === "getFile"),
    "GPX loader called getFile or reported an error for provisional-only source");
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
    const trackCatalog = new LibraryTrackCatalog();
    const trackCatalogCoordinator = new LibraryTrackCatalogCoordinator({
        catalog: trackCatalog
    });
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
        trackCatalogCoordinator,
        repository: {},
        getNamespace: () => "local:scale",
        getLibrary: () => currentLibrary,
        setLibrary: value => { currentLibrary = value; },
        getColor: () => "#f08000",
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
    assert(trackCatalog.paths("local:scale").length === existingCount + 2 &&
        trackCatalog.has("local:scale", "New-A.gpx") &&
        trackCatalog.has("local:scale", "New-B.gpx"),
    "incremental refresh did not populate new Tracks in the parallel Catalog");
    assert(displayState.getDisplay("New-A.gpx")?.color === "#f08000" &&
        displayState.getDisplay("New-B.gpx")?.color === "#f08000" &&
        !displayState.getDisplay("New-A.gpx")?.checked &&
        !displayState.getDisplay("New-B.gpx")?.checked,
    "new Tracks did not preserve Folder presentation and unchecked state");
    assert(selectionState.getSelectedPath() === "Track-100.gpx" &&
        tree.renderCount === 1 && tree.reconcileCount === 1,
    "fast refresh lost selection or used a full Tree apply");
}

async function testNoOpRefreshPresentationInvariance() {
    const trackCount = 1123;
    const files = Array.from({ length: trackCount }, (_, index) =>
        fileHandle(`Existing-${index}.gpx`, index + 1, index + 1)
    );
    const scannedFiles = files.map((handle, index) =>
        fileHandle(handle.name, index + 1, index + 1)
    );
    const before = library("NoOp", files);
    const after = library("NoOp", [...scannedFiles].reverse());
    const tree = await createTree(before);
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const trackCatalog = new LibraryTrackCatalog();
    const trackCatalogCoordinator = new LibraryTrackCatalogCoordinator({
        catalog: trackCatalog
    });
    const entries = files.map((handle, index) => ({
        relativePath: handle.name,
        status: "ready",
        index
    }));
    let currentLibrary = before;
    let registerCalls = 0;
    let colorSetCalls = 0;
    let displayNotifications = 0;
    let snapshotUpdates = 0;
    let presentationRefreshes = 0;
    let sharedSettingsReconciliations = 0;
    const folderPresentations = new Map([
        ["", { mode: "auto", resolvedColor: "#AA5500" }],
        ["Trips", { mode: "explicit", resolvedColor: "#0055AA" }]
    ]);
    const beforeFolderPresentations = new Map(folderPresentations);
    const originalRegisterFile = displayState.registerFile.bind(displayState);
    const originalSetColor = displayState.setColor.bind(displayState);

    displayState.registerFile = (...args) => {
        registerCalls += 1;
        return originalRegisterFile(...args);
    };
    displayState.setColor = (...args) => {
        colorSetCalls += 1;
        return originalSetColor(...args);
    };
    tree.getFileEntries().forEach(({ path, fileHandle: handle }, index) => {
        const color = index % 2 === 0 ? "#AA5500" : "#0055AA";

        originalRegisterFile(
            path,
            handle,
            color
        );
        tree.nodeMetadata.get(path).color = color;
    });
    trackCatalog.replaceFromCompleteScan(
        "local:no-op",
        tree.getFileEntries()
    );
    displayState.setChecked("Existing-10.gpx", true);
    displayState.setError(
        "Existing-11.gpx",
        new DOMException("existing error", "NotReadableError")
    );
    tree.nodeMetadata.get("Existing-10.gpx").checked = true;
    tree.nodeMetadata.get("Existing-11.gpx").state = "error";
    tree.nodeMetadata.get("Existing-11.gpx").error =
        displayState.getDisplay("Existing-11.gpx").error;
    selectionState.select("Existing-10.gpx", "test");
    registerCalls = 0;
    const beforeDisplays = new Map([...displayState.getDisplays()].map(
        ([path, display]) => [path, {
            color: display.color,
            checked: display.checked,
            state: display.state,
            error: display.error
        }]
    ));
    const beforeTree = new Map(tree.getFileEntries().map(({ path }) => {
        const metadata = tree.nodeMetadata.get(path);

        return [path, {
            color: metadata.color,
            checked: metadata.checked,
            state: metadata.state,
            error: metadata.error
        }];
    }));
    const beforeTreeOrder = [...tree.nodeMetadata.keys()];
    displayState.subscribe(() => { displayNotifications += 1; });
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
            hasProvisionalPath: () => true,
            getRefreshContext: () => ({
                provisional: true,
                libraryState: "provisional",
                cachedCount: trackCount
            })
        },
        treeView: tree,
        treeReconciler: new TreeIncrementalReconciler(),
        discoveryCoordinator: {
            getSnapshotState: () => ({ entries }),
            reconcileLibrary() { return true; }
        },
        displayState,
        selectionState,
        trackCatalogCoordinator,
        repository: {},
        getNamespace: () => "local:no-op",
        getLibrary: () => currentLibrary,
        setLibrary: value => { currentLibrary = value; },
        getColor: () => "#FF0000",
        reconcileSharedSettings: async () => {
            sharedSettingsReconciliations += 1;
            return { applied: true, colorsChanged: false };
        },
        removePath() {},
        reloadVisiblePath() {},
        onLibraryUpdated: (value, context = {}) => {
            snapshotUpdates += 1;
            if (!context.presentationUnchanged) {
                presentationRefreshes += 1;
                folderPresentations.set("", {
                    mode: "auto",
                    resolvedColor: "#0055AA"
                });
            }
            return true;
        },
        now: () => 100
    });

    const result = await coordinator.refresh({
        reason: "manual-refresh",
        reconnect: true
    });
    const afterDisplays = displayState.getDisplays();

    assert(result.added === 0 && result.recovered === 0 &&
        result.removed === 0 && result.modified === 0,
    "1123 Track no-op fixture unexpectedly produced a diff");
    assert(registerCalls === 0 && colorSetCalls === 0 &&
        displayNotifications === 0 &&
        presentationRefreshes === 0,
        "no-op refresh re-registered Tracks or rebuilt Folder presentation");
    assert(sharedSettingsReconciliations === 1,
        "no-op manual refresh skipped shared settings revalidation");
    assert(snapshotUpdates === 1,
        "no-op refresh skipped required Snapshot/Phase B completion work");
    assert([...beforeDisplays].every(([path, previous]) => {
        const current = afterDisplays.get(path);

        return current?.color === previous.color &&
            current.checked === previous.checked &&
            current.state === previous.state &&
            current.error === previous.error;
    }), "no-op refresh changed existing Track presentation/state");
    assert([...beforeTree].every(([path, previous]) => {
        const current = tree.nodeMetadata.get(path);

        return current?.color === previous.color &&
            current.checked === previous.checked &&
            current.state === previous.state &&
            current.error === previous.error;
    }), "no-op refresh changed Tree metadata presentation/state");
    assert([...tree.nodeMetadata.keys()].every(
        (path, index) => path === beforeTreeOrder[index]
    ), "no-op refresh changed Tree metadata order");
    assert([...beforeFolderPresentations].every(([path, previous]) => {
        const current = folderPresentations.get(path);

        return current?.mode === previous.mode &&
            current.resolvedColor === previous.resolvedColor;
    }), "no-op refresh changed Folder resolved/explicit/auto presentation");
    assert(displayState.getDisplay("Existing-10.gpx")?.fileHandle ===
        scannedFiles[10],
    "no-op refresh did not rebind the actual FileHandle safely");
    assert(trackCatalog.paths("local:no-op").length === trackCount &&
        trackCatalog.get("local:no-op", "Existing-10.gpx")
            ?.actualFileHandle ===
            scannedFiles[10],
    "no-op refresh did not update the parallel Catalog source binding");
    assert(selectionState.getSelectedPath() === "Existing-10.gpx",
        "no-op refresh changed selection");
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
    await testLibraryTrackCatalog();
    await testCatalogTrackSourceResolution();
    await testRefreshAndReconciliation();
    await testIncrementalTreeDomReconcile();
    await testFastRefreshScale();
    await testNoOpRefreshPresentationInvariance();
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
