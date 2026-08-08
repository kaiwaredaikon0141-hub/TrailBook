import Config from "../../src/js/core/Config.js";
import App from "../../src/js/core/App.js";
import EventBus from "../../src/js/core/EventBus.js";
import ViewStateCoordinator from "../../src/js/core/ViewStateCoordinator.js";
import PreviousLibraryCoordinator from "../../src/js/core/PreviousLibraryCoordinator.js";
import DisplaySettingsStore from "../../src/js/services/DisplaySettingsStore.js";
import GeometryCacheRepository from "../../src/js/services/GeometryCacheRepository.js";
import GPXDisplayQueue from "../../src/js/services/GPXDisplayQueue.js";
import GPXGeometryLoader from "../../src/js/services/GPXGeometryLoader.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";
import PreviousLibraryStore from "../../src/js/services/PreviousLibraryStore.js";
import ViewStateStore from "../../src/js/services/ViewStateStore.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import LibraryAccessPanel from "../../src/js/ui/LibraryAccessPanel.js";
import MapView from "../../src/js/ui/MapView.js";
import Toolbar from "../../src/js/ui/Toolbar.js";
import ViewStateControls from "../../src/js/ui/ViewStateControls.js";
import { createLibraryId } from "../../src/js/utils/LibraryIdentity.js";
import {
    normalizeViewStateDocument
} from "../../src/js/utils/ViewStateSchema.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {

    assertions += 1;

    if (!condition) {
        throw new Error(message);
    }
}

class MemoryStorage {

    constructor(initial = {}) {
        this.values = new Map(Object.entries(initial));
        this.writes = [];
        this.throwOnRead = false;
        this.throwOnWrite = false;
    }

    getItem(key) {
        if (this.throwOnRead) throw new DOMException("denied", "SecurityError");
        return this.values.get(key) ?? null;
    }

    setItem(key, value) {
        if (this.throwOnWrite) throw new DOMException("quota", "QuotaExceededError");
        this.values.set(key, value);
        this.writes.push({ key, value });
    }
}

class MemoryHandleAdapter {

    constructor() {
        this.value = null;
        this.writes = [];
        this.deletes = 0;
        this.failRead = false;
        this.failWrite = false;
    }

    async get() {
        if (this.failRead) throw new Error("IndexedDB read failure");
        return this.value;
    }

    async set(key, value) {
        if (this.failWrite) throw new Error("IndexedDB write failure");
        this.value = value;
        this.writes.push({ key, value });
    }

    async delete() {
        this.value = null;
        this.deletes += 1;
    }
}

class MemoryGeometryAdapter {

    constructor() {
        this.values = new Map();
        this.reads = 0;
        this.writes = 0;
        this.deletes = 0;
        this.failRead = false;
        this.failWrite = false;
    }

    async get(key) {
        this.reads += 1;
        if (this.failRead) throw new Error("IndexedDB read failure");
        return this.values.get(key) ?? null;
    }

    async set(key, value) {
        if (this.failWrite) throw new DOMException("quota", "QuotaExceededError");
        this.values.set(key, value);
        this.writes += 1;
    }

    async delete(key) {
        this.values.delete(key);
        this.deletes += 1;
    }
}

function createDirectoryHandle(name, {
    query = "granted",
    request = "granted"
} = {}) {

    return {
        kind: "directory",
        name,
        queryCalls: 0,
        requestCalls: 0,
        async queryPermission(options) {
            this.queryCalls += 1;
            assert(options.mode === "read", "query requested non-read permission");
            return query;
        },
        async requestPermission(options) {
            this.requestCalls += 1;
            assert(options.mode === "read", "request requested non-read permission");
            return request;
        }
    };
}

function state(overrides = {}) {

    return {
        map: { lat: 35, lng: 135, zoom: 10 },
        visibleTracks: [],
        selectedTrack: null,
        sidebar: { open: true },
        ...overrides
    };
}

function createStore(storage = new MemoryStorage(), overrides = {}) {

    return new ViewStateStore({
        ...Config.viewState,
        storage,
        ...overrides
    });
}

function testIdentityAndSchema() {

    assert(createLibraryId(" GPX Log ") === "root-name:GPX%20Log", "trim/encode identity");
    assert(createLibraryId("日本語") === "root-name:%E6%97%A5%E6%9C%AC%E8%AA%9E", "Japanese identity");
    assert(createLibraryId("") === "root-name:unnamed", "unnamed identity");
    assert(createLibraryId("same") === createLibraryId("same"), "same-name identity");

    const options = {
        schemaVersion: 1,
        maxVisibleTracks: 5000,
        minZoom: 0,
        maxZoom: 19
    };
    const normalized = normalizeViewStateDocument({
        version: 1,
        libraries: {
            "root-name:GPX": {
                map: { lat: 35, lng: 135, zoom: 11 },
                visibleTracks: ["car/a.gpx", "car/a.gpx", "bike/b.gpx"],
                selectedTrack: "car/a.gpx",
                sidebar: {
                    open: false,
                    width: 384,
                    trackInfoHeight: 300
                },
                futureField: true
            }
        }
    }, options);

    assert(normalized !== null, "valid schema rejected");
    assert(normalized.libraries["root-name:GPX"].map.zoom === 11, "Map lost");
    assert(normalized.libraries["root-name:GPX"].visibleTracks.length === 2, "duplicate path retained");
    assert(normalized.libraries["root-name:GPX"].sidebar.open === false, "sidebar lost");
    assert(normalized.libraries["root-name:GPX"].sidebar.width === 384,
        "sidebar width lost");
    assert(normalized.libraries["root-name:GPX"].sidebar.trackInfoHeight === 300,
        "Track Info height lost");
    assert(!Object.hasOwn(normalized.libraries["root-name:GPX"], "futureField"), "unknown Library field retained");

    const invalidTopLevels = [
        null,
        [],
        { version: 2, libraries: {} },
        { version: 1, libraries: [], extra: true },
        { version: 1, libraries: {}, extra: true }
    ];
    invalidTopLevels.forEach(payload => {
        assert(normalizeViewStateDocument(payload, options) === null, "invalid top-level accepted");
    });

    const partial = normalizeViewStateDocument({
        version: 1,
        libraries: {
            "root-name:GPX": {
                map: { lat: 91, lng: 135, zoom: 10 },
                visibleTracks: ["ok.gpx", "../bad.gpx"],
                selectedTrack: "../bad.gpx",
                sidebar: { open: "yes" }
            }
        }
    }, options).libraries["root-name:GPX"];

    assert(partial.map === null, "invalid Map did not fallback");
    assert(partial.visibleTracks.length === 0, "invalid visible list partially adopted");
    assert(partial.selectedTrack === null, "invalid selection adopted");
    assert(partial.sidebar.open === true, "invalid sidebar did not default open");
    assert(partial.sidebar.width === 260, "invalid sidebar width did not default");
    assert(partial.sidebar.trackInfoHeight === 220,
        "invalid Track Info height did not default");

    for (const map of [
        { lat: NaN, lng: 0, zoom: 1 },
        { lat: 0, lng: Infinity, zoom: 1 },
        { lat: 0, lng: 0, zoom: -1 },
        { lat: 0, lng: 0, zoom: 20 }
    ]) {
        const result = normalizeViewStateDocument({
            version: 1,
            libraries: { "root-name:X": state({ map }) }
        }, options);
        assert(result.libraries["root-name:X"].map === null, "invalid Map accepted");
    }

    const dangerous = normalizeViewStateDocument(JSON.parse(
        '{"version":1,"libraries":{"__proto__":{"sidebar":{"open":false}}}}'
    ), options);
    assert(Object.keys(dangerous.libraries).length === 0, "dangerous Library key accepted");
}

