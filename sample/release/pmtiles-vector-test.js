import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import OfflineMapPackagesController from
    "../../src/js/core/OfflineMapPackagesController.js";
import OfflineMapArchiveStore from
    "../../src/js/services/OfflineMapArchiveStore.js";
import PMTilesArchiveReader from
    "../../src/js/services/PMTilesArchiveReader.js";
import PMTilesArchiveSource from
    "../../src/js/services/PMTilesArchiveSource.js";
import BasemapLayerFactory from "../../src/js/ui/BasemapLayerFactory.js";
import MapView from "../../src/js/ui/MapView.js";
import PMTilesVectorLayer from "../../src/js/ui/PMTilesVectorLayer.js";
import { createTinyVectorPMTiles } from "./tiny-vector-pmtiles-fixture.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

async function rejects(operation, message) {
    let error = null;
    try {
        await operation();
    } catch (caught) {
        error = caught;
    }
    assert(error, message);
}

function waitFor(condition, message, timeout = 3000) {
    const started = performance.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            if (condition()) return resolve();
            if (performance.now() - started > timeout) {
                return reject(new Error(message));
            }
            setTimeout(check, 20);
        };
        check();
    });
}

function provider(id = "vector-fixture", packageId = "vector-fixture") {
    return Object.freeze({
        id,
        name: id,
        sourceType: "pmtiles",
        packageId,
        packageVersion: "fixture-v1",
        tileType: "mvt",
        attribution: "Vector fixture attribution",
        minZoom: 0,
        maxZoom: 0,
        offlineDownloadAllowed: false
    });
}

async function installFixture(store, packageId, bytes) {
    await store.deleteArchive(packageId);
    await store.createPartial(packageId, { truncate: true });
    await store.writePartial(packageId, bytes, { offset: 0 });
    return store.finalize(packageId);
}

async function testReaderAndRangeSource(store, packageId, bytes) {
    const reader = new PMTilesArchiveReader();
    let rangeReads = 0;
    const trackingStore = {
        getFileSize: (...args) => store.getFileSize(...args),
        readRange: (...args) => {
            rangeReads += 1;
            return store.readRange(...args);
        }
    };
    const inspected = await reader.inspectSource(
        new PMTilesArchiveSource(trackingStore, packageId),
        { expectedSize: bytes.length }
    );
    assert(inspected.archiveVersion === 3 && inspected.tileType === "mvt",
        "valid PMTiles v3 MVT archive was rejected");
    assert(inspected.metadata.vector_layers.length === 3 && rangeReads > 0,
        "MVT metadata did not use OPFS range reads");
    assert(new TextDecoder().decode(bytes).includes("Fallback Town"),
        "fixture no longer covers a label without name:ja fallback");

    const rasterId = packageId + "-raster-header";
    const rasterBytes = createTinyVectorPMTiles({ tileType: 2 });
    await installFixture(store, rasterId, rasterBytes);
    const raster = await reader.inspectSource(
        new PMTilesArchiveSource(store, rasterId),
        { expectedSize: rasterBytes.length }
    );
    assert(raster.tileType === "png", "raster PMTiles acceptance regressed");
    await store.deleteArchive(rasterId);

    const unsupportedId = packageId + "-unsupported";
    const unsupported = createTinyVectorPMTiles({ tileType: 6 });
    await installFixture(store, unsupportedId, unsupported);
    await rejects(() => reader.inspectSource(
        new PMTilesArchiveSource(store, unsupportedId),
        { expectedSize: unsupported.length }
    ), "unsupported PMTiles tile type was accepted");
    await store.deleteArchive(unsupportedId);
}

