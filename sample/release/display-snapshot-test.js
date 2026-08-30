import Config from "../../src/js/core/Config.js";
import DisplaySnapshotCoordinator from
    "../../src/js/core/DisplaySnapshotCoordinator.js";
import EventBus from "../../src/js/core/EventBus.js";
import DisplaySnapshotStore from
    "../../src/js/services/DisplaySnapshotStore.js";
import GeometryCacheRepository from
    "../../src/js/services/GeometryCacheRepository.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import TrackDiscoveryEntry from
    "../../src/js/models/TrackDiscoveryEntry.js";
import LibrarySnapshotService from
    "../../src/js/services/LibrarySnapshotService.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class MemoryAdapter {
    constructor(value = null) {
        this.value = value;
        this.writes = [];
    }
    async get() { return this.value; }
    async set(key, value) {
        this.value = value;
        this.writes.push({ key, value });
    }
}

class EventTargetMock {
    constructor() {
        this.listeners = new Map();
        this.visibilityState = "visible";
    }
    addEventListener(name, listener) {
        this.listeners.set(name, listener);
    }
    emit(name) { this.listeners.get(name)?.(); }
}

function snapshot(paths = ["one.gpx", "missing.gpx"]) {
    return {
        schemaVersion: 1,
        revision: 4,
        libraryIdentity: "root-name:GPX",
        cacheNamespace: "local-cache",
        savedAt: 10,
        map: { lat: 35, lng: 135, zoom: 12 },
        visibleTracks: paths.map((relativePath, index) => ({
            relativePath,
            trackIdentity: `track-${index}`,
            geometryCacheKey: {
                namespace: "local-cache",
                relativePath
            },
            displayStyle: { color: index ? "#222222" : "#111111" }
        })),
        selectedTrack: { relativePath: "one.gpx", trackIdentity: "track-0" },
        sidebarState: { open: false, width: 320, trackInfoHeight: 200 },
        library: {
            identity: "root-name:GPX",
            rootName: "GPX",
            folders: ["Trips"],
            entries: paths.map((relativePath, index) => ({
                relativePath,
                folderPath: "",
                originalFileName: relativePath,
                displayName: relativePath.replace(/\.gpx$/i, ""),
                trackNames: [`track-${index}`],
                resolvedDate: index ? null : "2026-08-29",
                pointCount: 2,
                distance: 100,
                status: "ready"
            })),
            mode: "date",
            filter: { query: "one", from: "", to: "" },
            expandedPaths: ["", "Trips"],
            expandedDateIds: ["year:2026", "month:2026-08"]
        }
    };
}

function geometry() {
    return {
        metadata: null,
        tracks: [{ segments: [{ points: [
            { latitude: 35, longitude: 135 },
            { latitude: 35.1, longitude: 135.1 }
        ] }] }],
        waypoints: [],
        warnings: []
    };
}

async function testStore() {
    const adapter = new MemoryAdapter();
    const store = new DisplaySnapshotStore(Config.displaySnapshot, { adapter });

    assert(await store.save(snapshot(["one.gpx"])), "snapshot save failed");
    assert(adapter.writes.length === 1, "snapshot write count incorrect");
    const loaded = await store.load();
    assert(loaded.libraryIdentity === "root-name:GPX", "identity lost");
    assert(loaded.visibleTracks.length === 1, "visible tracks lost");
    assert(loaded.selectedTrack.relativePath === "one.gpx", "selection lost");
    assert(loaded.map.zoom === 12, "map state lost");
    assert(loaded.revision === 4, "snapshot revision lost");
    assert(loaded.library.entries.length === 1,
        "cached Library entries were not persisted");
    assert(loaded.library.mode === "date",
        "cached Library navigation mode was not persisted");

    adapter.value = { ...snapshot(), schemaVersion: 99 };
    assert(await store.load() === null, "unknown snapshot schema accepted");
}

async function testOptimisticGeometryRead() {
    const adapter = new MemoryAdapter();
    const repository = new GeometryCacheRepository(Config.geometryCache, {
        adapter
    });
    const file = { size: 120, lastModified: 500 };
    const result = geometry();
    const summary = new TrackDiscoveryEntry({
        relativePath: "one.gpx",
        originalFileName: "one.gpx",
        displayName: "one",
        trackNames: ["one"],
        pointCount: 2,
        fileSize: 120,
        lastModified: 500
    });

    assert(await repository.set("local-cache", "one.gpx", file, result, summary),
        "geometry seed failed");
    const optimistic = await repository.getDisplaySnapshot(
        "local-cache", "one.gpx"
    );
    assert(optimistic?.result.tracks.length === 1,
        "optimistic cache lookup failed");
    assert(optimistic.fileIdentity.size === 120,
        "cached source identity missing");
    assert(await repository.get("local-cache", "one.gpx", file) !== null,
        "normal validation rejected current source");
    assert(await repository.get("local-cache", "one.gpx", {
        size: 121,
        lastModified: 500
    }) === null, "phase-B size validation did not reject stale cache");
}

