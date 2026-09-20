import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import OfflineDownloadCoordinator from
    "../../src/js/core/OfflineDownloadCoordinator.js";
import OfflineMapsController from
    "../../src/js/core/OfflineMapsController.js";
import BasemapProviderRegistry from
    "../../src/js/services/BasemapProviderRegistry.js";
import OfflineMapsRepository from
    "../../src/js/services/OfflineMapsRepository.js";
import OfflineTileResolver from
    "../../src/js/services/OfflineTileResolver.js";
import { canonicalTileKey } from
    "../../src/js/services/XYZTileEnumerator.js";
import MapView from "../../src/js/ui/MapView.js";
import OfflineMapsPanel from "../../src/js/ui/OfflineMapsPanel.js";
import OfflineTileLayer from "../../src/js/ui/OfflineTileLayer.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

async function waitFor(predicate, message) {
    for (let index = 0; index < 100; index += 1) {
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    throw new Error(message);
}

function uniqueDatabase(suffix) {
    return `trailbook.offlineMaps.ui.${suffix}.${Date.now()}.${
        Math.random().toString(36).slice(2)}`;
}

const provider = Object.freeze({
    id: "testUi",
    name: "Local UI Test",
    tileUrl: "https://local.invalid/{z}/{x}/{y}.png",
    attribution: "local test",
    minZoom: 1,
    maxZoom: 4,
    tileSetVersion: "test-ui-v1",
    offlineDownloadAllowed: true,
    termsUrl: "https://local.invalid/terms"
});

function createRegistry() {
    return new BasemapProviderRegistry(Config.map, {
        additionalProviders: [provider]
    });
}

function responseFor(url) {
    return {
        ok: true,
        status: 200,
        headers: { get: () => "image/png" },
        async blob() {
            return new Blob([new TextEncoder().encode(url)], {
                type: "image/png"
            });
        }
    };
}

class FakeMapView {
    constructor() {
        this.baseMap = "osm";
        this.activeProvider = null;
        this.zoom = 2;
        this.bounds = { west: -1, south: -1, east: 1, north: 1 };
    }
    getBaseMap() { return this.baseMap; }
    getBaseMapProvider() { return this.activeProvider; }
    getZoom() { return this.zoom; }
    getCurrentBounds() { return { ...this.bounds }; }
}

class FakeImage {
    constructor() {
        this.dataset = {};
        this.classList = { add() {} };
        this.sources = [];
    }
    setAttribute() {}
    set src(value) { this.sources.push(value); this.currentSrc = value; }
    get src() { return this.currentSrc; }
}

function createLeafletFake() {
    class TileLayer {
        constructor(url, options = {}) {
            this.url = url;
            this.options = options;
            this.handlers = new Map();
        }
        static extend(methods) {
            return class extends TileLayer {
                createTile(coords, done) {
                    return methods.createTile.call(this, coords, done);
                }
            };
        }
        getTileUrl({ z, x, y }) {
            return this.url.replace("{z}", z).replace("{x}", x)
                .replace("{y}", y);
        }
        on(name, callback) { this.handlers.set(name, callback); return this; }
    }
    return { TileLayer };
}

function testMapBoundsApi() {
    const mapView = new MapView(Config, new EventBus());
    mapView.map = {
        getBounds() {
            return {
                getWest: () => 130,
                getSouth: () => 30,
                getEast: () => 140,
                getNorth: () => 40
            };
        }
    };
    const bounds = mapView.getCurrentBounds();

    assert(JSON.stringify(bounds) === JSON.stringify({
        west: 130, south: 30, east: 140, north: 40
    }), "MapView did not expose plain current geographic bounds");
    mapView.map = null;
    assert(mapView.getCurrentBounds() === null,
        "MapView returned bounds without an initialized map");
}

async function testWorkflow() {
    const databaseName = uniqueDatabase("workflow");
    const repository = new OfflineMapsRepository({ databaseName });
    const registry = createRegistry();
    const mapView = new FakeMapView();
    const panel = new OfflineMapsPanel();
    const host = document.getElementById("offline-host");
    const eventBus = new EventBus();
    const requests = [];
    const progress = [];
    const download = new OfflineDownloadCoordinator({
        providerRegistry: registry,
        repository,
        fetchImpl: async url => {
            requests.push(url);
            return responseFor(url);
        },
        storageEstimate: async () => ({ quota: 1000000, usage: 100 }),
        concurrency: 2,
        averageTileBytes: 25,
        now: () => 100
    });
    download.subscribe(value => progress.push(value));
    const externalListenerCount = download.listeners.size;
    const controller = new OfflineMapsController({
        panel,
        mapView,
        providerRegistry: registry,
        repository,
        downloadCoordinator: download,
        eventBus,
        now: () => 100
    });

    host.replaceChildren(panel.element);
    await controller.attach();
    assert(!panel.disclosure.open,
        "Offline Maps panel was not initially collapsed");
    assert(requests.length === 0,
        "controller construction/attach started a background tile fetch");
    assert(panel.planButton.disabled && panel.startButton.disabled,
        "OSM offline download actions were enabled");
    assert(panel.availabilityOutput.textContent.includes("not available"),
        "OSM download restriction was not explained");
    assert(await controller.planCurrentView() === null && requests.length === 0,
        "OSM planning bypassed the provider guard");

    const osm = registry.get("osm");
    await repository.createArea({
        id: "blocked-osm",
        name: "Blocked OSM",
        providerId: osm.id,
        providerTileSetVersion: osm.tileSetVersion,
        bbox: { west: 0, south: 0, east: 1, north: 1 },
        minZoom: 1,
        maxZoom: 1,
        createdAt: 1,
        status: "partial",
        plannedTileCount: 1,
        estimatedBytes: 25
    });
    await controller.refreshAreas();
    assert(panel.areaList.querySelector("button").disabled,
        "ineligible saved-area Resume action was enabled");
    assert(await controller.resume("blocked-osm") === null &&
        requests.length === 0,
    "direct Resume bypassed the coordinator/provider guard");
    await controller.deleteArea("blocked-osm");

    mapView.baseMap = "gsiStandard";
    controller.syncProvider();
    assert(panel.planButton.disabled &&
        await controller.planCurrentView() === null && requests.length === 0,
    "GSI offline download actions were enabled");

    mapView.baseMap = "pmtiles:kansai";
    mapView.activeProvider = {
        id: mapView.baseMap,
        name: "Kansai local PMTiles",
        sourceType: "pmtiles",
        packageId: "kansai-local",
        minZoom: 0,
        maxZoom: 15,
        offlineDownloadAllowed: false
    };
    controller.syncProvider();
    assert(panel.providerOutput.textContent.includes("Kansai local PMTiles") &&
        !panel.providerOutput.textContent.includes("Unavailable"),
    "active PMTiles basemap was labelled unavailable");
    assert(panel.planButton.disabled,
        "active PMTiles package bypassed Cached Areas provider eligibility");

    mapView.baseMap = provider.id;
    mapView.activeProvider = null;
    controller.syncProvider();
    assert(!panel.planButton.disabled && panel.startButton.disabled,
        "explicit offline-capable provider was not enabled for planning");
    assert(panel.providerOutput.textContent.includes(provider.name),
        "current provider name was not shown");

    panel.minZoomInput.value = "0";
    panel.maxZoomInput.value = "9";
    const plan = await controller.planCurrentView();
    assert(plan.minZoom === provider.minZoom &&
        plan.maxZoom === provider.maxZoom,
    "zoom range was not clamped to provider limits");
    assert(JSON.stringify(plan.bbox) === JSON.stringify(mapView.bounds),
        "download plan did not use the current map viewport");
    assert(panel.planOutput.textContent.includes(`${plan.tileCount} tiles`) &&
        plan.tileCount === plan.tiles.length,
    "exact plan tile count was not shown");
    assert(panel.planOutput.textContent.includes(
        `${plan.estimatedBytes < 1024 ? plan.estimatedBytes + " B" : "KB"}`
    ), "estimated download size was not shown");
    assert(panel.quotaOutput.textContent.includes("advisory") &&
        panel.quotaOutput.textContent.includes("available"),
    "quota estimate was not presented as advisory information");
    assert(!panel.startButton.disabled,
        "planned area did not enable the start action");

    panel.minZoomInput.value = "4";
    panel.maxZoomInput.value = "2";
    const invalid = await controller.planCurrentView();
    assert(invalid === null && panel.statusOutput.dataset.state === "error",
        "invalid zoom range was not rejected");

    panel.minZoomInput.value = "2";
    panel.maxZoomInput.value = "2";
    const currentPlan = await controller.planCurrentView();
    const firstRun = controller.start();
    const duplicate = await controller.start();
    assert(duplicate === null,
        "duplicate simultaneous download was not rejected");
    const result = await firstRun;
    assert(result.status === "complete" && result.completedCount ===
        currentPlan.tileCount,
    "planned current viewport did not complete");
    assert(requests.length === currentPlan.tileCount,
        "download did not request exactly the missing planned tiles");
    assert(progress.at(-1).status === "complete" &&
        panel.progress.value === currentPlan.tileCount,
    "download progress did not converge to complete");
    assert(panel.areaList.children.length === 1 &&
        panel.areaList.textContent.includes("complete"),
    "completed area list was not refreshed");
    assert(panel.areaList.querySelector("button").disabled,
        "completed area incorrectly enabled Resume");

    const firstTile = currentPlan.tiles[0];
    const firstKey = canonicalTileKey(provider.id,
        provider.tileSetVersion, firstTile);
    assert(await repository.getTile(firstKey),
        "completed download did not persist its tile");

    const resolver = new OfflineTileResolver(repository);
    const objectUrls = [];
    const layer = new OfflineTileLayer({
        leaflet: createLeafletFake(),
        provider,
        resolver,
        objectUrlApi: {
            createObjectURL() {
                const value = "blob:offline-ui";
                objectUrls.push(value);
                return value;
            },
            revokeObjectURL() {}
        },
        imageFactory: () => new FakeImage()
    }).create();
    const tile = layer.createTile(firstTile, () => {});
    await waitFor(() => tile.src, "stored tile did not resolve");
    assert(tile.src === "blob:offline-ui" &&
        !tile.sources.some(value => value.startsWith("https://")),
    "stored area did not render locally with network unavailable");
    assert(objectUrls.length === 1,
        "stored tile did not use the offline Blob read path");

    const secondPlan = await download.planDownload({
        ...currentPlan,
        id: "shared-area",
        name: "Shared area"
    });
    const beforeShared = requests.length;
    await download.startDownload(secondPlan);
    assert(requests.length === beforeShared,
        "shared area fetched already-stored tiles again");
    await controller.refreshAreas();
    assert(panel.areaList.children.length === 2,
        "saved-area list did not show both areas");

    const firstAreaId = currentPlan.id;
    await controller.deleteArea(firstAreaId);
    assert(await repository.getArea(firstAreaId) === null &&
        await repository.getTile(firstKey),
    "area deletion removed a tile still shared by another area");
    assert(panel.areaList.children.length === 1,
        "area deletion did not refresh the saved list");

    await controller.deleteArea("shared-area");
    assert(await repository.getTile(firstKey) === null,
        "last area deletion left an orphan tile");
    assert(panel.areaList.textContent.includes("No saved areas"),
        "empty saved-area state was not displayed");

    await controller.attach();
    assert(download.listeners.size === externalListenerCount + 1 &&
        eventBus.events["map:base-map-changed"].length === 1,
    "repeated attach introduced duplicate subscriptions");
    assert(controller.detach() &&
        download.listeners.size === externalListenerCount &&
        Object.keys(panel.actions).length === 0,
    "controller detach did not release panel/progress subscriptions");
    await controller.attach();
    assert(download.listeners.size === externalListenerCount + 1 &&
        eventBus.events["map:base-map-changed"].length === 1,
    "reattach introduced duplicate listeners");
    controller.detach();

    indexedDB.deleteDatabase(databaseName);
}

async function testCancelAndResume() {
    const databaseName = uniqueDatabase("cancel");
    const repository = new OfflineMapsRepository({ databaseName });
    const registry = createRegistry();
    const mapView = new FakeMapView();
    mapView.baseMap = provider.id;
    mapView.bounds = { west: -180, south: -80, east: 180, north: 80 };
    let blocked = true;
    let requests = 0;
    const download = new OfflineDownloadCoordinator({
        providerRegistry: registry,
        repository,
        concurrency: 2,
        fetchImpl: (url, { signal }) => {
            requests += 1;
            if (!blocked) return Promise.resolve(responseFor(url));
            return new Promise((resolve, reject) => {
                signal.addEventListener("abort", () => {
                    reject(new DOMException("Cancelled", "AbortError"));
                }, { once: true });
            });
        }
    });
    const panel = new OfflineMapsPanel();
    const controller = new OfflineMapsController({
        panel, mapView, providerRegistry: registry, repository,
        downloadCoordinator: download, now: () => 200
    });
    await controller.attach();
    panel.minZoomInput.value = "2";
    panel.maxZoomInput.value = "2";
    const plan = await controller.planCurrentView();
    const running = controller.start();
    await waitFor(() => requests > 0, "cancel test did not start requests");
    assert(controller.cancel(), "active download did not accept cancellation");
    const partial = await running;
    assert(partial.status === "partial" && partial.cancelled,
        "cancelled download was not retained as partial");
    assert((await repository.getArea(plan.id)).status === "partial",
        "partial saved-area status was not persisted");

    blocked = false;
    const beforeResume = requests;
    const resumed = await controller.resume(plan.id);
    assert(resumed.status === "complete" &&
        requests - beforeResume === plan.tileCount,
    "resume did not fetch only the missing tiles to completion");
    assert(panel.areaList.textContent.includes("complete"),
        "resumed area list did not converge to complete");

    indexedDB.deleteDatabase(databaseName);
}

function testResponsiveLayout() {
    const panel = document.querySelector(".offline-maps-panel");
    const shell = document.querySelector(".sidebar-shell");
    const content = panel.querySelector(".offline-maps-content");

    panel.querySelector("details").open = true;
    const rect = panel.getBoundingClientRect();
    const contentStyle = getComputedStyle(content);
    const shellStyle = getComputedStyle(shell);
    assert(innerWidth === 390 || innerWidth === 844,
        `unexpected responsive test viewport: ${innerWidth}x${innerHeight}`);
    assert(rect.left >= 0 && rect.right <= innerWidth,
        "Offline Maps panel was clipped horizontally");
    assert(!["auto", "scroll"].includes(contentStyle.overflowY),
        "Offline Maps panel introduced a nested vertical scroll");
    assert(shellStyle.overflowY === "auto",
        "open Offline Maps panel did not use the sidebar scroll container");
    assert([...panel.querySelectorAll("button")].every(button =>
        button.getBoundingClientRect().height >= 40),
    "Offline Maps actions are too small for mobile use");
}

try {
    testMapBoundsApi();
    await testWorkflow();
    await testCancelAndResume();
    testResponsiveLayout();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
}