function testStore() {

    const emptyStorage = new MemoryStorage();
    const store = createStore(emptyStorage);
    const a = store.createLibraryId("A");
    const b = store.createLibraryId("B");

    assert(store.getStatus().load === "empty", "missing storage not empty");
    assert(store.getLibraryState(a) === null, "missing Library returned state");
    assert(store.setLibraryState(b, state({ sidebar: { open: false } })), "set B failed");
    assert(store.setLibraryState(a, state()), "set A failed");
    assert(store.hasLibraryState(a), "A missing");
    assert(store.getLibraryState(b).sidebar.open === false, "B state lost");
    assert(emptyStorage.writes.length === 2, "unexpected write count");

    const serialized = emptyStorage.values.get("trailbook.viewState");
    assert(serialized.indexOf(a) < serialized.indexOf(b), "serialization not stable-sorted");
    assert(!serialized.includes("FileHandle"), "handle-like data serialized");
    assert(!serialized.includes("geometry"), "geometry data serialized");
    assert(store.removeLibraryState(a), "remove A failed");
    assert(!store.hasLibraryState(a), "A retained after remove");
    assert(store.hasLibraryState(b), "other Library removed");
    assert(!store.removeLibraryState(a), "second remove reported change");

    const loaded = createStore(emptyStorage);
    assert(loaded.getStatus().load === "loaded", "valid storage not loaded");
    assert(loaded.getLibraryState(b).sidebar.open === false, "loaded state mismatch");

    for (const raw of ["{", JSON.stringify({ version: 2, libraries: {} })]) {
        const invalidStorage = new MemoryStorage({ "trailbook.viewState": raw });
        const invalidStore = createStore(invalidStorage);
        assert(invalidStore.getStatus().persistence === "session-only", "invalid storage not fail closed");
        assert(invalidStore.setLibraryState(a, state()), "session fallback rejected state");
        assert(invalidStorage.writes.length === 0, "invalid raw storage overwritten");
        assert(invalidStore.getLibraryState(a) !== null, "session state unavailable");
    }

    const oversizedStorage = new MemoryStorage({
        "trailbook.viewState": JSON.stringify({ version: 1, libraries: {} })
    });
    const oversized = createStore(oversizedStorage, { maxSerializedBytes: 10 });
    assert(oversized.getStatus().load === "oversize", "oversize storage accepted");
    assert(oversizedStorage.writes.length === 0, "oversize storage overwritten");

    const readFailureStorage = new MemoryStorage();
    readFailureStorage.throwOnRead = true;
    const readFailure = createStore(readFailureStorage);
    assert(readFailure.getStatus().persistence === "session-only", "read failure not fallback");
    assert(readFailure.setLibraryState(a, state()), "read failure blocked session state");

    const writeFailureStorage = new MemoryStorage();
    const writeFailure = createStore(writeFailureStorage);
    writeFailureStorage.throwOnWrite = true;
    assert(writeFailure.setLibraryState(a, state()), "write failure blocked runtime state");
    assert(writeFailure.getStatus().persistence === "session-only", "write failure not fallback");
    assert(writeFailure.getLibraryState(a).map.lat === 35, "write failure lost session state");

    const limited = createStore(new MemoryStorage(), { maxVisibleTracks: 2 });
    assert(limited.setLibraryState(a, state({
        visibleTracks: ["a.gpx", "b.gpx", "c.gpx"]
    })), "limited state rejected entirely");
    assert(limited.getLibraryState(a).visibleTracks.length === 0, "visible limit ignored");

    const uiStorage = new MemoryStorage();
    const uiStore = new DisplaySettingsStore({ storage: uiStorage });
    uiStore.setActiveLibrary("A");
    uiStore.setMapMode("monochrome");
    const before = uiStorage.values.get("trailbook.uiSettings");
    store.removeLibraryState(b);
    assert(uiStorage.values.get("trailbook.uiSettings") === before, "UI settings changed by ViewStateStore");
}

function testMapView() {

    const events = [];
    const eventBus = { emit: (name, data) => events.push({ name, data }) };
    const mapView = new MapView(Config, eventBus);
    let center = { lat: 36, lng: 138 };
    let zoom = 5;
    let setCalls = 0;
    let invalidateCalls = 0;

    assert(mapView.getViewState() === null, "Map before ready returned state");
    assert(!mapView.setViewState({ lat: 0, lng: 0, zoom: 5 }), "Map before ready accepted restore");

    mapView.map = {
        getCenter: () => center,
        getZoom: () => zoom,
        getMinZoom: () => 0,
        getMaxZoom: () => 19,
        setView: ([lat, lng], nextZoom) => {
            center = { lat, lng };
            zoom = nextZoom;
            setCalls += 1;
            mapView.handleMoveEnd();
        },
        invalidateSize: () => {
            invalidateCalls += 1;
            mapView.handleMoveEnd();
        }
    };

    assert(mapView.isValidViewState({ lat: 35, lng: 135, zoom: 11 }), "valid Map rejected");
    assert(!mapView.isValidViewState({ lat: 91, lng: 0, zoom: 1 }), "invalid lat accepted");
    assert(!mapView.isValidViewState({ lat: 0, lng: 181, zoom: 1 }), "invalid lng accepted");
    assert(!mapView.isValidViewState({ lat: 0, lng: 0, zoom: 20 }), "invalid zoom accepted");
    assert(!mapView.isValidViewState({ lat: NaN, lng: 0, zoom: 1 }), "NaN accepted");

    assert(mapView.setViewState({ lat: 35, lng: 135, zoom: 11 }, { silent: true }), "restore failed");
    assert(setCalls === 1, "restore did not use one setView");
    assert(events.at(-1).data.programmatic === true, "restore event not marked programmatic");
    assert(mapView.getViewState().zoom === 11, "restored zoom unavailable");
    assert(mapView.invalidateSize({ silent: true }), "invalidate failed");
    assert(invalidateCalls === 1, "invalidate count");
    assert(events.at(-1).data.programmatic === true, "invalidate event not silent");

    mapView.handleMoveEnd();
    assert(events.at(-1).data.programmatic === false, "user move marked programmatic");
    assert(!mapView.setViewState({ lat: Infinity, lng: 0, zoom: 1 }), "invalid restore applied");
}