async function testCoordinator() {
    const order = [];
    const displays = [];
    const eventBus = new EventBus();
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const documentTarget = new EventTargetMock();
    const windowTarget = new EventTargetMock();
    const timers = [];
    const writes = [];
    const store = {
        config: Config.displaySnapshot,
        async load() {
            order.push("snapshot-load");
            return snapshot();
        },
        async save(value) { writes.push(value); return true; }
    };
    const repository = {
        async getDisplaySnapshot(namespace, path) {
            order.push(`cache:${path}`);
            return path === "one.gpx"
                ? { result: geometry(), summary: { trackNames: ["one"] } }
                : null;
        }
    };
    let sidebar = null;
    const controls = {
        isSidebarOpen: () => true,
        getSidebarWidth: () => 300,
        getTrackInfoHeight: () => 180,
        setSidebarOpen: open => { sidebar = { ...(sidebar || {}), open }; },
        setSidebarWidth: width => { sidebar = { ...(sidebar || {}), width }; },
        setTrackInfoHeight: trackInfoHeight => {
            sidebar = { ...(sidebar || {}), trackInfoHeight };
        }
    };
    const mapView = {
        view: null,
        isValidViewState: value => value?.zoom === 12,
        setViewState(value) { order.push("map-state"); this.view = value; },
        getViewState() { return this.view ?? { lat: 36, lng: 136, zoom: 11 }; },
        invalidateSize: () => {},
        displayGPX: (path, result) => {
            displays.push({ path, result });
            order.push(`display:${path}`);
        },
        setSelectedPath: path => { order.push(`select:${path}`); }
    };
    const metrics = [];
    let libraryReady = 0;
    const coordinator = new DisplaySnapshotCoordinator({
        eventBus,
        store,
        repository,
        mapView,
        controls,
        displayState,
        selectionState,
        getTrackStyle: color => ({ color }),
        getSelectionStyles: color => ({
            selectedMainStyle: { color },
            selectedOutlineStyle: { color: "white" }
        }),
        restoreLibrarySnapshot: async (state, context) => {
            assert(context.restoredTracks.length === 1,
                "cached tree did not receive restored geometry state");
            assert(context.selectedPath === "one.gpx",
                "cached tree did not receive selected Track");
            order.push(`tree:${state.entries.length}`);
            return true;
        },
        captureLibrarySnapshot: () => snapshot(["one.gpx"]).library,
        markLibraryReady: () => { libraryReady += 1; },
        setTimer: callback => { timers.push(callback); return timers.length; },
        clearTimer: () => {},
        documentTarget,
        windowTarget,
        reportMetrics: value => metrics.push(value)
    });

    assert(await coordinator.initialize(), "instant restore reported failure");
    assert(order.indexOf("display:one.gpx") < order.indexOf("cache:missing.gpx"),
        "first cache hit was not displayed immediately");
    assert(displays.length === 1, "partial cache restore did not omit miss");
    assert(selectionState.getSelectedPath() === "one.gpx", "selection not restored");
    assert(sidebar.open === false && sidebar.width === 320,
        "sidebar state not restored");
    assert(coordinator.hasInstantRestore(), "phase-A state missing");
    assert(order.includes("map-state"), "map state not restored");
    assert(order.indexOf("map-state") < order.indexOf("display:one.gpx"),
        "map state was not restored before geometry");
    assert(order.indexOf("select:one.gpx") < order.indexOf("tree:2"),
        "cached tree restored before geometry selection was ready");
    assert(coordinator.getStatus().restoreState === "phaseA",
        "phase-A lifecycle state missing");

    displayState.setLibrary({});
    displayState.registerFile("one.gpx", {}, "#123456");
    displayState.registerFile("missing.gpx", {}, "#654321");
    displayState.setChecked("one.gpx", true);
    displayState.setChecked("missing.gpx", true);
    assert(timers.length === 0,
        "phase-A display changes scheduled a snapshot overwrite");
    documentTarget.visibilityState = "hidden";
    documentTarget.emit("visibilitychange");
    windowTarget.emit("pagehide");
    await Promise.resolve();
    assert(writes.length === 0,
        "phase-A lifecycle event overwrote the last-known-good snapshot");

    coordinator.beginPhaseB();
    coordinator.setLibraryContext({
        libraryIdentity: "root-name:GPX",
        cacheNamespace: "local-cache"
    });
    documentTarget.emit("visibilitychange");
    windowTarget.emit("pagehide");
    await Promise.resolve();
    assert(writes.length === 0,
        "phase-B lifecycle event overwrote the last-known-good snapshot");
    assert(await coordinator.completePhaseB({ restored: true }),
        "phase-B reconciliation did not commit");
    assert(writes.length === 1, "phase-B snapshot was not saved");
    assert(writes[0].revision === 5, "snapshot revision was not advanced");
    assert(writes[0].visibleTracks[0].geometryCacheKey.namespace ===
        "local-cache", "local cache namespace lost");
    assert(writes[0].visibleTracks.length === 2,
        "partial cache miss discarded an existing snapshot reference");
    assert(writes[0].visibleTracks.some(
        track => track.relativePath === "missing.gpx"
    ), "missing cache reference was not retained for revalidation");
    assert(writes[0].selectedTrack.relativePath === "one.gpx",
        "selection was not preserved by phase-B commit");
    assert(writes[0].map.zoom === 12,
        "phase-B replaced the snapshot map view");
    assert(writes[0].library.entries.length === 1,
        "phase-B omitted lightweight Library metadata");
    assert(libraryReady === 1, "actual Library did not leave provisional mode");
    assert(coordinator.getStatus().restoreState === "ready",
        "ready lifecycle state missing");

    coordinator.beginPhaseB();
    coordinator.setLibraryContext({
        libraryIdentity: "root-name:OTHER",
        cacheNamespace: "other-cache"
    });
    assert(await coordinator.completePhaseB({ restored: true }),
        "Library switch snapshot was not committed");
    assert(writes.at(-1).libraryIdentity === "root-name:OTHER",
        "Library switch retained old snapshot identity");
    assert(writes.at(-1).visibleTracks[0].geometryCacheKey.namespace ===
        "other-cache", "Library switch mixed old cache namespace");

    documentTarget.visibilityState = "hidden";
    documentTarget.emit("visibilitychange");
    await Promise.resolve();
    windowTarget.emit("pagehide");
    await Promise.resolve();
    assert(writes.length >= 2, "lifecycle best-effort save missing");

    assert(metrics.length === 1, "startup metrics emitted more than once");
    assert(metrics[0].restoredTrackCount === 1 &&
        metrics[0].cacheMissCount === 1, "startup metrics incorrect");
}

