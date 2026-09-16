import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import BasemapProviderRegistry from
    "../../src/js/services/BasemapProviderRegistry.js";
import OfflineTileResolver from
    "../../src/js/services/OfflineTileResolver.js";
import { canonicalTileKey } from
    "../../src/js/services/XYZTileEnumerator.js";
import OfflineTileLayer, {
    MISSING_TILE_URL
} from "../../src/js/ui/OfflineTileLayer.js";
import MapView from "../../src/js/ui/MapView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

async function waitFor(predicate) {
    for (let index = 0; index < 20; index += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
    throw new Error("Timed out waiting for tile state.");
}

class MemoryTileRepository {
    constructor(records = []) {
        this.records = new Map(records.map(record => [record.key, record]));
        this.reads = [];
    }
    async getTile(key) {
        this.reads.push(key);
        return this.records.get(key) ?? null;
    }
}

class FakeImage {
    constructor() {
        this.dataset = {};
        this.classes = new Set();
        this.classList = { add: value => this.classes.add(value) };
        this.attributes = new Map();
        this.sources = [];
        this.onload = null;
        this.onerror = null;
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    set src(value) { this.sources.push(value); this.currentSrc = value; }
    get src() { return this.currentSrc; }
    load() { this.onload?.(); }
    fail() { this.onerror?.(); }
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
        addTo(map) { map.layers.add(this); return this; }
        remove() { this.removed = true; }
    }
    return { TileLayer };
}

const provider = Object.freeze({
    id: "testAllowed",
    tileUrl: "https://tiles.invalid/{z}/{x}/{y}.png",
    attribution: "test",
    minZoom: 0,
    maxZoom: 4,
    tileSetVersion: "test-v1",
    offlineDownloadAllowed: true,
    termsUrl: "https://tiles.invalid/terms"
});

function storedRecord(blob, overrides = {}) {
    const identity = {
        providerId: provider.id,
        tileSetVersion: provider.tileSetVersion,
        z: 2, x: 3, y: 1,
        ...overrides
    };
    return {
        ...identity,
        key: canonicalTileKey(identity.providerId,
            identity.tileSetVersion, identity),
        blob
    };
}

async function testResolver() {
    const blob = new Blob(["tile"], { type: "image/png" });
    const record = storedRecord(blob);
    const repository = new MemoryTileRepository([record]);
    const resolver = new OfflineTileResolver(repository);
    const hit = await resolver.resolveTile(provider, record);

    assert(hit.status === "local-hit" && hit.blob === blob,
        "stored tile was not returned as a local hit");
    assert(repository.reads.length === 1 &&
        repository.reads[0] === record.key,
    "resolver did not query the canonical tile key");

    const miss = await resolver.resolveTile(provider, { z: 2, x: 2, y: 1 });
    assert(miss.status === "local-miss" && miss.key.endsWith("/2/2/1"),
        "missing local tile was not distinguished");

    const otherProvider = { ...provider, id: "otherProvider" };
    const other = await resolver.resolveTile(otherProvider, record);
    assert(other.status === "local-miss" &&
        repository.reads.at(-1).startsWith("otherProvider/"),
    "provider isolation read another provider's tile");
    const otherVersion = await resolver.resolveTile({
        ...provider, tileSetVersion: "test-v2"
    }, record);
    assert(otherVersion.status === "local-miss" &&
        repository.reads.at(-1).includes("/test-v2/"),
    "tile-set version isolation was lost");

    const readsBeforeGuard = repository.reads.length;
    const unavailable = await resolver.resolveTile({
        ...provider, id: "osm", offlineDownloadAllowed: false
    }, record);
    assert(unavailable.status === "unavailable" &&
        unavailable.reason === "provider-not-enabled",
    "disabled provider was not reported unavailable");
    assert(repository.reads.length === readsBeforeGuard,
        "disabled provider queried offline storage");
}

async function testLayer() {
    const blob = new Blob(["tile"], { type: "image/png" });
    const record = storedRecord(blob);
    const repository = new MemoryTileRepository([record]);
    const resolver = new OfflineTileResolver(repository);
    const leaflet = createLeafletFake();
    const created = [];
    const revoked = [];
    const statuses = [];
    let objectUrlId = 0;
    const objectUrlApi = {
        createObjectURL(value) {
            assert(value === blob, "object URL was created for the wrong Blob");
            const url = `blob:test-${++objectUrlId}`;
            created.push(url);
            return url;
        },
        revokeObjectURL(url) { revoked.push(url); }
    };
    const adapter = new OfflineTileLayer({
        leaflet, provider, resolver, objectUrlApi,
        imageFactory: () => new FakeImage(),
        onStatus: result => statuses.push(result.status)
    });
    const layer = adapter.create({ attribution: "test", maxZoom: 4 });
    let hitDone = 0;
    const hitTile = layer.createTile(record, error => {
        assert(!error, "local tile completion returned an error");
        hitDone += 1;
    });
    await waitFor(() => hitTile.src?.startsWith("blob:"));
    assert(hitTile.src === "blob:test-1" &&
        !hitTile.sources.some(url => url.startsWith("https://")),
    "local hit issued an online tile request");
    hitTile.load();
    assert(hitDone === 1 && revoked.includes("blob:test-1"),
        "local tile completion did not revoke its object URL");

    let fallbackDone = 0;
    const missTile = layer.createTile({ z: 2, x: 2, y: 1 }, () => {
        fallbackDone += 1;
    });
    await waitFor(() => missTile.src?.startsWith("https://"));
    assert(missTile.src === "https://tiles.invalid/2/2/1.png" &&
        statuses.includes("local-miss"),
    "local miss did not use the normal provider URL");
    missTile.load();
    assert(fallbackDone === 1 &&
        missTile.dataset.offlineTileStatus === "network-fallback",
    "successful online fallback was not distinguished");

    let missingDone = 0;
    const missingTile = layer.createTile({ z: 2, x: 1, y: 1 }, () => {
        missingDone += 1;
    });
    await waitFor(() => missingTile.src?.startsWith("https://"));
    missingTile.fail();
    assert(missingDone === 1 && missingTile.src === MISSING_TILE_URL &&
        missingTile.classes.has("offline-tile-missing"),
    "network failure did not produce the deterministic missing tile");
    assert(missingTile.dataset.offlineTileStatus === "unavailable",
        "network failure was not reported unavailable");

    const unloadTile = layer.createTile(record, () => {});
    await waitFor(() => unloadTile.src === "blob:test-2");
    layer.handlers.get("tileunload")({ tile: unloadTile });
    assert(revoked.filter(url => url === "blob:test-2").length === 1,
        "tile unload did not revoke the object URL");
    unloadTile.load();
    assert(revoked.filter(url => url === "blob:test-2").length === 1,
        "object URL was revoked more than once");
    assert(created.length === 2,
        "local misses unexpectedly created Blob URLs");

    let releaseResolution;
    const delayedAdapter = new OfflineTileLayer({
        leaflet,
        provider,
        resolver: {
            resolveTile: () => new Promise(resolve => {
                releaseResolution = resolve;
            })
        },
        objectUrlApi,
        imageFactory: () => new FakeImage()
    });
    const delayedLayer = delayedAdapter.create();
    const delayedTile = delayedLayer.createTile(record, () => {});
    delayedLayer.handlers.get("tileunload")({ tile: delayedTile });
    releaseResolution({ status: "local-hit", blob });
    await Promise.resolve();
    assert(delayedTile.sources.length === 0 && created.length === 2,
        "unloaded pending tile created a late object URL");
}

function installMapLeafletFake() {
    const layers = new Set();
    const onlineLayers = [];
    const map = {
        layers,
        options: {},
        setView() { return this; },
        getCenter() { return { lat: 35, lng: 135 }; },
        getZoom() { return 10; },
        getMinZoom() { return 0; },
        getMaxZoom() { return 19; },
        on() {},
        removeLayer(layer) { layers.delete(layer); },
        hasLayer(layer) { return layers.has(layer); }
    };
    globalThis.L = {
        map(_element, options) { map.options = options; return map; },
        tileLayer(url, options) {
            const layer = {
                url, options,
                addTo() { layers.add(this); return this; },
                remove() { layers.delete(this); }
            };
            onlineLayers.push(layer);
            return layer;
        },
        canvas(options) { return { options }; }
    };
    return { map, onlineLayers };
}

function testMapViewIntegration() {
    const leaflet = installMapLeafletFake();
    const registry = new BasemapProviderRegistry(Config.map, {
        additionalProviders: [provider]
    });
    let offlineLayers = 0;
    let resolverCalls = 0;
    const resolver = {
        async resolveTile() { resolverCalls += 1; return { status: "local-miss" }; }
    };
    const mapView = new MapView(Config, new EventBus(), {
        basemapProviders: registry,
        offlineTileResolver: resolver,
        offlineTileLayerFactory: options => {
            offlineLayers += 1;
            assert(options.provider.id === provider.id &&
                options.provider.tileSetVersion === provider.tileSetVersion,
                "MapView passed the wrong provider to the offline layer");
            return {
                addTo(map) { map.layers.add(this); return this; },
                remove() { leaflet.map.layers.delete(this); }
            };
        }
    });
    mapView.initialize();
    assert(leaflet.onlineLayers.length === 1 && offlineLayers === 0 &&
        resolverCalls === 0,
    "normal OSM startup entered the offline read path");
    mapView.setBaseMap("gsiStandard");
    assert(leaflet.onlineLayers.length === 2 && offlineLayers === 0,
        "normal GSI rendering entered the offline read path");
    mapView.setBaseMap(provider.id);
    assert(offlineLayers === 1 && resolverCalls === 0,
        "explicit offline provider did not use the adapter lazily");
}

try {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (...args) => {
        fetchCalls += 1;
        throw new Error(`Unexpected bulk fetch: ${args[0]}`);
    };
    try {
        await testResolver();
        await testLayer();
        testMapViewIntegration();
        assert(fetchCalls === 0, "offline read path introduced fetch/prefetch");
    } finally {
        globalThis.fetch = originalFetch;
    }
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
}