function createCoordinatorFixture({
    displayQueue = { whenIdle: () => Promise.resolve() }
} = {}) {

    const eventBus = new EventBus();
    const storage = new MemoryStorage();
    const store = createStore(storage);
    const timers = new Map();
    const cleared = [];
    let timerId = 0;
    let currentGeneration = 1;
    let confirmReset = true;
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    const controls = {
        open: true,
        width: 260,
        trackInfoHeight: 220,
        hasState: false,
        setLibrary({ hasState }) { this.hasState = hasState; },
        setSidebarOpen(open) { this.open = open; },
        isSidebarOpen() { return this.open; },
        setSidebarWidth(width) {
            if (Number.isFinite(width)) this.width = width;
        },
        getSidebarWidth() { return this.width; },
        getDefaultSidebarWidth() { return 260; },
        setTrackInfoHeight(height) {
            if (Number.isFinite(height)) this.trackInfoHeight = height;
        },
        getTrackInfoHeight() { return this.trackInfoHeight; },
        getDefaultTrackInfoHeight() { return 220; },
        setStoredStateAvailable(value) { this.hasState = value; },
        confirmReset() { return confirmReset; }
    };
    const mapView = {
        current: { lat: 35, lng: 135, zoom: 10 },
        restored: null,
        invalidations: 0,
        getViewState() { return { ...this.current }; },
        isValidViewState(value) { return value && Number.isFinite(value.lat); },
        setViewState(value, options) {
            this.restored = { value: { ...value }, options };
            eventBus.emit("map:view-changed", { programmatic: true });
            return true;
        },
        invalidateSize() { this.invalidations += 1; return true; },
        hasDisplay(path) {
            return displayState.getDisplay(path)?.state === "loaded";
        }
    };
    const coordinator = new ViewStateCoordinator({
        eventBus,
        store,
        mapView,
        controls,
        displayState,
        displayQueue,
        selectionState,
        debounceMs: 750,
        setTimer(callback, delay) {
            const id = ++timerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimer(id) {
            cleared.push(id);
            timers.delete(id);
        }
    });

    return {
        eventBus,
        storage,
        store,
        controls,
        mapView,
        displayState,
        selectionState,
        coordinator,
        timers,
        cleared,
        setGeneration(value) { currentGeneration = value; },
        isCurrent(generation) { return () => generation === currentGeneration; },
        setConfirm(value) { confirmReset = value; },
        runTimer() {
            const [id, timer] = timers.entries().next().value;
            timers.delete(id);
            timer.callback();
        }
    };
}

async function testCoordinator() {

    const fixture = createCoordinatorFixture();
    const a = fixture.store.createLibraryId("A");
    const b = fixture.store.createLibraryId("B");

    assert(await fixture.coordinator.restoreLibrary({
        libraryId: a,
        libraryName: "A",
        generation: 1,
        isCurrent: fixture.isCurrent(1)
    }), "first Library restore failed");
    assert(fixture.controls.open === true, "first open sidebar default");
    assert(fixture.mapView.restored === null, "missing Map changed default");

    fixture.eventBus.emit("map:view-changed", { programmatic: false });
    assert(fixture.timers.size === 1, "Map move did not schedule");
    assert([...fixture.timers.values()][0].delay === 750, "wrong debounce");
    fixture.mapView.current = { lat: 36, lng: 136, zoom: 12 };
    fixture.eventBus.emit("view-state:sidebar-toggled", { open: false });
    fixture.controls.open = false;
    fixture.controls.width = 384;
    fixture.eventBus.emit("view-state:sidebar-width-changed", { width: 384 });
    fixture.controls.trackInfoHeight = 300;
    fixture.eventBus.emit("view-state:track-info-height-changed", {
        height: 300
    });
    assert(fixture.timers.size === 1, "multiple timers active");
    fixture.runTimer();
    assert(fixture.store.getLibraryState(a).map.zoom === 12, "latest Map not saved");
    assert(fixture.store.getLibraryState(a).sidebar.open === false, "latest sidebar not saved");
    assert(fixture.store.getLibraryState(a).sidebar.width === 384,
        "latest sidebar width not saved");
    assert(fixture.store.getLibraryState(a).sidebar.trackInfoHeight === 300,
        "latest Track Info height not saved");
    assert(fixture.storage.writes.length === 1, "coalesced events wrote more than once");

    fixture.mapView.current = { lat: 37, lng: 137, zoom: 13 };
    fixture.eventBus.emit("map:view-changed", { programmatic: false });
    fixture.setGeneration(2);
    fixture.store.setLibraryState(b, state({
        map: { lat: 40, lng: 140, zoom: 8 },
        sidebar: { open: true, width: 448, trackInfoHeight: 360 }
    }));
    assert(await fixture.coordinator.restoreLibrary({
        libraryId: b,
        libraryName: "B",
        generation: 2,
        isCurrent: fixture.isCurrent(2)
    }), "second Library restore failed");
    assert(fixture.store.getLibraryState(a) !== null, "old pending state lost");
    assert(fixture.store.getLibraryState(a).map.zoom === 13, "old pending state used new identity");
    assert(fixture.mapView.restored.value.zoom === 8, "new Map not restored");
    assert(fixture.mapView.restored.options.animate === false, "restore animated");
    assert(fixture.controls.open === true, "sidebar not restored");
    assert(fixture.controls.width === 448, "sidebar width not restored");
    assert(fixture.controls.trackInfoHeight === 360,
        "Track Info height not restored");
    assert(fixture.coordinator.getStatus().pendingSave === false, "old timer survived switch");

    fixture.eventBus.emit("view-state:reset-requested");
    assert(!fixture.store.hasLibraryState(b), "Reset retained current Library");
    assert(fixture.store.hasLibraryState(a), "Reset removed other Library");
    assert(fixture.coordinator.getStatus().resetBlocked, "Reset did not block immediate save");
    assert(fixture.mapView.current.zoom === 13, "Reset changed runtime Map");
    fixture.eventBus.emit("map:view-changed", { programmatic: true });
    assert(fixture.timers.size === 0, "programmatic event re-saved Reset");
    fixture.eventBus.emit("map:view-changed", { programmatic: false });
    assert(fixture.timers.size === 1, "user interaction did not resume save");
    fixture.runTimer();
    assert(fixture.store.hasLibraryState(b), "resumed save missing");

    fixture.setConfirm(false);
    fixture.eventBus.emit("view-state:reset-requested");
    assert(fixture.store.hasLibraryState(b), "Cancel removed state");

    fixture.setGeneration(3);
    assert(!await fixture.coordinator.restoreLibrary({
        libraryId: a,
        libraryName: "A",
        generation: 2,
        isCurrent: fixture.isCurrent(2)
    }), "stale restore accepted");
}

async function testVisibleTrackState() {

    const fixture = createCoordinatorFixture();
    const libraryId = fixture.store.createLibraryId("Visible");
    const restored = [];

    fixture.displayState.setLibrary({ name: "Visible" });
    for (const path of ["a.gpx", "folder/b.gpx", "folder/c.gpx"]) {
        fixture.displayState.registerFile(path, { name: path }, "#123456");
    }
    fixture.eventBus.on("gpx:display-toggled", data => {
        if (data.checked) {
            restored.push(data.path);
            fixture.displayState.setChecked(data.path, true);
        }
    });
    fixture.store.setLibraryState(libraryId, state({
        map: { lat: 40, lng: 140, zoom: 9 },
        visibleTracks: ["a.gpx", "missing.gpx", "folder/b.gpx", "a.gpx"],
        sidebar: { open: false }
    }));

    assert(await fixture.coordinator.restoreLibrary({
        libraryId,
        libraryName: "Visible",
        generation: 1,
        isCurrent: fixture.isCurrent(1)
    }), "visible restore failed");
    assert(restored.join(",") === "a.gpx,folder/b.gpx", "stale or duplicate path restored");
    assert(fixture.displayState.getCheckedPaths().length === 2, "restored checked state mismatch");
    assert(fixture.mapView.restored.value.zoom === 9, "Map state lost with visible restore");
    assert(fixture.controls.open === false, "Sidebar state lost with visible restore");

    const writesBeforeBulk = fixture.storage.writes.length;
    fixture.displayState.setChecked("folder/c.gpx", true);
    fixture.eventBus.emit("folder:display-toggled", { checked: true });
    fixture.eventBus.emit("folder:display-toggled", { checked: true });
    assert(fixture.timers.size === 1, "bulk created multiple timers");
    fixture.runTimer();
    assert(fixture.storage.writes.length === writesBeforeBulk + 1, "bulk wrote more than once");
    assert(fixture.store.getLibraryState(libraryId).visibleTracks.length === 3, "bulk snapshot incomplete");

    fixture.eventBus.emit("map:clear-requested");
    fixture.displayState.clearDisplays();
    fixture.runTimer();
    assert(fixture.store.getLibraryState(libraryId).visibleTracks.length === 0, "Clear snapshot not empty");

    const singleLibraryId = fixture.store.createLibraryId("Single");
    fixture.displayState.setLibrary({ name: "Single" });
    fixture.displayState.registerFile("only.gpx", { name: "only.gpx" }, "#123456");
    fixture.store.setLibraryState(singleLibraryId, state({
        visibleTracks: ["only.gpx"]
    }));
    fixture.setGeneration(2);
    restored.length = 0;
    assert(await fixture.coordinator.restoreLibrary({
        libraryId: singleLibraryId,
        libraryName: "Single",
        generation: 2,
        isCurrent: fixture.isCurrent(2)
    }), "single visible restore failed");
    assert(restored.join(",") === "only.gpx", "single visible path not restored once");
}

async function testStaleVisibleRestore() {

    const idleResolvers = [];
    const fixture = createCoordinatorFixture({
        displayQueue: {
            whenIdle: () => new Promise(resolve => idleResolvers.push(resolve))
        }
    });
    const firstId = fixture.store.createLibraryId("First");
    const secondId = fixture.store.createLibraryId("Second");

    fixture.displayState.setLibrary({ name: "First" });
    fixture.displayState.registerFile("first.gpx", { name: "first.gpx" }, "#123456");
    fixture.store.setLibraryState(firstId, state({
        map: { lat: 10, lng: 20, zoom: 5 },
        visibleTracks: ["first.gpx"]
    }));
    const firstRestore = fixture.coordinator.restoreLibrary({
        libraryId: firstId,
        libraryName: "First",
        generation: 1,
        isCurrent: fixture.isCurrent(1)
    });

    fixture.setGeneration(2);
    fixture.displayState.setLibrary({ name: "Second" });
    fixture.store.setLibraryState(secondId, state({
        map: { lat: 30, lng: 40, zoom: 8 }
    }));
    const secondRestore = fixture.coordinator.restoreLibrary({
        libraryId: secondId,
        libraryName: "Second",
        generation: 2,
        isCurrent: fixture.isCurrent(2)
    });

    idleResolvers.splice(0).forEach(resolve => resolve());
    assert(!await firstRestore, "stale visible restore completed");
    assert(await secondRestore, "current visible restore rejected");
    assert(fixture.mapView.restored.value.zoom === 8, "stale Map replaced current Map");
    assert(fixture.coordinator.getStatus().generation === 2, "stale generation retained");
}

async function testSelectedTrackRestore() {

    const fixture = createCoordinatorFixture();
    const libraryId = fixture.store.createLibraryId("Selected");
    const selectionEvents = [];

    fixture.displayState.setLibrary({ name: "Selected" });
    for (const path of ["folder/a.gpx", "folder/b.gpx"]) {
        fixture.displayState.registerFile(path, { name: path }, "#123456");
    }
    fixture.eventBus.on("gpx:display-toggled", ({ path, checked }) => {
        fixture.displayState.setChecked(path, checked);
        if (checked) fixture.displayState.setLoaded(path, { tracks: [] });
    });
    fixture.eventBus.on("selection:changed", data => {
        selectionEvents.push(data);
    });
    fixture.store.setLibraryState(libraryId, state({
        map: { lat: 40, lng: 140, zoom: 9 },
        visibleTracks: ["folder/a.gpx"],
        selectedTrack: "folder/a.gpx"
    }));

    assert(await fixture.coordinator.restoreLibrary({
        libraryId,
        libraryName: "Selected",
        generation: 1,
        isCurrent: fixture.isCurrent(1)
    }), "selected Track restore failed");
    assert(fixture.selectionState.getSelectedPath() === "folder/a.gpx",
        "selected Track path not restored");
    assert(fixture.selectionState.getSource() === "system",
        "restored selection did not use system source");
    assert(selectionEvents.at(-1).reason === "view-state-restore",
        "restored selection event reason missing");
    assert(fixture.mapView.restored.value.zoom === 9,
        "selection restore changed saved Map projection");

    fixture.displayState.setChecked("folder/b.gpx", true);
    fixture.displayState.setLoaded("folder/b.gpx", { tracks: [] });
    const userChange = fixture.selectionState.select("folder/b.gpx", "tree");
    fixture.eventBus.emit("selection:changed", {
        path: userChange.selectedPath,
        previousPath: userChange.previousPath,
        reason: "tree"
    });
    fixture.runTimer();
    assert(fixture.store.getLibraryState(libraryId).selectedTrack ===
        "folder/b.gpx", "SelectionState path not saved");
    const switchChange = fixture.selectionState.clear("system");
    fixture.eventBus.emit("selection:changed", {
        path: null,
        previousPath: switchChange.previousPath,
        reason: "library-switch"
    });
    assert(fixture.timers.size === 0,
        "Library switch selection clear scheduled a save");
    assert(fixture.store.getLibraryState(libraryId).selectedTrack ===
        "folder/b.gpx", "Library switch erased saved selection");

    const invisible = createCoordinatorFixture();
    const invisibleId = invisible.store.createLibraryId("Invisible");
    invisible.displayState.setLibrary({ name: "Invisible" });
    for (const path of ["a.gpx", "b.gpx"]) {
        invisible.displayState.registerFile(path, { name: path }, "#123456");
    }
    invisible.eventBus.on("gpx:display-toggled", ({ path, checked }) => {
        invisible.displayState.setChecked(path, checked);
        if (checked) invisible.displayState.setLoaded(path, { tracks: [] });
    });
    invisible.store.setLibraryState(invisibleId, state({
        visibleTracks: ["a.gpx"],
        selectedTrack: "b.gpx"
    }));
    assert(await invisible.coordinator.restoreLibrary({
        libraryId: invisibleId,
        libraryName: "Invisible",
        generation: 1,
        isCurrent: invisible.isCurrent(1)
    }), "invisible selected fixture failed");
    assert(invisible.selectionState.getSelectedPath() === null,
        "invisible Track selection restored");

    const stale = createCoordinatorFixture();
    const staleId = stale.store.createLibraryId("Stale selected");
    stale.displayState.setLibrary({ name: "Stale selected" });
    stale.displayState.registerFile("current.gpx", { name: "current.gpx" }, "#123456");
    stale.eventBus.on("gpx:display-toggled", ({ path, checked }) => {
        stale.displayState.setChecked(path, checked);
        if (checked) stale.displayState.setLoaded(path, { tracks: [] });
    });
    stale.store.setLibraryState(staleId, state({
        visibleTracks: ["current.gpx", "missing.gpx"],
        selectedTrack: "missing.gpx"
    }));
    assert(await stale.coordinator.restoreLibrary({
        libraryId: staleId,
        libraryName: "Stale selected",
        generation: 1,
        isCurrent: stale.isCurrent(1)
    }), "stale selected fixture failed");
    assert(stale.selectionState.getSelectedPath() === null,
        "stale Track selection restored");

    const failed = createCoordinatorFixture();
    const failedId = failed.store.createLibraryId("Failed");
    failed.displayState.setLibrary({ name: "Failed" });
    failed.displayState.registerFile("failed.gpx", { name: "failed.gpx" }, "#123456");
    failed.eventBus.on("gpx:display-toggled", ({ path }) => {
        failed.displayState.setChecked(path, true);
        failed.displayState.setError(path, new Error("parse failed"));
    });
    failed.store.setLibraryState(failedId, state({
        visibleTracks: ["failed.gpx"],
        selectedTrack: "failed.gpx"
    }));
    assert(await failed.coordinator.restoreLibrary({
        libraryId: failedId,
        libraryName: "Failed",
        generation: 1,
        isCurrent: failed.isCurrent(1)
    }), "failed selected fixture rejected");
    assert(failed.selectionState.getSelectedPath() === null,
        "failed Track selection restored");

    let releaseIdle;
    const override = createCoordinatorFixture({
        displayQueue: {
            whenIdle: () => new Promise(resolve => { releaseIdle = resolve; })
        }
    });
    const overrideId = override.store.createLibraryId("Override");
    override.displayState.setLibrary({ name: "Override" });
    for (const path of ["saved.gpx", "user.gpx"]) {
        override.displayState.registerFile(path, { name: path }, "#123456");
        override.displayState.setChecked(path, true);
        override.displayState.setLoaded(path, { tracks: [] });
    }
    override.store.setLibraryState(overrideId, state({
        visibleTracks: ["saved.gpx"],
        selectedTrack: "saved.gpx"
    }));
    const restoring = override.coordinator.restoreLibrary({
        libraryId: overrideId,
        libraryName: "Override",
        generation: 1,
        isCurrent: override.isCurrent(1)
    });
    const overrideChange = override.selectionState.select("user.gpx", "tree");
    override.eventBus.emit("selection:changed", {
        path: overrideChange.selectedPath,
        previousPath: overrideChange.previousPath,
        reason: "tree"
    });
    releaseIdle();
    assert(await restoring, "selection override restore failed");
    assert(override.selectionState.getSelectedPath() === "user.gpx",
        "saved selection overwrote user selection");
}

function testSelectedTrackProjection() {

    const treeOptions = [];
    let highlightPath = null;
    const context = {
        treeView: {
            setSelectedPath(path, options) { treeOptions.push({ path, options }); }
        },
        searchView: { setSelectedPath() {} },
        mapView: { clearSelectionHighlight() {} },
        applySelectionHighlight(path) { highlightPath = path; }
    };

    App.prototype.handleSelectionChanged.call(context, {
        path: "deep/folder/selected.gpx",
        reason: "view-state-restore"
    });
    assert(treeOptions[0].options.reveal === true,
        "restored selection did not reveal ancestors");
    assert(treeOptions[0].options.scroll === false,
        "restored selection forced Tree scroll");
    assert(treeOptions[0].options.moveFocus === false,
        "restored selection forced Tree focus");
    assert(highlightPath === "deep/folder/selected.gpx",
        "restored selection did not use normal highlight projection");
}

async function testMapOverrideDuringRestore() {

    let releaseIdle;
    const fixture = createCoordinatorFixture({
        displayQueue: {
            whenIdle: () => new Promise(resolve => { releaseIdle = resolve; })
        }
    });
    const libraryId = fixture.store.createLibraryId("Map override");

    fixture.store.setLibraryState(libraryId, state({
        map: { lat: 10, lng: 20, zoom: 5 }
    }));
    const restore = fixture.coordinator.restoreLibrary({
        libraryId,
        libraryName: "Map override",
        generation: 1,
        isCurrent: fixture.isCurrent(1)
    });
    fixture.mapView.current = { lat: 45, lng: 145, zoom: 12 };
    fixture.eventBus.emit("map:view-changed", { programmatic: false });
    releaseIdle();

    assert(await restore, "Map override restore failed");
    assert(fixture.mapView.restored === null, "saved Map overwrote user Map");
    assert(fixture.timers.size === 1, "user Map override was not queued for save");
    fixture.runTimer();
    assert(fixture.store.getLibraryState(libraryId).map.zoom === 12, "user Map override not saved");
}

async function testDisplayQueueIdle() {

    const queue = new GPXDisplayQueue(2);
    const releases = [];
    const starts = [];
    let idle = false;

    for (const path of ["a.gpx", "b.gpx", "c.gpx"]) {
        queue.enqueue({
            path,
            run: () => new Promise(resolve => releases.push(resolve)),
            onSuccess: () => starts.push(path)
        });
    }

    assert(queue.getActiveCount() === 2, "Queue concurrency changed");
    assert(queue.getQueuedCount() === 1, "Queue pending count mismatch");
    const idlePromise = queue.whenIdle().then(() => { idle = true; });
    releases.shift()();
    await Promise.resolve();
    await Promise.resolve();
    assert(!idle && queue.getActiveCount() === 2, "Queue reported idle before all work");
    releases.splice(0).forEach(resolve => resolve());
    await idlePromise;
    assert(idle && queue.getActiveCount() === 0, "Queue idle notification missing");
    assert(starts.length === 3, "Queue duplicated or skipped work");
}

async function testGeometryCache() {

    const config = Config.geometryCache;
    const adapter = new MemoryGeometryAdapter();
    const repository = new GeometryCacheRepository(config, { adapter });
    const parsed = {
        metadata: { sourceFileName: "secret.gpx" },
        tracks: [{
            name: "not cached",
            segments: [{
                points: [
                    { latitude: 35, longitude: 135, elevation: 100, time: "now" },
                    { latitude: 36, longitude: 136, elevation: 200, time: "later" }
                ]
            }]
        }],
        waypoints: [{
            latitude: 34,
            longitude: 134,
            name: "not cached"
        }],
        warnings: [{ code: "not cached" }],
        rawXML: "<gpx>not cached</gpx>",
        leafletLayer: "not cached",
        queueState: "not cached"
    };
    const file = { name: "a.gpx", size: 1234, lastModified: 5678 };
    const summary = new TrackSummaryBuilder().build(
        "folder/a.gpx",
        file,
        parsed
    );

    assert(await repository.set(
        "namespace-a",
        "folder/a.gpx",
        file,
        parsed,
        summary
    ),
        "geometry cache write failed");
    const stored = [...adapter.values.values()][0];
    const serialized = JSON.stringify(stored);

    assert(stored.cacheSchemaVersion === 3, "cache schema missing");
    assert(stored.parserSchemaVersion === 1, "parser schema missing");
    assert(stored.textDecoderSchemaVersion === 1,
        "text decoder schema missing");
    assert(serialized.includes("latitude") && serialized.includes("longitude"),
        "drawing geometry missing");
    assert(stored.summary.relativePath === "folder/a.gpx",
        "compact discovery summary missing");
    assert(Object.keys(stored.geometry.tracks[0].segments[0].points[0]).length === 2,
        "non-drawing point data cached in geometry");
    assert(!serialized.includes("rawXML") && !serialized.includes("queueState") &&
        !serialized.includes("<gpx>"),
    "GPX XML or runtime state cached");

    const oldKey = JSON.stringify(["namespace-old", "folder/a.gpx"]);
    adapter.values.set(oldKey, {
        ...structuredClone(stored),
        cacheSchemaVersion: 2,
        namespace: "namespace-old"
    });
    assert(await repository.getSummary(
        "namespace-old",
        "folder/a.gpx",
        file
    ) === null, "schema 2 mojibake summary was accepted");
    assert(!adapter.values.has(oldKey), "schema 2 cache was not invalidated");

    const transitionalKey = JSON.stringify([
        "namespace-transitional",
        "folder/a.gpx"
    ]);
    const transitionalRecord = {
        ...structuredClone(stored),
        namespace: "namespace-transitional"
    };
    delete transitionalRecord.textDecoderSchemaVersion;
    adapter.values.set(transitionalKey, transitionalRecord);
    assert(await repository.getSummary(
        "namespace-transitional",
        "folder/a.gpx",
        file
    ) === null, "pre-decoder schema 3 summary was accepted");
    assert(!adapter.values.has(transitionalKey),
        "pre-decoder schema 3 cache was not invalidated");

    const hit = await repository.get(
        "namespace-a",
        "folder/a.gpx",
        file
    );
    assert(hit.tracks[0].segments[0].points.length === 2,
        "cached Track geometry not restored");
    assert(hit.waypoints.length === 1, "cached Waypoint geometry not restored");
    const summaryHit = await repository.getSummary(
        "namespace-a",
        "folder/a.gpx",
        file
    );
    assert(summaryHit.relativePath === "folder/a.gpx",
        "cached discovery summary not restored");
    assert(await repository.get("namespace-b", "folder/a.gpx", file) === null,
        "cache crossed Library namespace");

    const textState = { calls: 0 };
    const sourceFile = {
        size: 200,
        lastModified: 300,
        async text() {
            textState.calls += 1;
            return "<gpx />";
        }
    };
    const fileHandle = {
        name: "a.gpx",
        async getFile() { return sourceFile; }
    };
    let parseCalls = 0;
    const parser = {
        parse() {
            parseCalls += 1;
            return parsed;
        }
    };
    const loader = new GPXGeometryLoader({ parser, repository });

    loader.setLibraryNamespace("loader-namespace");
    await loader.load("a.gpx", fileHandle);
    await loader.load("a.gpx", fileHandle);
    assert(parseCalls === 1, "cache hit parsed GPX XML again");
    assert(textState.calls === 1, "cache hit read GPX XML text again");
    assert(loader.getStats().misses === 1 && loader.getStats().hits === 1,
        "cache hit/miss stats mismatch");

    const concurrentLoader = new GPXGeometryLoader({ parser, repository });
    concurrentLoader.setLibraryNamespace("concurrent-namespace");
    const beforeConcurrentParse = parseCalls;
    const first = concurrentLoader.load("same.gpx", fileHandle);
    const second = concurrentLoader.load("same.gpx", fileHandle);
    assert(first === second, "duplicate path did not share inflight request");
    await Promise.all([first, second]);
    assert(parseCalls === beforeConcurrentParse + 1,
        "duplicate path parsed more than once");
    assert(concurrentLoader.getStats().deduplicated === 1,
        "duplicate request not recorded");

    const changedFile = {
        size: sourceFile.size,
        lastModified: sourceFile.lastModified + 1,
        async text() { return "<gpx changed />"; }
    };
    await loader.load("a.gpx", {
        name: "a.gpx",
        async getFile() { return changedFile; }
    });
    assert(parseCalls === beforeConcurrentParse + 2,
        "changed GPX did not invalidate cache");

    const cacheKey = JSON.stringify(["loader-namespace", "a.gpx"]);
    adapter.values.get(cacheKey).cacheSchemaVersion = 2;
    delete adapter.values.get(cacheKey).textDecoderSchemaVersion;
    const deletesBeforeSchemaFallback = adapter.deletes;
    await loader.load("a.gpx", fileHandle);
    assert(parseCalls === beforeConcurrentParse + 3,
        "schema mismatch did not fallback to parse");
    assert(adapter.deletes === deletesBeforeSchemaFallback + 1,
        "schema 2 entry was not deleted individually");
    assert(adapter.values.get(cacheKey).cacheSchemaVersion === 3,
        "schema mismatch was not rewritten as schema 3");
    assert(adapter.values.get(cacheKey).textDecoderSchemaVersion === 1,
        "schema mismatch rewrite omitted decoder schema");

    adapter.values.set(cacheKey, {
        cacheSchemaVersion: config.cacheSchemaVersion,
        parserSchemaVersion: config.parserSchemaVersion,
        textDecoderSchemaVersion: config.textDecoderSchemaVersion,
        namespace: "loader-namespace",
        path: "a.gpx",
        size: sourceFile.size,
        lastModified: sourceFile.lastModified,
        geometry: { tracks: [{ segments: [{ points: [{ latitude: "bad" }] }] }], waypoints: [] }
    });
    await loader.load("a.gpx", fileHandle);
    assert(parseCalls === beforeConcurrentParse + 4,
        "corrupt geometry did not fallback to parse");

    adapter.failRead = true;
    await loader.load("read-failure.gpx", fileHandle);
    adapter.failRead = false;
    assert(parseCalls === beforeConcurrentParse + 5,
        "cache read failure stopped parser fallback");

    adapter.failWrite = true;
    const result = await loader.load("quota.gpx", fileHandle);
    adapter.failWrite = false;
    assert(result.tracks.length === 1, "cache quota failure stopped Viewer result");
    assert(loader.getStats().writeFailures === 1,
        "cache write failure not isolated");
}

function testSidebarControls() {

    const fixture = document.getElementById("fixture");
    const workspace = document.createElement("main");
    const sidebar = document.createElement("aside");
    const trackList = document.createElement("div");
    const trackInfo = document.createElement("section");
    const treeMarker = document.createElement("span");
    const toolbar = new Toolbar("1.3.0");
    const eventBus = new EventBus();
    const events = [];
    const widthEvents = [];
    const heightEvents = [];
    const layoutEvents = [];
    const controls = new ViewStateControls(eventBus, {
        requestFrame: callback => callback(),
        confirmAction: () => true,
        isDesktop: () => true
    });

    treeMarker.textContent = "tree-state";
    trackList.className = "sidebar";
    trackInfo.className = "track-info";
    trackList.append(treeMarker);
    sidebar.append(trackList, trackInfo);
    workspace.append(sidebar, document.createElement("section"));
    fixture.replaceChildren(toolbar.element, workspace, controls.element);
    eventBus.on("view-state:sidebar-toggled", data => events.push(data));
    eventBus.on("view-state:sidebar-width-changed", data => widthEvents.push(data));
    eventBus.on("view-state:track-info-height-changed", data => heightEvents.push(data));
    eventBus.on("view-state:sidebar-layout-changed", data => layoutEvents.push(data));
    controls.attach({ toolbar, workspace, sidebar });

    assert(controls.isSidebarOpen(), "sidebar not default open");
    assert(toolbar.sidebarToggleButton.getAttribute("aria-pressed") === "true", "open ARIA state");
    toolbar.sidebarToggleButton.click();
    assert(!controls.isSidebarOpen(), "sidebar did not close");
    assert(sidebar.hidden, "closed sidebar visible");
    assert(workspace.classList.contains("is-sidebar-closed"), "Map layout class missing");
    assert(toolbar.sidebarToggleButton.getAttribute("aria-pressed") === "false", "closed ARIA state");
    assert(treeMarker.isConnected, "Tree state destroyed");
    toolbar.sidebarToggleButton.click();
    assert(controls.isSidebarOpen() && !sidebar.hidden, "sidebar did not reopen");
    assert(events.length === 2, "sidebar event count");
    assert(controls.resizeHandle.element.getAttribute("role") === "separator",
        "resize separator role missing");
    assert(controls.resizeHandle.element.tabIndex === 0,
        "resize separator not keyboard reachable");
    assert(controls.getSidebarWidth() === 260, "default sidebar width");
    controls.resizeHandle.element.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true
    }));
    assert(controls.getSidebarWidth() === 276, "keyboard resize step");
    assert(widthEvents.at(-1).width === 276, "keyboard width event missing");
    controls.resizeHandle.element.dispatchEvent(new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true
    }));
    assert(controls.getSidebarWidth() === 520, "keyboard maximum width");
    controls.resizeHandle.element.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true
    }));
    assert(controls.getSidebarWidth() === 220, "keyboard minimum width");
    assert(controls.resizeHandle.element.getAttribute("aria-valuenow") === "220",
        "resize ARIA value not updated");

    workspace.getBoundingClientRect = () => ({ left: 0 });
    const handle = controls.resizeHandle.element;
    handle.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId: 1,
        button: 0,
        clientX: 220,
        bubbles: true
    }));
    handle.dispatchEvent(new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 340,
        bubbles: true
    }));
    assert(controls.getSidebarWidth() === 340, "pointer resize preview");
    const widthEventsBeforeEnd = widthEvents.length;
    handle.dispatchEvent(new PointerEvent("pointerup", {
        pointerId: 1,
        clientX: 340,
        bubbles: true
    }));
    assert(widthEvents.length === widthEventsBeforeEnd + 1,
        "pointer resize did not commit once");
    assert(!document.body.classList.contains("is-sidebar-resizing"),
        "resize selection guard remained active");
    assert(layoutEvents.length > 0, "resize did not request Map layout update");

    sidebar.getBoundingClientRect = () => ({ bottom: 600, height: 600 });
    const splitHandle = controls.trackInfoResizeHandle.element;
    assert(splitHandle.getAttribute("role") === "separator",
        "Track Info separator role missing");
    assert(splitHandle.getAttribute("aria-orientation") === "horizontal",
        "Track Info separator orientation missing");
    assert(controls.getTrackInfoHeight() === 220,
        "default Track Info height");
    splitHandle.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true
    }));
    assert(controls.getTrackInfoHeight() === 236,
        "Track Info keyboard resize step");
    assert(heightEvents.at(-1).height === 236,
        "Track Info keyboard event missing");
    splitHandle.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true
    }));
    assert(controls.getTrackInfoHeight() === 120,
        "Track Info minimum height");
    splitHandle.dispatchEvent(new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true
    }));
    assert(controls.getTrackInfoHeight() === 420,
        "Track Info maximum height");
    splitHandle.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId: 2,
        button: 0,
        clientY: 180,
        bubbles: true
    }));
    splitHandle.dispatchEvent(new PointerEvent("pointermove", {
        pointerId: 2,
        clientY: 300,
        bubbles: true
    }));
    assert(controls.getTrackInfoHeight() === 300,
        "Track Info pointer resize preview");
    const heightEventsBeforeEnd = heightEvents.length;
    splitHandle.dispatchEvent(new PointerEvent("pointerup", {
        pointerId: 2,
        clientY: 300,
        bubbles: true
    }));
    assert(heightEvents.length === heightEventsBeforeEnd + 1,
        "Track Info pointer resize did not commit once");
    assert(!document.body.classList.contains("is-track-info-resizing"),
        "Track Info resize selection guard remained active");

    controls.setLibrary({ name: "A", hasState: true });
    assert(!controls.element.hidden, "Reset panel unavailable");
    assert(!controls.resetButton.disabled, "Reset disabled with state");
    controls.setStoredStateAvailable(false);
    assert(controls.resetButton.disabled, "Reset enabled without state");

    const mobileWorkspace = document.createElement("main");
    const mobileSidebar = document.createElement("aside");
    const mobileTrackList = document.createElement("div");
    const mobileTrackInfo = document.createElement("section");
    const mobileControls = new ViewStateControls(new EventBus(), {
        requestFrame: callback => callback(),
        isDesktop: () => false
    });

    mobileTrackList.className = "sidebar";
    mobileTrackInfo.className = "track-info";
    mobileSidebar.append(mobileTrackList, mobileTrackInfo);
    mobileWorkspace.append(mobileSidebar, document.createElement("section"));
    mobileControls.attach({
        toolbar: new Toolbar("1.3.0"),
        workspace: mobileWorkspace,
        sidebar: mobileSidebar
    });
    assert(mobileControls.resizeHandle.element.hidden,
        "resize handle visible outside desktop pointer environment");
    assert(mobileWorkspace.classList.contains("is-sidebar-resize-unavailable"),
        "non-desktop workspace retained resize grid column");
    assert(mobileControls.trackInfoResizeHandle.element.hidden,
        "Track Info resize handle visible outside desktop environment");
    assert(mobileSidebar.classList.contains("is-track-info-resize-unavailable"),
        "non-desktop Sidebar retained Track Info resize row");
}