async function testLibrarySnapshotService() {
    const events = [];
    const eventBus = { emit: (name, value) => events.push({ name, value }) };
    const selected = [];
    const rendered = [];
    const provisional = [];
    const accessStates = [];
    const removed = [];
    const statusLibraries = [];
    let actualFileEntries = [];
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const discoveryEntry = new TrackDiscoveryEntry({
        relativePath: "Trips/one.gpx",
        folderPath: "Trips",
        originalFileName: "one.gpx",
        displayName: "Morning Ride",
        trackNames: ["Morning Ride"],
        resolvedDate: "2026-08-29",
        pointCount: 2,
        distance: 100
    });
    const treeView = {
        expandedPaths: new Set(["", "Trips"]),
        getSearchSourceEntries: () => [
            { kind: "folder", path: "Trips", name: "Trips" },
            { kind: "file", path: "Trips/one.gpx", name: "one.gpx" }
        ],
        getFileEntries: () => actualFileEntries,
        async render(library, options) { rendered.push({ library, options }); },
        setDisplayChecked: () => {},
        setDisplayLoaded: () => {},
        setSelectedPath: (path, options) => selected.push({ path, options })
    };
    const discoveryCoordinator = {
        getSnapshotState: () => ({
            entries: [discoveryEntry], mode: "date",
            filter: { query: "ride", from: "", to: "" },
            expandedDateIds: ["year:2026", "month:2026-08"]
        }),
        setProvisionalLibrary: state => provisional.push(state)
    };
    const service = new LibrarySnapshotService({
        treeView,
        discoveryCoordinator,
        displayState,
        searchView: { setAvailable: () => {} },
        accessPanel: {
            setProvisionalLibrary: value => accessStates.push(value)
        },
        eventBus,
        mapView: { removeGPX: path => removed.push(path) },
        selectionState,
        getColor: () => "#123456",
        statusBar: {
            showLibraryLoaded: library => statusLibraries.push(library.name)
        }
    });
    const state = service.capture({
        libraryIdentity: "root-name:GPX",
        rootName: "GPX"
    });

    assert(Number.isFinite(state.entries[0].resolvedDate),
        "Date Tree metadata was not captured");
    assert(state.mode === "date" && state.filter.query === "ride",
        "mode/filter state was not captured");
    assert(state.entries[0].color === "#123456",
        "cached Library Track color was not captured");
    assert(await service.restore(state, {
        cacheNamespace: "local-cache",
        restoredTracks: [{
            path: "Trips/one.gpx", result: geometry(), color: "#123456"
        }],
        selectedPath: "Trips/one.gpx"
    }), "cached Library tree restore failed");
    assert(rendered[0].library.gpxFileCount === 1,
        "cached Folder Tree file count incorrect");
    assert(rendered[0].options.preserveNavigation,
        "cached Folder Tree navigation was not restored");
    assert(provisional[0].entries[0].resolvedDate instanceof Date,
        "cached Date/Search entry was not restored");
    assert(displayState.getDisplay("Trips/one.gpx")?.state === "loaded",
        "visible Track check/load state was not restored");
    assert(displayState.getDisplay("Trips/one.gpx")?.color === "#123456",
        "cached Library Track color was not restored");
    assert(selected[0].path === "Trips/one.gpx",
        "cached selected Track was not restored");
    assert(service.isProvisionalFor("local-cache"),
        "cached Library was not marked provisional");
    assert(statusLibraries[0] === "GPX",
        "cached Library left the stale open-Library status message visible");
    assert(accessStates[0] === true && events[0].value.provisional,
        "viewer-only availability was not announced");
    selectionState.select("Trips/one.gpx", "system");
    actualFileEntries = [];
    service.reconcileActual();
    assert(removed[0] === "Trips/one.gpx" &&
        selectionState.getSelectedPath() === null,
    "removed actual file left stale geometry or selection");
    assert(!service.isProvisional() && accessStates.at(-1) === false,
        "actual Library reconciliation did not restore write availability");
    assert(events.at(-1).name === "library:provisional-state-changed" &&
        events.at(-1).value.provisional === false,
    "actual Library reconciliation did not announce ready availability");
}

