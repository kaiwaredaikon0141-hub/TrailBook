import Config from "../../src/js/core/Config.js";
import BasemapProviderRegistry, {
    BASE_MAPS, DEFAULT_BASE_MAP
} from "../../src/js/services/BasemapProviderRegistry.js";
import {
    MAX_MERCATOR_LATITUDE,
    canonicalTileKey,
    enumerateXYZTiles,
    normalizeLongitude
} from "../../src/js/services/XYZTileEnumerator.js";
import OfflineMapsRepository from
    "../../src/js/services/OfflineMapsRepository.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

async function rejects(operation, message) {
    let rejected = false;
    try {
        await operation();
    } catch {
        rejected = true;
    }
    assert(rejected, message);
}

function testProviders() {
    const registry = new BasemapProviderRegistry(Config.map);
    const osm = registry.get("osm");
    const gsi = registry.get("gsiStandard");

    assert(DEFAULT_BASE_MAP === "osm" &&
        registry.normalizeId("unknown") === "osm",
    "existing default basemap changed");
    assert(osm.tileUrl === Config.map.tileUrl &&
        osm.attribution === Config.map.tileAttribution &&
        osm.maxZoom === Config.map.tileMaxZoom,
    "OSM MapView metadata changed");
    assert(gsi.tileUrl === BASE_MAPS.gsiStandard.url &&
        gsi.maxZoom === 18 &&
        gsi.attribution === BASE_MAPS.gsiStandard.attribution,
    "GSI MapView metadata changed");
    assert(osm.id === "osm" && gsi.id === "gsiStandard" &&
        osm.minZoom === 0 && gsi.minZoom === 0,
    "existing provider IDs or layer zoom behavior changed");
    assert(Boolean(osm.tileSetVersion && gsi.tileSetVersion &&
        osm.termsUrl && gsi.termsUrl),
    "offline provider metadata is incomplete");
    assert(Object.isFrozen(osm) && Object.isFrozen(gsi),
    "provider metadata is mutable");
    assert(!osm.offlineDownloadAllowed &&
        !registry.canDownloadOffline("osm"),
    "OSM became offline-download eligible");
    assert(!gsi.offlineDownloadAllowed &&
        !registry.canDownloadOffline("gsiStandard"),
    "GSI became offline-download eligible");
    assert(!registry.canDownloadOffline("unknown") &&
        registry.get("unknown") === null,
    "unknown provider became offline-download eligible");
    registry.providers = new Map([["osm", {
        offlineDownloadAllowed: true
    }]]);
    assert(!registry.canDownloadOffline("osm"),
    "external registry property changed the offline guard");

    const testRegistry = new BasemapProviderRegistry(Config.map, {
        additionalProviders: [{
            id: "testAllowed", tileUrl: "https://example.invalid/{z}/{x}/{y}.png",
            attribution: "test", minZoom: 0, maxZoom: 3,
            tileSetVersion: "test-v1", offlineDownloadAllowed: true,
            termsUrl: "https://example.invalid/terms"
        }, {
            id: "testUrlOnly", tileUrl: "https://example.invalid/tile.png",
            attribution: "test", minZoom: 0, maxZoom: 3,
            tileSetVersion: "test-v1", offlineDownloadAllowed: false
        }]
    });
    assert(testRegistry.canDownloadOffline("testAllowed"),
        "explicit test-only provider was rejected");
    assert(!testRegistry.canDownloadOffline("testUrlOnly"),
        "tile URL alone implied offline permission");
    assert(!testRegistry.canDownloadOffline("notRegistered"),
        "unknown test provider was accepted");
}