async function testPreviousLibraryStore() {

    const adapter = new MemoryHandleAdapter();
    const store = new PreviousLibraryStore(Config.previousLibrary, { adapter });
    const handle = createDirectoryHandle("Stored");

    assert(await store.save(handle), "DirectoryHandle save failed");
    assert(adapter.writes.length === 1, "DirectoryHandle not written once");
    assert(typeof adapter.value.cacheNamespace === "string",
        "cache namespace not stored with previous Library");
    assert(await store.resolveCacheNamespace(handle) === adapter.value.cacheNamespace,
        "saved Library cache namespace not reused");
    assert(await store.load() === handle, "DirectoryHandle load mismatch");
    assert(store.getStatus() === "available", "Store status unavailable");
    assert(await store.clear(), "DirectoryHandle clear failed");
    assert(await store.load() === null, "cleared DirectoryHandle restored");

    const legacyAdapter = new MemoryHandleAdapter();
    legacyAdapter.value = { handle };
    const legacyStore = new PreviousLibraryStore(Config.previousLibrary, {
        adapter: legacyAdapter,
        namespaceFactory: () => "migrated-namespace"
    });
    assert(await legacyStore.load() === handle, "legacy Handle record rejected");
    assert(legacyAdapter.value.cacheNamespace === "migrated-namespace",
        "legacy Handle record did not receive cache namespace");

    adapter.value = { handle: { kind: "file", name: "invalid" } };
    assert(await store.load() === null, "invalid Handle accepted");
    assert(adapter.deletes === 2, "invalid Handle not discarded");

    adapter.failRead = true;
    assert(await store.load() === null, "IndexedDB failure returned Handle");
    assert(store.getStatus() === "unavailable", "IndexedDB failure status missing");
}

