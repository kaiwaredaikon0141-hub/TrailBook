import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import ViewStateCoordinator from "../../src/js/core/ViewStateCoordinator.js";
import ViewStateStore from "../../src/js/services/ViewStateStore.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import LibraryAccessPanel from "../../src/js/ui/LibraryAccessPanel.js";
import MapView, {
    BASE_MAPS,
    DEFAULT_BASE_MAP
} from "../../src/js/ui/MapView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class MemoryStorage {
    constructor(value = null) { this.value = value; }
    getItem() { return this.value; }
    setItem(_key, value) { this.value = value; }
}

function installLeafletFake() {
    const tileLayers = [];
    const polylines = [];
    const layers = new Set();
    const map = {
        center: { lat: 35, lng: 135 },
        zoom: 10,
        options: null,
        handlers: new Map(),
        setView(center, zoom) {
            this.center = { lat: center[0], lng: center[1] };
            this.zoom = zoom;
            return this;
        },
        getCenter() { return { ...this.center }; },
        getZoom() { return this.zoom; },
        getMinZoom() { return 0; },
        getMaxZoom() { return this.options.maxZoom; },
        on(name, handler) { this.handlers.set(name, handler); },
        removeLayer(layer) { layers.delete(layer); },
        hasLayer(layer) { return layers.has(layer); }
    };

    globalThis.L = {
        map(_element, options) { map.options = options; return map; },
        tileLayer(url, options) {
            const layer = {
                kind: "tile",
                url,
                options,
                addTo() { layers.add(this); return this; },
                remove() { layers.delete(this); }
            };
            tileLayers.push(layer);
            return layer;
        },
        canvas(options) { return { options }; },
        layerGroup() {
            return {
                kind: "group",
                addTo() { layers.add(this); return this; },
                remove() { layers.delete(this); }
            };
        },
        polyline(latLngs, options) {
            const layer = {
                latLngs,
                options,
                handlers: new Map(),
                addTo() { return this; },
                on(name, handler) { this.handlers.set(name, handler); },
                setStyle() {}
            };

            polylines.push(layer);
            return layer;
        }
    };

    return { map, layers, tileLayers, polylines };
}

function createCoordinator(eventBus, mapView, store) {
    return new ViewStateCoordinator({
        eventBus,
        mapView,
        store,
        controls: {},
        displayState: new DisplayState(),
        displayQueue: { async whenIdle() {} },
        selectionState: new SelectionState()
    });
}

