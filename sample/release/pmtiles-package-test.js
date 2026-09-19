import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import OfflineMapPackageImportCoordinator from
    "../../src/js/core/OfflineMapPackageImportCoordinator.js";
import BasemapProviderRegistry from
    "../../src/js/services/BasemapProviderRegistry.js";
import OfflineMapPackageCatalog from
    "../../src/js/services/OfflineMapPackageCatalog.js";
import OfflineMapPackageRepository from
    "../../src/js/services/OfflineMapPackageRepository.js";
import PMTilesArchiveReader from
    "../../src/js/services/PMTilesArchiveReader.js";
import PMTilesArchiveSource, {
    OfflineMapArchiveMissingError
} from "../../src/js/services/PMTilesArchiveSource.js";
import MapView from "../../src/js/ui/MapView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

async function rejects(operation, message, predicate = () => true) {
    let error = null;
    try {
        await operation();
    } catch (caught) {
        error = caught;
    }
    assert(error && predicate(error), message);
}

function setUint64(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
    view.setUint32(offset + 4, Math.floor(value / 2 ** 32), true);
}

function fixtureBytes({ version = 3, tileType = 2, padding = 20000 } = {}) {
    const png = Uint8Array.from(atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    ), character => character.charCodeAt(0));
    const metadata = new TextEncoder().encode(JSON.stringify({
        name: "Tiny Raster",
        attribution: "Fixture attribution"
    }));
    const root = Uint8Array.of(1, 0, 1, png.length, 1);
    const rootOffset = 127;
    const metadataOffset = rootOffset + root.length;
    const tileOffset = metadataOffset + metadata.length;
    const bytes = new Uint8Array(Math.max(padding, tileOffset + png.length));
    bytes.set(new TextEncoder().encode("PMTiles"), 0);
    const view = new DataView(bytes.buffer);
    view.setUint8(7, version);
    [
        [8, rootOffset], [16, root.length],
        [24, metadataOffset], [32, metadata.length],
        [40, tileOffset], [48, 0],
        [56, tileOffset], [64, png.length],
        [72, 1], [80, 1], [88, 1]
    ].forEach(([offset, value]) => setUint64(view, offset, value));
    view.setUint8(96, 1);
    view.setUint8(97, 1);
    view.setUint8(98, 1);
    view.setUint8(99, tileType);
    view.setUint8(100, 0);
    view.setUint8(101, 0);
    view.setInt32(102, -1800000000, true);
    view.setInt32(106, -850000000, true);
    view.setInt32(110, 1800000000, true);
    view.setInt32(114, 850000000, true);
    view.setUint8(118, 0);
    view.setInt32(119, 0, true);
    view.setInt32(123, 0, true);
    bytes.set(root, rootOffset);
    bytes.set(metadata, metadataOffset);
    bytes.set(png, tileOffset);
    return bytes;
}

class TrackingFile {
    constructor(bytes, name = "tiny.pmtiles") {
        this.bytes = bytes;
        this.name = name;
        this.size = bytes.length;
        this.type = "application/vnd.pmtiles";
        this.slices = [];
    }
    slice(start, end) {
        this.slices.push([start, end]);
        return new Blob([this.bytes.slice(start, end)], { type: this.type });
    }
}