function testVectorAdapterConfiguration(store, source) {
    let options = null;
    const layer = { marker: "vector-layer" };
    const adapter = new PMTilesVectorLayer({
        leaflet: globalThis.L,
        archiveStore: store,
        renderer: {
            leafletLayer(value) {
                options = value;
                return layer;
            }
        }
    });
    assert(adapter.create(source, { pane: "tilePane" }) === layer,
        "vector renderer layer was not returned");
    assert(options.url?.source instanceof PMTilesArchiveSource &&
        options.url.source.packageId === source.packageId,
    "vector renderer did not receive the OPFS PMTiles source");
    assert(options.lang === "ja" && options.flavor === "light",
        "Japanese built-in vector style configuration was lost");
    assert(options.attribution === source.attribution &&
        options.minZoom === 0 && options.maxZoom === 0,
    "vector attribution or zoom range was lost");
    assert(!("styleUrl" in options) && !("fontUrl" in options) &&
        !("spriteUrl" in options),
    "vector adapter introduced a remote style/font/sprite dependency");
}

function testLayerFactoryRoutes() {
    const calls = [];
    const leaflet = {
        tileLayer(url) { calls.push(["xyz", url]); return { kind: "xyz" }; }
    };
    const factory = new BasemapLayerFactory({
        leaflet,
        offlineTileResolver: { resolveTile() {} },
        archiveStore: { readRange() {} },
        offlineLayerFactory() { calls.push(["offline"]); return { kind: "offline" }; },
        rasterPMTilesLayerFactory() { calls.push(["raster"]); return { kind: "raster" }; },
        vectorPMTilesLayerFactory() { calls.push(["vector"]); return { kind: "vector" }; }
    });
    assert(factory.create({ sourceType: "xyz", tileUrl: "local://xyz" }).kind ===
        "xyz", "XYZ provider did not use the normal Leaflet route");
    assert(factory.create({ sourceType: "offline-xyz" }).kind === "offline",
        "offline XYZ provider did not use OfflineTileLayer");
    assert(factory.create({ sourceType: "pmtiles", tileType: "png" }).kind ===
        "raster", "raster PMTiles provider did not use the raster renderer");
    assert(factory.create({ sourceType: "pmtiles", tileType: "mvt" }).kind ===
        "vector", "MVT PMTiles provider did not use the vector renderer");
    assert(calls.map(call => call[0]).join(",") ===
        "xyz,offline,raster,vector", "basemap route order changed");
}

async function testOfflineRender(store, source) {
    const mapElement = document.getElementById("map");
    const map = L.map(mapElement, { zoomControl: false }).setView([0, 0], 0);
    const overlay = L.polyline([[0, -20], [0, 20]], { color: "#ff0000" })
        .addTo(map);
    let tileLoads = 0;
    let networkCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (...args) => {
        networkCalls += 1;
        throw new Error(`Unexpected vector network request: ${args[0]}`);
    };
    try {
        const layer = new PMTilesVectorLayer({
            leaflet: L,
            archiveStore: store
        }).create(source);
        layer.on("tileload", () => { tileLoads += 1; });
        layer.addTo(map);
        await waitFor(() => tileLoads > 0,
            "local vector PMTiles did not render");
        assert(networkCalls === 0,
            "installed vector package issued a network request");
        assert(mapElement.querySelector("canvas.leaflet-tile")?.lang === "ja",
            "renderer canvas did not retain Japanese language configuration");
        assert(map.attributionControl.getContainer().textContent.includes(
            source.attribution
        ), "vector attribution was not shown");
        assert(map.hasLayer(overlay), "GPX-equivalent overlay was hidden by basemap");
        mapElement.classList.add("map--monochrome");
        assert(getComputedStyle(map.getPane("tilePane")).filter !== "none",
            "monochrome presentation did not include vector PMTiles canvas tiles");
        mapElement.classList.remove("map--monochrome");
        assert(getComputedStyle(map.getPane("tilePane")).filter === "none",
            "color presentation retained the monochrome PMTiles filter");
        const identity = map;
        map.panBy([8, 0], { animate: false });
        layer.rerenderTiles();
        await new Promise(resolve => setTimeout(resolve, 100));
        assert(networkCalls === 0 && map === identity && map.hasLayer(overlay),
            "pan/re-render used network or replaced the Leaflet map/overlay");
        layer.remove();
        assert(!map.hasLayer(layer) && map.hasLayer(overlay),
            "vector layer removal removed the overlay or left the layer active");
        layer.addTo(map);
        await waitFor(() => map.hasLayer(layer),
            "vector layer could not be re-added");
        assert(networkCalls === 0,
            "vector layer re-add introduced a network request");
        layer.remove();
    } finally {
        globalThis.fetch = originalFetch;
        map.remove();
    }
}