function createPreviousLibraryFixture({
    storedHandle = null,
    pickedHandles = [],
    storeFailure = false,
    staleName = null
} = {}) {

    const applied = [];
    const saved = [];
    const panel = {
        descriptionId: "library-access-status",
        state: null,
        previousAction: null,
        setPreviousLibraryAction(action) { this.previousAction = action; },
        showInitial() { this.state = "initial"; },
        showInsecureContext() { this.state = "insecure"; },
        showUnsupportedBrowser() { this.state = "unsupported"; },
        showUnverifiedMobile() { this.state = "mobile"; },
        showPreviousLibrary(name, permission) {
            this.state = `previous:${name}:${permission}`;
        },
        showLoading(name) { this.state = `loading:${name}`; },
        showPermissionFailure() { this.state = "permission-failure"; },
        showLoadFailure() { this.state = "load-failure"; },
        showEmpty(name) { this.state = `empty:${name}`; },
        hide() { this.state = "hidden"; }
    };
    const statusBar = {
        state: null,
        showInitial() { this.state = "initial"; },
        showUnsupportedEnvironment() { this.state = "unsupported"; },
        showLibraryLoading(name) { this.state = `loading:${name}`; },
        showLibraryLoaded(library) { this.state = `loaded:${library.name}`; },
        showError() { this.state = "error"; }
    };
    const toolbar = {
        state: null,
        setFolderPickerState(state) { this.state = state; }
    };
    const store = {
        cleared: 0,
        async load() {
            if (storeFailure) return null;
            return storedHandle;
        },
        async resolveCacheNamespace(handle) {
            return `cache:${handle.name}`;
        },
        async save(handle, options) {
            assert(options.cacheNamespace === `cache:${handle.name}`,
                "cache namespace not saved with Handle");
            saved.push(handle);
            return !storeFailure;
        },
        async clear() {
            this.cleared += 1;
            return !storeFailure;
        }
    };
    const coordinator = new PreviousLibraryCoordinator({
        store,
        scanner: {
            async scan(handle) {
                if (handle.name === staleName) {
                    throw new DOMException("missing", "NotFoundError");
                }
                return {
                    name: handle.name,
                    rootFolder: { handle },
                    gpxFileCount: 1
                };
            }
        },
        toolbar,
        accessPanel: panel,
        statusBar,
        canSwitchLibrary: () => true,
        flushViewState: () => {},
        beforeLoad: () => {},
        applyLibrary: async (library, context) => {
            assert(context.isCurrent(), "current Library generation rejected");
            assert(context.cacheNamespace === `cache:${library.name}`,
                "Library cache namespace not forwarded");
            applied.push(library.rootFolder.handle);
            return true;
        },
        getCurrentLibrary: () => null,
        getSupport: () => ({ available: true, reason: null, isMobile: false }),
        pickDirectory: async () => {
            const next = pickedHandles.shift() ?? null;
            if (next instanceof Error) throw next;
            return next;
        },
        reportError: () => {}
    });

    return { coordinator, store, panel, toolbar, applied, saved };
}