async function toBytes(value) {
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

class MemoryArchiveStore {
    constructor() {
        this.files = new Map();
        this.writeSizes = [];
        this.finalized = [];
    }
    getPaths(id) {
        const base = "trailbook/offline-map-packages/" + id;
        return { partial: base + ".partial", final: base + ".pmtiles" };
    }
    entry(id) {
        if (!this.files.has(id)) this.files.set(id, {});
        return this.files.get(id);
    }
    async createPartial(id, { truncate = false } = {}) {
        const entry = this.entry(id);
        if (truncate || !entry.partial) entry.partial = new Uint8Array();
        return { path: this.getPaths(id).partial, size: entry.partial.length };
    }
    async writePartial(id, value, { offset = null } = {}) {
        const chunk = await toBytes(value);
        this.writeSizes.push(chunk.length);
        const entry = this.entry(id);
        const current = entry.partial ?? new Uint8Array();
        const position = offset ?? current.length;
        const next = new Uint8Array(Math.max(current.length,
            position + chunk.length));
        next.set(current);
        next.set(chunk, position);
        entry.partial = next;
        return next.length;
    }
    async getFileSize(id, { kind = "final" } = {}) {
        return this.files.get(id)?.[kind]?.length ?? null;
    }
    async readRange(id, { kind = "final", offset = 0, length } = {}) {
        const bytes = this.files.get(id)?.[kind];
        if (!bytes) throw new DOMException("Missing archive", "NotFoundError");
        return bytes.slice(offset, offset + length).buffer;
    }
    async finalize(id) {
        const entry = this.entry(id);
        if (!entry.partial) throw new Error("Missing partial archive");
        entry.final = entry.partial.slice();
        this.finalized.push(id);
        delete entry.partial;
        return { path: this.getPaths(id).final, size: entry.final.length };
    }
    async inspectPackageFiles(id) {
        const entry = this.files.get(id) ?? {};
        return {
            partial: { path: this.getPaths(id).partial,
                exists: Boolean(entry.partial), size: entry.partial?.length ?? null },
            final: { path: this.getPaths(id).final,
                exists: Boolean(entry.final), size: entry.final?.length ?? null }
        };
    }
    async deleteArchive(id) {
        const entry = this.files.get(id) ?? {};
        const result = { partial: Boolean(entry.partial), final: Boolean(entry.final) };
        this.files.delete(id);
        return result;
    }
}

function uniqueDatabase() {
    return "trailbook.offlineMapPackages.phaseB." + Date.now() + "." +
        Math.random().toString(36).slice(2);
}

function packageRecord(id, status, size) {
    return {
        packageId: id,
        sourceId: "fixture-source",
        version: "fixture-v1",
        status,
        opfsPath: `trailbook/offline-map-packages/${id}.pmtiles`,
        byteLength: size,
        downloadedBytes: status === "ready" ? size : 0,
        checksum: "fixture-checksum",
        bounds: { west: -180, south: -85, east: 180, north: 85 },
        minZoom: 0,
        maxZoom: 0,
        tileType: "png",
        attribution: "Fixture attribution",
        stylePackageId: null
    };
}

async function testReaderAndSource() {
    const reader = new PMTilesArchiveReader();
    const bytes = fixtureBytes();
    const file = new TrackingFile(bytes);
    const result = await reader.inspectFile(file);
    assert(result.archiveVersion === 3 && result.tileType === "png" &&
        result.minZoom === 0 && result.maxZoom === 0,
    "valid raster PMTiles header was not exposed");
    assert(result.bounds.west === -180 && result.bounds.east === 180 &&
        result.center.longitude === 0 &&
        result.metadata.attribution === "Fixture attribution",
    "PMTiles bounds, center, or metadata were not exposed");

    await rejects(() => reader.inspectFile(new TrackingFile(bytes.slice(0, 50))),
        "truncated PMTiles archive was accepted");
    const wrongMagic = bytes.slice();
    wrongMagic[0] = 0;
    await rejects(() => reader.inspectFile(new TrackingFile(wrongMagic)),
        "invalid PMTiles magic was accepted");
    await rejects(() => reader.inspectFile(new TrackingFile(fixtureBytes({
        version: 4
    }))), "unsupported PMTiles version was accepted");
    const vector = await reader.inspectFile(new TrackingFile(fixtureBytes({
        tileType: 1
    })));
    assert(vector.tileType === "mvt",
        "valid vector PMTiles was rejected by the archive reader");

    const store = new MemoryArchiveStore();
    store.entry("ranges").final = bytes;
    const source = new PMTilesArchiveSource(store, "ranges");
    const range = new Uint8Array((await source.getBytes(7, 4)).data);
    assert(range[0] === 3 && range.length === 4 &&
        source.getKey().endsWith("ranges.pmtiles"),
    "OPFS PMTiles Source did not provide arbitrary byte ranges");
    await rejects(() => new PMTilesArchiveSource(store, "missing").getBytes(0, 1),
        "missing archive did not fail deterministically",
        error => error instanceof OfflineMapArchiveMissingError);
}

function createLeafletFake() {
    const onlineLayers = [];
    const map = {
        layers: new Set(), options: {}, handlers: new Map(),
        setView() { return this; },
        getCenter() { return { lat: 0, lng: 0 }; },
        getZoom() { return 0; }, getMinZoom() { return 0; },
        getMaxZoom() { return 19; },
        on(name, handler) { this.handlers.set(name, handler); },
        removeLayer(layer) { this.layers.delete(layer); },
        hasLayer(layer) { return this.layers.has(layer); }
    };
    class GridLayer {
        constructor(options = {}) {
            this.options = options;
            this._tiles = {};
        }
        static extend(methods) {
            class Child extends GridLayer {}
            Object.assign(Child.prototype, methods);
            return Child;
        }
        addTo(target) { this._map = target; target.layers.add(this); return this; }
        remove() {
            Object.keys(this._tiles).forEach(key => this._removeTile?.(key));
            this._map?.layers.delete(this);
        }
        _keyToTileCoords(key) {
            return this._tiles[key]?.coords ?? { z: 0, x: 0, y: 0 };
        }
        fire() {}
    }
    globalThis.L = {
        GridLayer,
        DomUtil: { remove(element) { element.removed = true; } },
        map(_element, options) { map.options = options; return map; },
        tileLayer(url, options) {
            const layer = {
                url, options,
                addTo(target) { target.layers.add(this); return this; },
                remove() { map.layers.delete(this); }
            };
            onlineLayers.push(layer);
            return layer;
        },
        canvas(options) { return { options }; }
    };
    return { map, onlineLayers };
}

async function waitFor(predicate) {
    for (let index = 0; index < 50; index += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
    throw new Error("Timed out waiting for PMTiles render.");
}

async function testImportRestartRenderAndDelete() {
    const databaseName = uniqueDatabase();
    const repository = new OfflineMapPackageRepository({ databaseName });
    const archiveStore = new MemoryArchiveStore();
    const reader = new PMTilesArchiveReader();
    const importer = new OfflineMapPackageImportCoordinator({
        repository, archiveStore, archiveReader: reader, chunkSize: 1024
    });
    const file = new TrackingFile(fixtureBytes());
    const progress = [];
    const ready = await importer.importFile(file, {
        packageId: "tiny-raster",
        sourceId: "Tiny Raster",
        version: "fixture-v1",
        checksum: "fixture-checksum",
        onProgress: value => progress.push(value)
    });
    assert(ready.status === "ready" && ready.downloadedBytes === file.size &&
        archiveStore.finalized.length === 1,
    "import did not reach ready after final archive validation");
    assert(archiveStore.writeSizes.length > 1 &&
        Math.max(...archiveStore.writeSizes) <= 1024,
    "PMTiles import did not stream bounded chunks");
    assert(!file.slices.some(([start, end]) =>
        start === 0 && end - start === file.size),
    "PMTiles import buffered the complete File");
    assert(progress[0].status === "importing" &&
        progress.at(-1).status === "ready" &&
        progress.at(-1).downloadedBytes === file.size,
    "PMTiles import did not publish bounded byte progress through ready");
    await rejects(() => importer.importFile(file, {
        packageId: "tiny-raster",
        sourceId: "Tiny Raster",
        version: "fixture-v1"
    }), "duplicate local package identity was silently overwritten",
    error => error.code === "duplicate-package");
    const files = await archiveStore.inspectPackageFiles("tiny-raster");
    assert(files.final.exists && files.final.size === file.size &&
        !files.partial.exists,
    "finalization did not preserve the validated final archive state");

    const reopenedRepository = new OfflineMapPackageRepository({ databaseName });
    const staticProviders = new BasemapProviderRegistry(Config.map);
    const catalog = new OfflineMapPackageCatalog({
        staticProviders,
        repository: reopenedRepository,
        archiveStore
    });
    const packageSources = await catalog.refresh();
    assert(packageSources.length === 1 &&
        packageSources[0].sourceType === "pmtiles" &&
        packageSources[0].packageId === "tiny-raster",
    "ready package was not restored as a selectable basemap source");
    assert(catalog.list().length === 3,
        "installed package was not composed with static providers");
    await reopenedRepository.updatePackage("tiny-raster", {
        tileType: "mvt"
    });
    assert((await catalog.refresh()).length === 0,
        "catalog routed a raster archive through mismatched MVT metadata");
    await reopenedRepository.updatePackage("tiny-raster", {
        tileType: "png"
    });
    await catalog.refresh();

    const originalFetch = globalThis.fetch;
    const originalCreateUrl = URL.createObjectURL;
    const originalRevokeUrl = URL.revokeObjectURL;
    let fetchCalls = 0;
    let createdUrls = 0;
    const revoked = [];
    globalThis.fetch = () => {
        fetchCalls += 1;
        return Promise.reject(new Error("Network disabled"));
    };
    URL.createObjectURL = () => `blob:pmtiles-${++createdUrls}`;
    URL.revokeObjectURL = url => revoked.push(url);
    try {
        const leaflet = createLeafletFake();
        const mapView = new MapView(Config, new EventBus(), {
            basemapProviders: catalog,
            pmtilesArchiveStore: archiveStore
        });
        mapView.initialize();
        assert(leaflet.onlineLayers.length === 1 &&
            mapView.element.querySelector(".base-map-select")
                .querySelector(`option[value="${packageSources[0].id}"]`),
        "restart path did not expose the installed package selector");
        mapView.setBaseMap(packageSources[0].id);
        assert(mapView.baseTileLayer.options.attribution ===
            "Fixture attribution",
        "PMTiles raster layer lost package attribution");
        let rendered = false;
        const tile = mapView.baseTileLayer.createTile(
            { z: 0, x: 0, y: 0 },
            error => { if (!error) rendered = true; }
        );
        await waitFor(() => rendered);
        assert(tile.src === "blob:pmtiles-1" && fetchCalls === 0,
            "local PMTiles raster tile did not render fully offline");
        mapView.baseTileLayer._tiles.fixture = { el: tile };
        let rerendered = false;
        const repeatedTile = mapView.baseTileLayer.createTile(
            { z: 0, x: 0, y: 0 },
            error => { if (!error) rerendered = true; }
        );
        await waitFor(() => rerendered);
        mapView.baseTileLayer._tiles.repeated = { el: repeatedTile };
        assert(repeatedTile.src === "blob:pmtiles-2" && fetchCalls === 0,
            "offline pan/zoom tile resolution generated a network request");
        mapView.setBaseMap("osm");
        assert(mapView.getBaseMap() === "osm" &&
            leaflet.onlineLayers.length === 2 &&
            revoked.includes("blob:pmtiles-1") &&
            revoked.includes("blob:pmtiles-2"),
        "xyz -> PMTiles -> xyz switching or cleanup failed");
    } finally {
        globalThis.fetch = originalFetch;
        URL.createObjectURL = originalCreateUrl;
        URL.revokeObjectURL = originalRevokeUrl;
    }

    archiveStore.files.delete("tiny-raster");
    assert((await catalog.refresh()).length === 0,
        "metadata ready with missing archive remained selectable");
    const corrupt = fixtureBytes();
    corrupt[0] = 0;
    archiveStore.entry("tiny-raster").final = corrupt;
    assert((await catalog.refresh()).length === 0,
        "same-length corrupt archive remained selectable");
    archiveStore.entry("tiny-raster").final = fixtureBytes().slice(0, 50);
    await rejects(() => reader.inspectSource(
        new PMTilesArchiveSource(archiveStore, "tiny-raster")
    ), "truncated installed archive was accepted");

    const mismatch = packageRecord("wrong-length", "ready", file.size + 1);
    await reopenedRepository.createPackage(mismatch);
    archiveStore.entry("wrong-length").final = fixtureBytes();
    assert((await catalog.refresh()).length === 0,
        "wrong byteLength package remained selectable");
    const partial = packageRecord("partial-only", "partial", file.size);
    await reopenedRepository.createPackage(partial);
    archiveStore.entry("partial-only").partial = fixtureBytes();
    assert((await catalog.refresh()).length === 0,
        "partial-only archive was presented as usable");

    archiveStore.entry("tiny-raster").final = fixtureBytes();
    assert(await importer.deletePackage("tiny-raster") &&
        await reopenedRepository.getPackage("tiny-raster") === null &&
        !archiveStore.files.has("tiny-raster"),
    "package deletion did not remove metadata and archive");
    indexedDB.deleteDatabase(databaseName);
}

async function testVectorImportAndQuotaFailure() {
    const databaseName = uniqueDatabase();
    const repository = new OfflineMapPackageRepository({ databaseName });
    const archiveStore = new MemoryArchiveStore();
    const reader = new PMTilesArchiveReader();
    const importer = new OfflineMapPackageImportCoordinator({
        repository, archiveStore, archiveReader: reader, chunkSize: 1024
    });
    const vectorFile = new TrackingFile(fixtureBytes({ tileType: 1 }),
        "local-vector.pmtiles");
    const ready = await importer.importFile(vectorFile, {
        packageId: "local-vector",
        sourceId: "local-vector",
        version: "local-v1"
    });
    const catalog = new OfflineMapPackageCatalog({
        staticProviders: new BasemapProviderRegistry(Config.map),
        repository, archiveStore, archiveReader: reader
    });
    const sources = await catalog.refresh();
    assert(ready.tileType === "mvt" && sources.length === 1 &&
        sources[0].tileType === "mvt",
    "local vector PMTiles did not route to the vector package source");

    const quotaStore = new MemoryArchiveStore();
    const write = quotaStore.writePartial.bind(quotaStore);
    quotaStore.writePartial = async (id, value, options) => {
        if ((options.offset ?? 0) >= 1024) {
            throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return write(id, value, options);
    };
    const quotaRepository = new OfflineMapPackageRepository({
        databaseName: uniqueDatabase()
    });
    const quotaImporter = new OfflineMapPackageImportCoordinator({
        repository: quotaRepository,
        archiveStore: quotaStore,
        archiveReader: reader,
        chunkSize: 1024
    });
    await rejects(() => quotaImporter.importFile(
        new TrackingFile(fixtureBytes(), "quota.pmtiles"), {
            packageId: "quota", sourceId: "quota", version: "local-v1"
        }
    ), "local import quota failure was hidden",
    error => error.name === "QuotaExceededError");
    const partial = await quotaRepository.getPackage("quota");
    const files = await quotaStore.inspectPackageFiles("quota");
    assert(partial.status === "partial" && partial.downloadedBytes === 1024 &&
        files.partial.exists && !files.final.exists,
    "quota failure did not preserve recoverable partial import state");
    indexedDB.deleteDatabase(databaseName);
    indexedDB.deleteDatabase(quotaRepository.databaseName);
}

async function testFailedValidationPreservesPartial() {
    const databaseName = uniqueDatabase();
    const repository = new OfflineMapPackageRepository({ databaseName });
    const archiveStore = new MemoryArchiveStore();
    const realReader = new PMTilesArchiveReader();
    const importer = new OfflineMapPackageImportCoordinator({
        repository,
        archiveStore,
        chunkSize: 1024,
        archiveReader: {
            inspectFile: file => realReader.inspectFile(file),
            async inspectSource() {
                throw new Error("Simulated copied archive validation failure");
            }
        }
    });
    await rejects(() => importer.importFile(
        new TrackingFile(fixtureBytes()),
        {
            packageId: "recoverable",
            sourceId: "Recoverable",
            version: "fixture-v1"
        }
    ), "copied archive validation failure was hidden");
    const metadata = await repository.getPackage("recoverable");
    const files = await archiveStore.inspectPackageFiles("recoverable");
    assert(metadata.status === "partial" &&
        metadata.downloadedBytes === metadata.byteLength,
    "failed validation did not preserve recoverable metadata");
    assert(files.partial.exists && !files.final.exists &&
        archiveStore.finalized.length === 0,
    "failed validation finalized or deleted the recoverable partial archive");
    indexedDB.deleteDatabase(databaseName);
}

try {
    await testReaderAndSource();
    await testImportRestartRenderAndDelete();
    await testVectorImportAndQuotaFailure();
    await testFailedValidationPreservesPartial();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
}