function installLeafletFake() {
    const layers = new Set();
    const map = {
        layers, options: {}, handlers: new Map(), identity: Symbol("map"),
        setView() { return this; },
        getCenter() { return { lat: 0, lng: 0 }; },
        getZoom() { return 0; }, getMinZoom() { return 0; },
        getMaxZoom() { return 19; },
        on(name, handler) { this.handlers.set(name, handler); },
        removeLayer(layer) { layers.delete(layer); },
        hasLayer(layer) { return layers.has(layer); }
    };
    globalThis.L = {
        map(_element, options) { map.options = options; return map; },
        tileLayer(url, options) {
            return fakeLayer("xyz", url, options, layers);
        },
        canvas(options) { return { options }; }
    };
    return map;
}

function fakeLayer(kind, id, options, layers) {
    return {
        kind, id, options,
        addTo() { layers.add(this); return this; },
        remove() { layers.delete(this); }
    };
}

function testMapViewSwitching() {
    const map = installLeafletFake();
    let sources = [
        { id: "osm", name: "OSM", sourceType: "xyz", tileUrl: "osm",
            attribution: "osm", maxZoom: 19 },
        { id: "gsiStandard", name: "GSI", sourceType: "xyz", tileUrl: "gsi",
            attribution: "gsi", maxZoom: 18 },
        { id: "raster", name: "Raster", sourceType: "pmtiles",
            packageId: "raster", tileType: "png", attribution: "raster",
            minZoom: 0, maxZoom: 10 },
        provider("vector-a", "vector-a"),
        provider("vector-b", "vector-b")
    ];
    const catalog = {
        get(id) { return sources.find(item => item.id === id) ?? sources[0]; },
        normalizeId(id) { return sources.some(item => item.id === id) ? id : "osm"; },
        list() { return sources; }
    };
    const factory = {
        create(source, options) {
            return fakeLayer(source.tileType ?? "xyz", source.id, options,
                map.layers);
        },
        setOfflineTileResolver() {}, setArchiveStore() {}
    };
    const eventBus = new EventBus();
    const view = new MapView(Config, eventBus, {
        basemapProviders: catalog,
        basemapLayerFactory: factory
    });
    eventBus.on("map:base-map-changed", ({ baseMap }) => {
        view.setBaseMap(baseMap);
    });
    view.initialize();
    const mapIdentity = view.map.identity;
    const overlay = { marker: "gpx" };
    view.layerManager.layers.set("track.gpx", overlay);
    view.setMapDisplayMode("monochrome");
    for (const id of ["raster", "vector-a", "vector-b", "raster", "osm"]) {
        view.setBaseMap(id);
        assert(view.baseTileLayer.id === id && map.layers.size === 1 &&
            view.baseTileLayer.options.attribution ===
                catalog.get(id).attribution,
            `${id} switch left a duplicate or wrong basemap layer`);
        assert(view.map.identity === mapIdentity &&
            view.layerManager.layers.get("track.gpx") === overlay,
        `${id} switch replaced the map or GPX overlay`);
        assert(view.getMapDisplayMode() === "monochrome" &&
            view.element.querySelector(".map-canvas")?.classList.contains(
                "map--monochrome"
            ), `${id} switch lost the current map display mode`);
    }
    assert(view.baseTileLayer.options.attribution === "osm",
        "switching back to XYZ did not restore attribution options");

    const cycleButton = view.element.querySelector(".mobile-base-map-toggle");
    const assertCurrent = (id, message, mode = "monochrome") => {
        assert(view.getBaseMap() === id && view.baseTileLayer.id === id &&
            view.baseTileLayer.options.attribution === catalog.get(id).attribution,
        `${message}: active=${view.getBaseMap()}, layer=${view.baseTileLayer.id}, ` +
            `attribution=${view.baseTileLayer.options.attribution}`);
        assert(view.map.identity === mapIdentity &&
            view.layerManager.layers.get("track.gpx") === overlay &&
            view.getMapDisplayMode() === mode &&
            view.element.querySelector(".map-canvas")?.classList.contains(
                "map--monochrome"
            ) === (mode === "monochrome"),
        `${message}: map, GPX overlay, or display mode changed`);
    };

    cycleButton.click();
    assertCurrent("gsiStandard", "OSM did not cycle to GSI");
    assert(cycleButton.title.includes("Raster"),
        `GSI next-step label omitted offline package: ${cycleButton.title}`);
    cycleButton.click();
    assertCurrent("raster", "GSI did not cycle to the first ready package");
    cycleButton.click();
    assertCurrent("osm", "PMTiles did not cycle back to OSM");

    view.setMapDisplayMode("color");
    view.setBaseMap("vector-b");
    cycleButton.click();
    assertCurrent("osm", "selected package did not cycle back to OSM", "color");
    cycleButton.click();
    assertCurrent("gsiStandard", "OSM did not retain GSI as the next step", "color");
    cycleButton.click();
    assertCurrent("vector-b", "last selected package was not the offline slot", "color");

    sources = sources.filter(source => source.id !== "vector-b");
    view.setBasemapProviders(catalog);
    assertCurrent("osm", "removed active package did not fall back to OSM", "color");
    cycleButton.click();
    assertCurrent("gsiStandard", "cycle did not reach GSI after removal", "color");
    cycleButton.click();
    assertCurrent("raster", "removed cycle slot was not replaced by a ready package",
        "color");

    sources = sources.filter(source => source.sourceType !== "pmtiles");
    view.setBasemapProviders(catalog);
    assertCurrent("osm", "removing the final active package did not fall back", "color");
    cycleButton.click();
    assertCurrent("gsiStandard", "two-way cycle did not reach GSI", "color");
    cycleButton.click();
    assertCurrent("osm", "removed package remained in the basemap cycle", "color");
}