async function testPreviousLibraryCoordinator() {

    const granted = createDirectoryHandle("Granted");
    const auto = createPreviousLibraryFixture({ storedHandle: granted });

    assert(await auto.coordinator.initialize(), "granted Handle not auto-opened");
    assert(auto.applied[0] === granted, "auto-open used wrong Handle");
    assert(granted.queryCalls === 1, "granted permission not queried once");
    assert(granted.requestCalls === 0, "startup requested permission");

    const prompted = createDirectoryHandle("Prompted", { query: "prompt" });
    const prompt = createPreviousLibraryFixture({ storedHandle: prompted });

    assert(!await prompt.coordinator.initialize(), "prompt Handle auto-opened");
    assert(prompted.requestCalls === 0, "startup prompted for permission");
    assert(prompt.panel.state === "previous:Prompted:prompt", "previous action missing");
    assert(await prompt.coordinator.openPrevious(), "explicit previous open failed");
    assert(prompted.requestCalls === 1, "explicit action did not request permission");

    const cancelledHandle = createDirectoryHandle("Cancelled", { query: "prompt" });
    const abortError = new DOMException("cancel", "AbortError");
    const cancelled = createPreviousLibraryFixture({
        storedHandle: cancelledHandle,
        pickedHandles: [abortError]
    });
    assert(!await cancelled.coordinator.initialize(), "cancel fixture auto-opened");
    assert(!await cancelled.coordinator.openManual(), "cancelled picker opened");
    assert(cancelled.panel.state === "previous:Cancelled:prompt",
        "picker Cancel removed previous Library action");

    const denied = createDirectoryHandle("Denied", {
        query: "denied",
        request: "denied"
    });
    const manual = createDirectoryHandle("Manual");
    const fallback = createPreviousLibraryFixture({
        storedHandle: denied,
        pickedHandles: [manual]
    });

    assert(!await fallback.coordinator.initialize(), "denied Handle auto-opened");
    assert(!await fallback.coordinator.openPrevious(), "denied Handle opened");
    assert(fallback.applied.length === 0, "denied Handle reached Library load");
    assert(await fallback.coordinator.openManual(), "manual picker fallback failed");
    assert(fallback.saved[0] === manual, "manual Library not saved as last");

    const stale = createDirectoryHandle("Stale");
    const staleFixture = createPreviousLibraryFixture({
        storedHandle: stale,
        staleName: "Stale"
    });

    assert(!await staleFixture.coordinator.initialize(), "stale Handle opened");
    assert(staleFixture.store.cleared === 1, "stale Handle not discarded");

    const first = createDirectoryHandle("First");
    const second = createDirectoryHandle("Second");
    const switching = createPreviousLibraryFixture({
        storeFailure: true,
        pickedHandles: [first, second]
    });

    assert(!await switching.coordinator.initialize(), "failed Store auto-opened");
    assert(await switching.coordinator.openManual(), "Store failure blocked picker");
    assert(await switching.coordinator.openManual(), "Library switch failed");
    assert(switching.applied.length === 2, "Library switch load count");
    assert(switching.applied[0] === first, "first Library switch mismatch");
    assert(switching.applied[1] === second, "last Library switch mismatch");

    const storedSwitch = createPreviousLibraryFixture({
        pickedHandles: [first, second]
    });
    assert(await storedSwitch.coordinator.openManual(), "first saved switch failed");
    assert(await storedSwitch.coordinator.openManual(), "second saved switch failed");
    assert(storedSwitch.saved.length === 2, "Library switch Handle save count");
    assert(storedSwitch.saved[1] === second, "last Library Handle not updated");
}