function run() {
    const { map, layers, tileLayers, polylines } = installLeafletFake();
    const eventBus = new EventBus();
    const storage = new MemoryStorage();
    const store = new ViewStateStore({ ...Config.viewState, storage });
    const mapView = new MapView(Config, eventBus);
    const libraryPanel = new LibraryAccessPanel();
    libraryPanel.bindDisplayActions(eventBus);
    document.body.append(libraryPanel.element);

    mapView.element.style.width = "900px";
    mapView.element.style.height = "400px";
    document.body.append(mapView.element);
    createCoordinator(eventBus, mapView, store);
    eventBus.on("map:display-mode-changed", ({ mode }) => {
        mapView.setMapDisplayMode(mode);
    });
    mapView.initialize();
    assert(mapView.getBaseMap() === DEFAULT_BASE_MAP,
        "default base map is not OSM");
    assert(tileLayers[0].url === Config.map.tileUrl &&
        tileLayers[0].options.attribution === Config.map.tileAttribution,
    "existing OSM definition changed");

    let clickedTrack = null;

    eventBus.on("map:track-clicked", event => { clickedTrack = event; });
    mapView.displayGPX("tap.gpx", {
        tracks: [{ segments: [{ points: [
            { latitude: 35, longitude: 135 },
            { latitude: 35.1, longitude: 135.1 }
        ] }] }],
        waypoints: []
    }, Config.map.trackStyle);
    polylines.at(-1).handlers.get("click")({
        containerPoint: { x: 123, y: 45 }
    });
    assert(clickedTrack?.path === "tap.gpx" &&
        clickedTrack.point?.x === 123 && clickedTrack.point?.y === 45,
    "Track tap did not preserve its Leaflet map-container point");
    mapView.removeGPX("tap.gpx");

    const center = map.getCenter();
    const zoom = map.getZoom();
    const visibleEntry = { marker: "visible" };

    mapView.layerManager.layers.set("track.gpx", visibleEntry);
    mapView.layerManager.selectedPath = "track.gpx";
    eventBus.emit("map:base-map-changed", { baseMap: "gsiStandard" });
    assert(mapView.getBaseMap() === "gsiStandard" &&
        mapView.baseTileLayer.url === BASE_MAPS.gsiStandard.url,
    "GSI standard switch failed");
    assert(map.getCenter().lat === center.lat && map.getCenter().lng === center.lng,
        "base map switch changed center");
    assert(map.getZoom() === zoom, "base map switch changed zoom");
    assert(mapView.layerManager.layers.get("track.gpx") === visibleEntry,
        "base map switch changed visible Track");
    assert(mapView.layerManager.selectedPath === "track.gpx",
        "base map switch changed selected Track");
    assert([...layers].filter(layer => layer.kind === "tile").length === 1,
        "multiple base tile layers are displayed");
    assert(mapView.baseTileLayer.options.maxZoom === 18 &&
        mapView.baseTileLayer.options.attribution.includes("国土地理院") &&
        mapView.baseTileLayer.options.attribution.includes(
            "https://maps.gsi.go.jp/development/ichiran.html"
        ),
    "GSI attribution or maxZoom is invalid");

    eventBus.emit("map:base-map-changed", { baseMap: "osm" });
    assert(mapView.baseTileLayer.options.attribution === Config.map.tileAttribution,
        "OSM attribution changed after switching back");
    eventBus.emit("map:display-mode-changed", { mode: "monochrome" });
    eventBus.emit("map:base-map-changed", { baseMap: "gsiStandard" });
    assert(mapView.getMapDisplayMode() === "monochrome" &&
        mapView.element.querySelector(".map-canvas").classList.contains(
            "map--monochrome"
        ), "XYZ basemap switching lost monochrome presentation state");
    eventBus.emit("map:display-mode-changed", { mode: "color" });
    eventBus.emit("map:base-map-changed", { baseMap: "gsiStandard" });
    assert(JSON.parse(storage.value).global.baseMap === "gsiStandard",
        "base map was not saved to view state");

    const restoredStore = new ViewStateStore({
        ...Config.viewState,
        storage: new MemoryStorage(storage.value)
    });
    const restoredLeaflet = installLeafletFake();
    const restoredEventBus = new EventBus();
    const restoredMapView = new MapView(Config, restoredEventBus);

    createCoordinator(restoredEventBus, restoredMapView, restoredStore);
    restoredMapView.initialize();
    assert(restoredMapView.getBaseMap() === "gsiStandard" &&
        restoredLeaflet.tileLayers[0].url === BASE_MAPS.gsiStandard.url,
        "saved base map was not restored");

    const unknownStore = new ViewStateStore({
        ...Config.viewState,
        storage: new MemoryStorage(JSON.stringify({
            version: Config.viewState.schemaVersion,
            global: { baseMap: "unknown" },
            libraries: {}
        }))
    });

    assert(unknownStore.getBaseMap() === "osm",
        "unknown stored base map did not fall back to OSM");
    for (const legacyPaleValue of ["gsiPale", "gsi-pale"]) {
        const paleStore = new ViewStateStore({
            ...Config.viewState,
            storage: new MemoryStorage(JSON.stringify({
                version: Config.viewState.schemaVersion,
                global: { baseMap: legacyPaleValue },
                libraries: {}
            }))
        });

        assert(paleStore.getBaseMap() === "osm",
            `${legacyPaleValue} did not fall back to OSM`);
    }
    const legacyStore = new ViewStateStore({
        ...Config.viewState,
        storage: new MemoryStorage(JSON.stringify({
            version: Config.viewState.schemaVersion,
            libraries: {}
        }))
    });

    assert(legacyStore.getBaseMap() === "osm",
        "legacy view state did not default to OSM");
    assert(mapView.element.querySelector(".base-map-select").options.length === 3,
        "base map selector exposes an unsupported provider");

    const toolbar = mapView.element.querySelector(".map-toolbar");
    const toolbarControls = [...toolbar.children];
    const toolbarBounds = toolbar.getBoundingClientRect();

    assert(toolbarControls.length === 2 &&
        toolbar.querySelector(".base-map-control") &&
        toolbar.querySelector(".map-mode-control") &&
        !toolbar.querySelector(".waypoint-toggle") &&
        !toolbar.querySelector(".map-clear"),
    "desktop Map toolbar still contains relocated Library actions");
    assert(toolbar.querySelector(".base-map-control .map-toolbar-label")
        ?.textContent === "地図" &&
        toolbar.querySelector(".map-mode-control .map-toolbar-label")
            ?.textContent === "表示",
    "desktop Map toolbar retained ambiguous visible labels");
    assert(getComputedStyle(toolbar).display === "flex" &&
        getComputedStyle(toolbar).borderTopStyle === "solid" &&
        toolbarControls.every(control => {
            const bounds = control.getBoundingClientRect();
            return bounds.left >= toolbarBounds.left - 1 &&
                bounds.right <= toolbarBounds.right + 1 &&
                bounds.top >= toolbarBounds.top - 1 &&
                bounds.bottom <= toolbarBounds.bottom + 1;
        }),
    "desktop Map controls do not share one bounded toolbar");

    const baseMapSelect = toolbar.querySelector(".base-map-select");
    const displayModeSelect = toolbar.querySelector(".map-mode-select");
    let waypointVisible = null;
    let clearRequests = 0;

    eventBus.on("map:waypoint-visibility-toggled", ({ visible }) => {
        waypointVisible = visible;
    });
    eventBus.on("map:clear-requested", () => { clearRequests += 1; });
    baseMapSelect.value = "osm";
    baseMapSelect.dispatchEvent(new Event("change"));
    displayModeSelect.value = "monochrome";
    displayModeSelect.dispatchEvent(new Event("change"));
    libraryPanel.element.querySelector(".waypoint-toggle input").checked = true;
    libraryPanel.element.querySelector(".waypoint-toggle input").dispatchEvent(
        new Event("change")
    );
    libraryPanel.element.querySelector(".map-clear").click();
    assert(mapView.getBaseMap() === "osm" &&
        mapView.getMapDisplayMode() === "monochrome" &&
        waypointVisible === true && clearRequests === 1,
    "desktop Map toolbar no longer uses the existing behavior paths");
    eventBus.emit("map:display-mode-changed", { mode: "color" });

    const mobileBaseMap = mapView.element.querySelector(
        ".mobile-base-map-toggle"
    );
    const mobileMapMode = mapView.element.querySelector(
        ".mobile-map-mode-toggle"
    );

    mapView.setBaseMap("osm");
    mobileBaseMap.click();
    assert(mapView.getBaseMap() === "gsiStandard" &&
        mobileBaseMap.dataset.state === "gsiStandard" &&
        mobileBaseMap.getAttribute("aria-pressed") === "true",
    "mobile base map toggle did not switch to GSI");
    mobileBaseMap.click();
    assert(mapView.getBaseMap() === "none" && mapView.baseTileLayer === null &&
        [...layers].filter(layer => layer.kind === "tile").length === 0,
    "mobile cycle did not remove the background map");
    assert(mapView.map === map && map.getCenter().lat === center.lat &&
        map.getCenter().lng === center.lng && map.getZoom() === zoom &&
        mapView.layerManager.layers.get("track.gpx") === visibleEntry &&
        mapView.layerManager.selectedPath === "track.gpx",
    "no-map mode changed map view, Track visibility, or selection");
    assert(new ViewStateStore({ ...Config.viewState,
        storage: new MemoryStorage(storage.value) }).getBaseMap() === "none",
    "no-map choice was not persisted");
    mobileBaseMap.click();
    assert(mapView.getBaseMap() === "osm" &&
        mobileBaseMap.dataset.state === "osm" &&
        mobileBaseMap.title.includes("地理院標準"),
    "mobile base map toggle did not switch back to OSM");
    mobileMapMode.click();
    assert(mapView.getMapDisplayMode() === "monochrome" &&
        mobileMapMode.dataset.state === "monochrome" &&
        mobileMapMode.getAttribute("aria-pressed") === "true",
    "mobile map mode toggle did not switch to Monochrome");
    mobileMapMode.click();
    assert(mapView.getMapDisplayMode() === "color" &&
        mobileMapMode.dataset.state === "color" &&
        mobileMapMode.title.includes("Monochrome"),
    "mobile map mode toggle did not switch back to Color");
    assert(mobileBaseMap.querySelector("svg") && mobileMapMode.querySelector("svg"),
        "mobile map toggles do not use inline SVG icons");

    assert(!mapView.sidebarDisplayControls.querySelector("input") &&
        !mapView.sidebarDisplayControls.querySelector(".mobile-sidebar-clear"),
    "mobile display controls retained relocated actions");
    assert(libraryPanel.libraryChangeContainer.contains(
        libraryPanel.element.querySelector(".waypoint-toggle")) &&
        libraryPanel.libraryChangeContainer.contains(
            libraryPanel.element.querySelector(".map-clear")),
    "Waypoint and Clear are not inside Library change");

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    run();
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