async function testActiveVectorDeletionFallback() {
    const eventBus = new EventBus();
    const emitted = [];
    eventBus.on("map:base-map-changed", value => emitted.push(value.baseMap));
    const entry = { packageId: "vector-active", actions: { delete: true } };
    const panel = {
        bindPackageActions() {}, showPackages() {}, showPackageStorage() {},
        showPackageStatus() {}
    };
    const regionCatalog = {
        get() { return entry; },
        async refresh() { return []; },
        async getStorageSummary() { return {}; },
        projectDownloadState() { return []; }
    };
    const basemapCatalog = {
        async refresh() { return []; }, list() { return []; },
        get() { return null; }, normalizeId() { return "osm"; }
    };
    let deleted = 0;
    const downloadCoordinator = {
        subscribe() { return () => {}; }, getState() { return { status: "idle" }; },
        async deletePackage() { deleted += 1; return true; }
    };
    const mapView = {
        getBaseMapProvider() { return provider("active", "vector-active"); },
        setBasemapProviders() {}
    };
    const controller = new OfflineMapPackagesController({
        panel, mapView, eventBus, regionCatalog, basemapCatalog,
        downloadCoordinator
    });
    await controller.deletePackage("vector-active");
    assert(deleted === 1 && emitted.length === 1 && emitted[0] === "osm",
        "deleting the active vector package did not request safe fallback");
}

const packageId = "vector-phase-e-" + Date.now();
const bytes = createTinyVectorPMTiles();
const store = new OfflineMapArchiveStore();

try {
    assert(bytes.length < 4096,
        "deterministic vector fixture is no longer repository-small");
    await installFixture(store, packageId, bytes);
    const source = provider("vector-fixture", packageId);
    await testReaderAndRangeSource(store, packageId, bytes);
    testVectorAdapterConfiguration(store, source);
    testLayerFactoryRoutes();
    await testOfflineRender(store, source);
    testMapViewSwitching();
    await testActiveVectorDeletionFallback();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
    throw error;
} finally {
    await store.deleteArchive(packageId).catch(() => {});
}