function testEnumeration() {
    const bbox = {
        west: -90, south: -45, east: 90, north: 45,
        minZoom: 1, maxZoom: 2
    };
    const normal = enumerateXYZTiles(bbox);

    assert(normal.count === 8 && normal.tiles.length === 8,
        "multi-zoom exact tile count changed");
    assert(normal.tiles[0].z === 1 && normal.tiles.at(-1).z === 2,
        "zoom ordering is not deterministic");
    assert(normal.tiles.some(tile => tile.z === 1 &&
        tile.x === 0 && tile.y === 0),
    "normal bbox lost an expected XYZ tile");
    assert(JSON.stringify(normal) ===
        JSON.stringify(enumerateXYZTiles(bbox)),
    "same bbox did not produce stable ordering");
    assert(new Set(normal.tiles.map(tile =>
        `${tile.z}/${tile.x}/${tile.y}`)).size === normal.count,
    "normal bbox produced duplicate tiles");

    const longitudeA = enumerateXYZTiles({
        west: 190, south: -10, east: 200, north: 10,
        minZoom: 3, maxZoom: 3
    });
    const longitudeB = enumerateXYZTiles({
        west: -170, south: -10, east: -160, north: 10,
        minZoom: 3, maxZoom: 3
    });
    assert(normalizeLongitude(190) === -170 &&
        normalizeLongitude(180) === -180,
    "longitude normalization is unstable");
    assert(JSON.stringify(longitudeA) === JSON.stringify(longitudeB),
        "equivalent wrapped longitudes mapped to different tiles");

    const crossing = enumerateXYZTiles({
        west: 170, south: -10, east: -170, north: 10,
        minZoom: 2, maxZoom: 2
    });
    assert(crossing.count === 4 &&
        crossing.tiles.every(tile => tile.x === 0 || tile.x === 3),
    "antimeridian crossing mapped to wrong x columns");
    assert(new Set(crossing.tiles.map(tile =>
        `${tile.z}/${tile.x}/${tile.y}`)).size === crossing.count,
    "antimeridian crossing duplicated XYZ tiles");

    const world = enumerateXYZTiles({
        west: -180, south: -90, east: 180, north: 90,
        minZoom: 0, maxZoom: 1
    });
    assert(world.count === 5,
        "whole-world low-zoom enumeration has duplicates or gaps");
    assert(JSON.stringify(enumerateXYZTiles({
        west: -20, south: 85, east: 20, north: 90,
        minZoom: 2, maxZoom: 2
    })) === JSON.stringify(enumerateXYZTiles({
        west: -20, south: 85, east: 20,
        north: MAX_MERCATOR_LATITUDE,
        minZoom: 2, maxZoom: 2
    })), "north latitude was not clamped");
    assert(JSON.stringify(enumerateXYZTiles({
        west: -20, south: -90, east: 20, north: -85,
        minZoom: 2, maxZoom: 2
    })) === JSON.stringify(enumerateXYZTiles({
        west: -20, south: -MAX_MERCATOR_LATITUDE,
        east: 20, north: -85, minZoom: 2, maxZoom: 2
    })), "south latitude was not clamped");
    assert(canonicalTileKey("test", "v1", { z: 2, x: 3, y: 1 }) ===
        "test/v1/2/3/1",
    "canonical provider tile key changed");
    assert(canonicalTileKey("test", "v1", normal.tiles[0]) ===
        canonicalTileKey("test", "v1", normal.tiles[0]),
    "tile key is not stable");

    let limitFailed = false;
    try {
        enumerateXYZTiles(bbox, { maxTiles: 7 });
    } catch (error) {
        limitFailed = error instanceof RangeError;
    }
    assert(limitFailed, "large selection was not bounded");
}

function makeArea(id) {
    return {
        id, name: `Test ${id}`, providerId: "testAllowed",
        providerTileSetVersion: "test-v1",
        bbox: { west: 135, south: 34, east: 136, north: 35 },
        minZoom: 1, maxZoom: 2, createdAt: 1,
        status: "planned", plannedTileCount: 3,
        estimatedBytes: 12
    };
}

