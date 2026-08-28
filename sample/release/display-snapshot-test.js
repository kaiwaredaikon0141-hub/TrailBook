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
        sidebarState: { open: false, width: 320, trackInfoHeight: 200 }
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
        getViewState: () => ({ lat: 36, lng: 136, zoom: 11 }),
        invalidateSize: () => {},
        displayGPX: (path, result) => {
            displays.push({ path, result });
            order.push(`display:${path}`);
        },
        setSelectedPath: path => { order.push(`select:${path}`); }
    };
    const metrics = [];
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

    coordinator.setLibraryContext({
        libraryIdentity: "root-name:GPX",
        cacheNamespace: "local-cache"
    });
    displayState.setLibrary({});
    displayState.registerFile("one.gpx", {}, "#123456");
    displayState.setChecked("one.gpx", true);
    timers.at(-1)();
    await Promise.resolve();
    await Promise.resolve();
    assert(writes.length === 1, "debounced snapshot was not saved");
    assert(writes[0].visibleTracks[0].geometryCacheKey.namespace ===
        "local-cache", "local cache namespace lost");

    coordinator.setLibraryContext({
        libraryIdentity: "root-name:OTHER",
        cacheNamespace: "other-cache"
    });
    timers.at(-1)();
    await Promise.resolve();
    await Promise.resolve();
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

    coordinator.markLibraryReady();
    coordinator.markLibraryReady();
    assert(metrics.length === 1, "startup metrics emitted more than once");
    assert(metrics[0].restoredTrackCount === 1 &&
        metrics[0].cacheMissCount === 1, "startup metrics incorrect");
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
    await testDriveIdentityAndNoHandleDependency();
    output.textContent = `PASS: ${assertions} assertions`;
    document.documentElement.dataset.testStatus = "pass";
} catch (error) {
    output.textContent = `FAIL: ${error.message}\n${error.stack}`;
    document.documentElement.dataset.testStatus = "fail";
}