async function testLastKnownGoodAcrossRestarts() {
    const persisted = new MemoryAdapter(snapshot(["one.gpx"]));
    const store = new DisplaySnapshotStore(Config.displaySnapshot, {
        adapter: persisted
    });
    const repository = {
        async getDisplaySnapshot(namespace, path) {
            return namespace === "local-cache" && path === "one.gpx"
                ? { result: geometry(), summary: { trackNames: ["one"] } }
                : null;
        }
    };
    const revisionSequence = [];

    for (let restart = 0; restart < 3; restart += 1) {
        const eventBus = new EventBus();
        const displayState = new DisplayState();
        const selectionState = new SelectionState();
        const documentTarget = new EventTargetMock();
        const windowTarget = new EventTargetMock();
        const displayed = [];
        const coordinator = new DisplaySnapshotCoordinator({
            eventBus,
            store,
            repository,
            mapView: {
                isValidViewState: () => true,
                setViewState: () => {},
                getViewState: () => ({ lat: 35, lng: 135, zoom: 12 }),
                invalidateSize: () => {},
                displayGPX: path => displayed.push(path),
                setSelectedPath: () => {}
            },
            controls: {
                isSidebarOpen: () => true,
                getSidebarWidth: () => 320,
                getTrackInfoHeight: () => 200,
                setSidebarOpen: () => {},
                setSidebarWidth: () => {},
                setTrackInfoHeight: () => {}
            },
            displayState,
            selectionState,
            getTrackStyle: color => ({ color }),
            getSelectionStyles: color => ({
                selectedMainStyle: { color },
                selectedOutlineStyle: { color: "white" }
            }),
            documentTarget,
            windowTarget,
            reportMetrics: () => {}
        });

        assert(await coordinator.initialize(),
            `restart ${restart + 1} did not restore cached geometry`);
        assert(displayed.length === 1,
            `restart ${restart + 1} restored an incorrect display count`);
        assert(selectionState.getSelectedPath() === "one.gpx",
            `restart ${restart + 1} lost selection`);

        coordinator.beginPhaseB();
        displayState.setLibrary({});
        documentTarget.visibilityState = "hidden";
        documentTarget.emit("visibilitychange");
        await Promise.resolve();
        assert(persisted.value.visibleTracks.length === 1,
            `restart ${restart + 1} task-kill replaced snapshot with empty state`);

        displayState.registerFile("one.gpx", {}, "#123456");
        displayState.setChecked("one.gpx", true);
        selectionState.select("one.gpx", "view-state-restore");
        coordinator.setLibraryContext({
            libraryIdentity: "root-name:GPX",
            cacheNamespace: "local-cache"
        });
        assert(await coordinator.completePhaseB({ restored: true }),
            `restart ${restart + 1} phase-B commit failed`);
        revisionSequence.push(persisted.value.revision);
    }

    assert(revisionSequence.join(",") === "5,6,7",
        "restart commits did not advance monotonically");
    assert(persisted.value.visibleTracks.length === 1,
        "restart cycle lost visible Track references");
    assert(persisted.value.selectedTrack.relativePath === "one.gpx",
        "restart cycle lost selected Track");
    assert(persisted.value.cacheNamespace === "local-cache",
        "restart cycle lost Geometry Cache namespace");
}