async function testStorage() {
    const name = `trailbook.offlineMaps.test.${Date.now()}.${
        Math.random().toString(36).slice(2)}`;
    const repository = new OfflineMapsRepository({ databaseName: name });
    const database = await repository.open();

    assert(database.version === 1 &&
        ["areas", "tiles", "areaTiles"].every(store =>
            database.objectStoreNames.contains(store)),
    "dedicated DB did not create all Phase 1 stores");
    const transaction = database.transaction("areaTiles", "readonly");
    assert(transaction.objectStore("areaTiles").indexNames.contains("areaId") &&
        transaction.objectStore("areaTiles").indexNames.contains("tileKey"),
    "membership indexes were not created");
    database.close();

    await repository.createArea(makeArea("A"));
    await repository.createArea(makeArea("B"));
    assert((await repository.getArea("A")).storedTileCount === 0 &&
        (await repository.listAreas()).length === 2,
    "area creation/read/list lost metadata");
    const partial = await repository.updateArea("A", {
        status: "partial", plannedTileCount: 4, estimatedBytes: 16
    });
    assert(partial.status === "partial" &&
        (await repository.getArea("A")).plannedTileCount === 4,
    "partial status/update was not persisted");
    await rejects(() => repository.updateArea("A", { storedBytes: 999 }),
        "stored byte accounting was externally mutable");
    await rejects(() => repository.updateArea("A", { name: "" }),
        "invalid area update was accepted");
    assert((await repository.getArea("A")).name === "Test A",
        "invalid area update changed persisted metadata");

    const blob = new Blob(["abc"], { type: "image/png" });
    const saved = await repository.putTile({
        providerId: "testAllowed", tileSetVersion: "test-v1",
        z: 2, x: 3, y: 1, blob
    });
    const tileKey = canonicalTileKey("testAllowed", "test-v1",
        { z: 2, x: 3, y: 1 });
    const tile = await repository.getTile(tileKey);

    assert(saved.inserted && saved.key === tileKey,
        "tile key was not stored");
    assert(tile.blob instanceof Blob && tile.blob.size === 3 &&
        tile.bytes === 3 && tile.mimeType === "image/png",
    "tile Blob, MIME, or stored bytes changed");
    assert(!((await repository.putTile({
        providerId: "testAllowed", tileSetVersion: "test-v1",
        z: 2, x: 3, y: 1, blob: new Blob(["different"])
    })).inserted), "same tile identity was overwritten");
    assert((await repository.getTile(tileKey)).bytes === 3,
        "immutable tile replacement changed accounting");

    assert(await repository.linkTile("A", tileKey) &&
        await repository.linkTile("B", tileKey),
    "shared tile could not be linked to two areas");
    assert(!await repository.linkTile("A", tileKey),
        "duplicate area membership was inserted");
    assert((await repository.getAreaTileKeys("A"))[0] === tileKey &&
        await repository.getTileReferenceCount(tileKey) === 2,
    "membership lookup or reference count changed");
    assert((await repository.getArea("A")).storedTileCount === 1 &&
        (await repository.getArea("B")).storedBytes === 3,
    "shared tile did not update each area's byte accounting");
    await repository.createArea({ ...makeArea("C"),
        providerId: "anotherProvider" });
    await rejects(() => repository.linkTile("C", tileKey),
        "cross-provider tile membership was accepted");
    assert((await repository.getArea("C")).storedTileCount === 0 &&
        await repository.getTileReferenceCount(tileKey) === 2,
    "rejected membership changed tile accounting");
    await repository.deleteArea("C");

    await repository.updateArea("B", { status: "complete" });
    assert((await repository.getArea("B")).status === "complete",
        "complete status was not persisted");
    const deletedA = await repository.deleteArea("A");
    assert(deletedA.deleted && deletedA.orphanTilesRemoved === 0 &&
        await repository.getArea("A") === null,
    "first area was not deleted independently");
    assert(await repository.getTile(tileKey) !== null &&
        await repository.getTileReferenceCount(tileKey) === 1,
    "first deletion removed a still-shared tile");
    const deletedB = await repository.deleteArea("B");
    assert(deletedB.deleted && deletedB.orphanTilesRemoved === 1,
        "last area did not mark an orphan tile for deletion");
    assert(await repository.getTile(tileKey) === null &&
        await repository.getTileReferenceCount(tileKey) === 0,
    "orphan tile or membership survived last-area deletion");
    assert((await repository.listAreas()).length === 0,
        "deleted areas remained in the DB");

    const upgradeName = `${name}.upgrade`;
    const legacy = await new Promise((resolve, reject) => {
        const request = indexedDB.open(upgradeName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("legacy");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    legacy.close();
    const upgraded = await new OfflineMapsRepository({
        databaseName: upgradeName, databaseVersion: 2
    }).open();
    assert(upgraded.version === 2 &&
        ["legacy", "areas", "tiles", "areaTiles"].every(store =>
            upgraded.objectStoreNames.contains(store)),
    "existing DB upgrade failed or erased a prior store");
    upgraded.close();

    const partialName = `${name}.partialUpgrade`;
    const partialLegacy = await new Promise((resolve, reject) => {
        const request = indexedDB.open(partialName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(
            "areaTiles", { keyPath: ["areaId", "tileKey"] });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    partialLegacy.close();
    const repaired = await new OfflineMapsRepository({
        databaseName: partialName, databaseVersion: 2
    }).open();
    const repairedStore = repaired.transaction("areaTiles", "readonly")
        .objectStore("areaTiles");
    assert(repairedStore.indexNames.contains("areaId") &&
        repairedStore.indexNames.contains("tileKey"),
    "partial upgrade did not restore membership indexes");
    repaired.close();
}

try {
    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (...args) => {
        fetchCalls += 1;
        throw new Error(`Unexpected Phase 1 fetch: ${args[0]}`);
    };
    try {
        testProviders();
        testEnumeration();
        await testStorage();
        assert(fetchCalls === 0, "Phase 1 attempted tile/network fetches");
    } finally {
        globalThis.fetch = originalFetch;
    }
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
}