function testPreviousLibraryPanel() {

    const panel = new LibraryAccessPanel();
    let requests = 0;

    panel.setPreviousLibraryAction(() => { requests += 1; });
    panel.showPreviousLibrary("Previous", "prompt");
    assert(!panel.previousLibraryButton.hidden, "previous Library button hidden");
    assert(panel.previousLibraryButton.type === "button", "previous button type");
    assert(panel.previousLibraryButton.getAttribute("aria-label").includes("Previous"),
        "previous button accessible name");
    panel.previousLibraryButton.click();
    assert(requests === 1, "previous Library explicit action missing");
    panel.showInitial();
    assert(panel.previousLibraryButton.hidden, "previous button remained visible");
}

try {
    assert(Config.version === "1.3.0", "Config version changed");
    assert(Config.uiSettings.schemaVersion === 1, "UI schema changed");
    assert(Config.sharedLibrarySettings.schemaVersion === 1, "shared schema changed");
    assert(Config.viewState.storageKey === "trailbook.viewState", "view key");
    assert(Config.viewState.debounceMs === 750, "Config debounce");
    assert(Config.viewState.maxVisibleTracks === 5000, "visible limit");
    assert(Config.viewState.maxSerializedBytes === 1048576, "size limit");
    assert(Config.viewState.sidebarDefaultWidth === 260, "sidebar default width");
    assert(Config.viewState.sidebarMinWidth === 220, "sidebar minimum width");
    assert(Config.viewState.sidebarMaxWidth === 520, "sidebar maximum width");
    assert(Config.viewState.trackInfoDefaultHeight === 220,
        "Track Info default height");
    assert(Config.viewState.trackInfoMinHeight === 120,
        "Track Info minimum height");
    assert(Config.viewState.trackInfoMaxHeight === 420,
        "Track Info maximum height");
    assert(Config.geometryCache.cacheSchemaVersion === 3, "cache schema changed");
    assert(Config.geometryCache.parserSchemaVersion === 1, "parser schema changed");
    assert(Config.geometryCache.textDecoderSchemaVersion === 1,
        "text decoder schema changed");
    assert(typeof App === "function", "App module import failed");

    testIdentityAndSchema();
    testStore();
    testMapView();
    await testCoordinator();
    await testVisibleTrackState();
    await testStaleVisibleRestore();
    await testSelectedTrackRestore();
    testSelectedTrackProjection();
    await testMapOverrideDuringRestore();
    await testDisplayQueueIdle();
    await testGeometryCache();
    testSidebarControls();
    await testPreviousLibraryStore();
    await testPreviousLibraryCoordinator();
    testPreviousLibraryPanel();

    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