async function testEmptyPhaseBDoesNotReplaceKnownGood() {
    const adapter = new MemoryAdapter(snapshot(["one.gpx"]));
    const store = new DisplaySnapshotStore(Config.displaySnapshot, { adapter });
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const coordinator = new DisplaySnapshotCoordinator({
        eventBus: new EventBus(),
        store,
        repository: {
            async getDisplaySnapshot(namespace, path) {
                return path === "one.gpx"
                    ? { result: geometry(), summary: { trackNames: ["one"] } }
                    : null;
            }
        },
        mapView: {
            isValidViewState: () => true,
            setViewState: () => {},
            getViewState: () => ({ lat: 35, lng: 135, zoom: 12 }),
            invalidateSize: () => {},
            displayGPX: () => {},
            setSelectedPath: () => {}
        },
        controls: {
            isSidebarOpen: () => true,
            getSidebarWidth: () => 320,
            getTrackInfoHeight: () => 200,
            setSidebarOpen: () => {},
            setSidebarWidth: () => {},
            setTrackInfoHeight: () => {}
        },
        displayState,
        selectionState,
        getTrackStyle: color => ({ color }),
        getSelectionStyles: color => ({
            selectedMainStyle: { color },
            selectedOutlineStyle: { color: "white" }
        }),
        documentTarget: new EventTargetMock(),
        windowTarget: new EventTargetMock(),
        reportMetrics: () => {}
    });

    await coordinator.initialize();
    coordinator.beginPhaseB();
    displayState.setLibrary({});
    coordinator.setLibraryContext({
        libraryIdentity: "root-name:GPX",
        cacheNamespace: "local-cache"
    });
    assert(!await coordinator.completePhaseB({ restored: true }),
        "temporary empty phase-B state replaced last-known-good snapshot");
    assert(adapter.value.visibleTracks.length === 1,
        "last-known-good visible state was not preserved");
    assert(coordinator.getStatus().lastWriteStatus ===
        "preserved-last-known-good", "empty-state suppression was not reported");

    displayState.registerFile("one.gpx", {}, "#123456");
    displayState.setChecked("one.gpx", true);
    selectionState.clear("restore-incomplete");
    assert(!await coordinator.completePhaseB({ restored: true }),
        "phase-B committed before selected Track restoration completed");
    assert(adapter.value.selectedTrack.relativePath === "one.gpx",
        "incomplete selection replaced last-known-good selection");

    selectionState.select("one.gpx", "view-state-restore");
    assert(await coordinator.completePhaseB({ restored: true }),
        "valid phase-B state did not commit after selection restoration");
}

async function testDriveIdentityAndNoHandleDependency() {
    const value = snapshot(["drive.gpx"]);
    value.libraryIdentity = "drive-library";
    value.cacheNamespace = "drive:root-id";
    value.visibleTracks[0].geometryCacheKey = {
        namespace: "drive:root-id",
        relativePath: "drive.gpx"
    };
    value.selectedTrack = null;
    const adapter = new MemoryAdapter(value);
    const store = new DisplaySnapshotStore(Config.displaySnapshot, { adapter });
    const loaded = await store.load();

    assert(loaded.cacheNamespace === "drive:root-id", "Drive namespace lost");
    assert(!Object.hasOwn(loaded, "directoryHandle"),
        "snapshot unexpectedly depends on DirectoryHandle");
}

try {
    await testStore();
    await testOptimisticGeometryRead();
    await testCoordinator();
    await testLibrarySnapshotService();
    await testLastKnownGoodAcrossRestarts();
    await testEmptyPhaseBDoesNotReplaceKnownGood();
    await testDriveIdentityAndNoHandleDependency();
    output.textContent = `PASS: ${assertions} assertions`;
    document.documentElement.dataset.testStatus = "pass";
} catch (error) {
    output.textContent = `FAIL: ${error.message}\n${error.stack}`;
    document.documentElement.dataset.testStatus = "fail";
}
