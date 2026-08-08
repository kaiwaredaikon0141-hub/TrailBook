import Config from "../../src/js/core/Config.js";
import App from "../../src/js/core/App.js";
import EventBus from "../../src/js/core/EventBus.js";
import ViewStateCoordinator from "../../src/js/core/ViewStateCoordinator.js";
import DisplaySettingsStore from "../../src/js/services/DisplaySettingsStore.js";
import GPXDisplayQueue from "../../src/js/services/GPXDisplayQueue.js";
import ViewStateStore from "../../src/js/services/ViewStateStore.js";
import DisplayState from "../../src/js/state/DisplayState.js";
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
                sidebar: { open: false },
                futureField: true
            }
        }
    }, options);

    assert(normalized !== null, "valid schema rejected");
    assert(normalized.libraries["root-name:GPX"].map.zoom === 11, "Map lost");
    assert(normalized.libraries["root-name:GPX"].visibleTracks.length === 2, "duplicate path retained");
    assert(normalized.libraries["root-name:GPX"].sidebar.open === false, "sidebar lost");
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
    const controls = {
        open: true,
        hasState: false,
        setLibrary({ hasState }) { this.hasState = hasState; },
        setSidebarOpen(open) { this.open = open; },
        isSidebarOpen() { return this.open; },
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
        invalidateSize() { this.invalidations += 1; return true; }
    };
    const coordinator = new ViewStateCoordinator({
        eventBus,
        store,
        mapView,
        controls,
        displayState,
        displayQueue,
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
    assert(fixture.timers.size === 1, "multiple timers active");
    fixture.runTimer();
    assert(fixture.store.getLibraryState(a).map.zoom === 12, "latest Map not saved");
    assert(fixture.store.getLibraryState(a).sidebar.open === false, "latest sidebar not saved");
    assert(fixture.storage.writes.length === 1, "coalesced events wrote more than once");

    fixture.mapView.current = { lat: 37, lng: 137, zoom: 13 };
    fixture.eventBus.emit("map:view-changed", { programmatic: false });
    fixture.setGeneration(2);
    fixture.store.setLibraryState(b, state({
        map: { lat: 40, lng: 140, zoom: 8 },
        sidebar: { open: true }
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

function testSidebarControls() {

    const fixture = document.getElementById("fixture");
    const workspace = document.createElement("main");
    const sidebar = document.createElement("aside");
    const treeMarker = document.createElement("span");
    const toolbar = new Toolbar("1.2.0");
    const eventBus = new EventBus();
    const events = [];
    const controls = new ViewStateControls(eventBus, {
        requestFrame: callback => callback(),
        confirmAction: () => true
    });

    treeMarker.textContent = "tree-state";
    sidebar.append(treeMarker);
    workspace.append(sidebar, document.createElement("section"));
    fixture.replaceChildren(toolbar.element, workspace, controls.element);
    eventBus.on("view-state:sidebar-toggled", data => events.push(data));
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

    controls.setLibrary({ name: "A", hasState: true });
    assert(!controls.element.hidden, "Reset panel unavailable");
    assert(!controls.resetButton.disabled, "Reset disabled with state");
    controls.setStoredStateAvailable(false);
    assert(controls.resetButton.disabled, "Reset enabled without state");
}

try {
    assert(Config.version === "1.2.0", "Config version changed");
    assert(Config.uiSettings.schemaVersion === 1, "UI schema changed");
    assert(Config.sharedLibrarySettings.schemaVersion === 1, "shared schema changed");
    assert(Config.viewState.storageKey === "trailbook.viewState", "view key");
    assert(Config.viewState.debounceMs === 750, "Config debounce");
    assert(Config.viewState.maxVisibleTracks === 5000, "visible limit");
    assert(Config.viewState.maxSerializedBytes === 1048576, "size limit");
    assert(typeof App === "function", "App module import failed");

    testIdentityAndSchema();
    testStore();
    testMapView();
    await testCoordinator();
    await testVisibleTrackState();
    await testStaleVisibleRestore();
    await testMapOverrideDuringRestore();
    await testDisplayQueueIdle();
    testSidebarControls();

    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
