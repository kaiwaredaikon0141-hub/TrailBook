import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import OfflineMapPackagesController from
    "../../src/js/core/OfflineMapPackagesController.js";
import BasemapProviderRegistry from
    "../../src/js/services/BasemapProviderRegistry.js";
import OfflineMapPackageCatalog from
    "../../src/js/services/OfflineMapPackageCatalog.js";
import {
    BUNDLED_OFFLINE_MAP_PACKAGE_MANIFEST,
    parseOfflineMapPackageManifest
} from "../../src/js/services/OfflineMapPackageManifest.js";
import OfflineMapRegionCatalog from
    "../../src/js/services/OfflineMapRegionCatalog.js";
import MapView from "../../src/js/ui/MapView.js";
import OfflineMapsPanel, {
    formatBytes
} from "../../src/js/ui/OfflineMapsPanel.js";

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
    assert(error instanceof Error, message);
}

async function waitFor(predicate, message) {
    for (let index = 0; index < 100; index += 1) {
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    throw new Error(message);
}

function descriptor(id, changes = {}) {
    return {
        packageId: id,
        sourceId: `source-${id}`,
        version: "2026.09",
        displayName: `Package ${id}`,
        region: "Test Region",
        url: `https://packages.test/${id}.pmtiles`,
        byteLength: 5 * 1024 ** 3,
        checksum: null,
        checksumAlgorithm: null,
        bounds: { west: 130, south: 30, east: 140, north: 40 },
        minZoom: 5,
        maxZoom: 14,
        tileType: "png",
        attribution: "Test package attribution",
        etag: '"test-v1"',
        lastModified: "Sat, 19 Sep 2026 00:00:00 GMT",
        description: "A deterministic local test package.",
        ...changes
    };
}

function manifest(packages) {
    return {
        manifestVersion: 1,
        generatedAt: "2026-09-19T00:00:00.000Z",
        packages
    };
}

function record(value, status, changes = {}) {
    return {
        packageId: value.packageId,
        sourceId: value.sourceId,
        version: value.version,
        status,
        opfsPath: `trailbook/offline-map-packages/${value.packageId}.pmtiles`,
        byteLength: value.byteLength,
        downloadedBytes: 0,
        checksum: value.checksum,
        checksumAlgorithm: value.checksumAlgorithm,
        integrityStatus: value.checksum ? "pending" : "none",
        bounds: { ...value.bounds },
        minZoom: value.minZoom,
        maxZoom: value.maxZoom,
        tileType: value.tileType,
        attribution: value.attribution,
        stylePackageId: null,
        url: new URL(value.url).href,
        etag: value.etag,
        lastModified: value.lastModified,
        errorCode: null,
        errorMessage: null,
        ...changes
    };
}

class MemoryRepository {
    constructor(values = []) {
        this.values = new Map(values.map(value => [value.packageId, value]));
    }
    async listPackages() { return [...this.values.values()]; }
    async getPackage(id) { return this.values.get(id) ?? null; }
    async deletePackage(id) { return this.values.delete(id); }
}

class MemoryArchiveStore {
    constructor() {
        this.files = new Map();
        this.storageStatus = {
            estimate: { quota: 20 * 1024 ** 3, usage: 2 * 1024 ** 3 },
            persisted: false,
            errors: { estimate: null, persisted: null }
        };
    }
    set(id, value) { this.files.set(id, { ...value }); }
    paths(id) {
        const base = `trailbook/offline-map-packages/${id}`;
        return { partial: base + ".partial", final: base + ".pmtiles" };
    }
    async inspectPackageFiles(id) {
        const value = this.files.get(id) ?? {};
        const paths = this.paths(id);
        return {
            partial: { path: paths.partial, exists: value.partial != null,
                size: value.partial ?? null },
            final: { path: paths.final, exists: value.final != null,
                size: value.final ?? null }
        };
    }
    async getStorageStatus() { return this.storageStatus; }
    async getFileSize(id, { kind = "final" } = {}) {
        return this.files.get(id)?.[kind] ?? null;
    }
    async readRange() { return new ArrayBuffer(1); }
    async deleteArchive(id) {
        const value = this.files.get(id) ?? {};
        this.files.delete(id);
        return { partial: value.partial != null, final: value.final != null };
    }
}

class ValidReader {
    async inspectSource() { return { archiveVersion: 3, tileType: "png" }; }
}

class DownloadStub {
    constructor(repository, archiveStore) {
        this.repository = repository;
        this.archiveStore = archiveStore;
        this.listeners = new Set();
        this.state = Object.freeze({ status: "idle" });
        this.calls = [];
        this.pending = null;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    getState() { return this.state; }
    publish(value) {
        this.state = Object.freeze({ ...value });
        for (const listener of this.listeners) listener(this.state);
    }
    startDownload(value) {
        this.calls.push(["download", value.packageId]);
        this.publish({ status: "downloading", packageId: value.packageId,
            downloadedBytes: 10, totalBytes: value.byteLength });
        return new Promise(resolve => { this.pending = { resolve, value }; });
    }
    resume(value) {
        this.calls.push(["resume", value.packageId]);
        this.publish({ status: "downloading", packageId: value.packageId,
            downloadedBytes: 20, totalBytes: value.byteLength });
        return new Promise(resolve => { this.pending = { resolve, value }; });
    }
    cancel() {
        if (!this.pending) return false;
        const { resolve, value } = this.pending;
        this.pending = null;
        this.publish({ status: "partial", packageId: value.packageId,
            downloadedBytes: 20, totalBytes: value.byteLength,
            cancelled: true });
        resolve({ status: "partial", packageId: value.packageId,
            downloadedBytes: 20, totalBytes: value.byteLength,
            cancelled: true });
        return true;
    }
    async deletePackage(id) {
        this.calls.push(["delete", id]);
        const archive = await this.archiveStore.deleteArchive(id);
        const metadata = await this.repository.deletePackage(id);
        return { ...archive, metadata };
    }
}

class FakeMapView {
    constructor() {
        this.baseMap = "osm";
        this.providers = null;
    }
    setBasemapProviders(value) { this.providers = value; return value.list(); }
    setBaseMap(value) { this.baseMap = this.providers.normalizeId(value); }
    getBaseMap() { return this.baseMap; }
    getBaseMapProvider() { return this.providers?.get(this.baseMap) ?? null; }
}

function testManifestValidation() {
    const source = descriptor("identity", {
        url: "https://one.test/archive.pmtiles"
    });
    const parsed = parseOfflineMapPackageManifest(manifest([source]));
    assert(parsed.manifestVersion === 1 && parsed.packages.length === 1,
        "valid manifest was not parsed");
    assert(parsed.packages[0].identity === "identity@2026.09",
        "package identity incorrectly depended on URL");
    assert(Object.isFrozen(parsed) && Object.isFrozen(parsed.packages[0]),
        "validated manifest was mutable");
    const versioned = parseOfflineMapPackageManifest(manifest([
        source, { ...source, version: "2026.10" }
    ]));
    assert(versioned.packages[0].identity !== versioned.packages[1].identity,
        "packageId/version identity did not distinguish versions");
    assert(BUNDLED_OFFLINE_MAP_PACKAGE_MANIFEST.packages.length === 0,
        "production manifest unexpectedly exposed a package");

    const invalid = [
        { ...manifest([source]), manifestVersion: 2 },
        manifest([source, { ...source }]),
        manifest([{ ...source, bounds: { west: 20, south: 0,
            east: 10, north: 1 } }]),
        manifest([{ ...source, minZoom: 15, maxZoom: 14 }]),
        manifest([{ ...source, byteLength: 0 }]),
        manifest([{ ...source, url: "file:///archive.pmtiles" }]),
        manifest([{ ...source, tileType: "mvt" }])
    ];
    for (const value of invalid) {
        assert((() => {
            try { parseOfflineMapPackageManifest(value); return false; }
            catch { return true; }
        })(), "malformed manifest was accepted");
    }
}

async function testCatalogStates() {
    const values = [
        descriptor("available"), descriptor("partial"), descriptor("ready"),
        descriptor("failed"), descriptor("missing"), descriptor("update"),
        descriptor("orphan-partial"), descriptor("orphan-final")
    ];
    const repository = new MemoryRepository([
        record(values[1], "partial", { downloadedBytes: 100 }),
        record(values[2], "ready", { downloadedBytes: values[2].byteLength }),
        record(values[3], "failed", { errorMessage: "network failed" }),
        record(values[4], "ready", { downloadedBytes: values[4].byteLength }),
        record(values[5], "ready", { version: "2026.08",
            downloadedBytes: values[5].byteLength })
    ]);
    const store = new MemoryArchiveStore();
    store.set("partial", { partial: 100 });
    store.set("ready", { final: values[2].byteLength });
    store.set("update", { final: values[5].byteLength });
    store.set("orphan-partial", { partial: 50 });
    store.set("orphan-final", { final: values[7].byteLength });
    const catalog = new OfflineMapRegionCatalog({
        manifest: manifest(values), repository, archiveStore: store,
        archiveReader: new ValidReader()
    });
    const entries = await catalog.refresh();
    const states = Object.fromEntries(entries.map(value =>
        [value.packageId, value.state]
    ));
    assert(states.available === "available", "available state missing");
    assert(states.partial === "partial", "partial state missing");
    assert(states.ready === "ready", "ready state missing");
    assert(states.failed === "failed", "failed state missing");
    assert(states.missing === "missing", "missing archive appeared ready");
    assert(states.update === "update-available",
        "installed older version did not expose update state");
    assert(states["orphan-partial"] === "partial" &&
        states["orphan-final"] === "missing",
    "orphan archive recovery state was unsafe");
    assert(catalog.get("available").actions.download,
        "available package was not downloadable");
    assert(catalog.get("partial").actions.resume,
        "partial package was not resumable");
    assert(catalog.get("ready").actions.select,
        "ready package was not selectable");
    assert(!catalog.get("failed").actions.select &&
        !catalog.get("missing").actions.select,
    "failed or missing package was selectable");
    assert(catalog.get("failed").actions.delete &&
        catalog.get("missing").actions.delete,
    "failed or missing package did not expose explicit recovery deletion");
    const statePanel = new OfflineMapsPanel();
    statePanel.showPackages(entries);
    assert(statePanel.packageList.querySelector(
        "[data-package-id='failed']"
    )?.dataset.state === "failed",
    "failed catalog state was not presented");
    assert(statePanel.packageList.querySelector(
        "[data-package-id='missing'] [data-package-action='select']"
    )?.disabled === true,
    "missing archive recovery UI enabled Select");
    const planned = catalog.projectDownloadState({
        status: "planned", packageId: "available",
        downloadedBytes: 0, totalBytes: values[0].byteLength
    }).find(value => value.packageId === "available");
    assert(planned.state === "planned" && planned.actions.cancel,
        "planned coordinator state was not catalog-owned");
    const projected = catalog.projectDownloadState({
        status: "downloading", packageId: "available",
        downloadedBytes: 250, totalBytes: values[0].byteLength
    }).find(value => value.packageId === "available");
    assert(projected.state === "downloading" && projected.actions.cancel &&
        projected.downloadedBytes === 250,
    "active coordinator state was not projected by catalog");
    const storage = await catalog.getStorageSummary();
    assert(storage.installedBytes === values[2].byteLength +
        values[5].byteLength + values[7].byteLength + 150,
    "physical package byte total was incorrect");
    assert(storage.availableBytes === 18 * 1024 ** 3 &&
        storage.persisted === false,
    "advisory storage state was incorrect");
}

async function testUiAndController() {
    const value = descriptor("regional");
    const repository = new MemoryRepository();
    const store = new MemoryArchiveStore();
    store.storageStatus = {
        estimate: { quota: 4 * 1024 ** 3, usage: 2 * 1024 ** 3 },
        persisted: false,
        errors: { estimate: null, persisted: null }
    };
    const reader = new ValidReader();
    const regionCatalog = new OfflineMapRegionCatalog({
        manifest: manifest([value]), repository, archiveStore: store,
        archiveReader: reader
    });
    const staticProviders = new BasemapProviderRegistry(Config.map);
    const basemapCatalog = new OfflineMapPackageCatalog({
        staticProviders, repository, archiveStore: store,
        archiveReader: reader
    });
    const panel = new OfflineMapsPanel();
    document.getElementById("offline-host").append(panel.element);
    const mapView = new FakeMapView();
    const eventBus = new EventBus();
    eventBus.on("map:base-map-changed", ({ baseMap }) =>
        mapView.setBaseMap(baseMap)
    );
    const download = new DownloadStub(repository, store);
    const controller = new OfflineMapPackagesController({
        panel, mapView, eventBus, regionCatalog, basemapCatalog,
        downloadCoordinator: download
    });
    let packageFetches = 0;

    await controller.attach();
    assert(packageFetches === 0 && download.calls.length === 0,
        "startup initiated a package download");
    assert(panel.packageList.textContent.includes("Package regional") &&
        panel.areaList && panel.element.querySelector("h4")?.textContent ===
            "Cached Areas",
    "package section replaced or omitted Cached Areas");
    assert(panel.packageStorageOutput.textContent.includes("GB") &&
        formatBytes(10 * 1024 ** 3) === "10.00 GB",
    "large storage values were not formatted as GB");
    assert(panel.packageList.textContent.includes(
        "may exceed available storage"
    ), "known insufficient storage did not produce a warning");
    assert(panel.packageList.querySelector(
        "[data-package-action='select']"
    ).disabled, "non-ready package Select was enabled");

    panel.packageList.querySelector("[data-package-action='download']").click();
    await waitFor(() => download.calls.some(call => call[0] === "download"),
        "Download action did not reach coordinator");
    await waitFor(() => panel.packageList.querySelector(
        "[data-package-action='cancel']"
    )?.disabled === false, "Cancel did not follow active coordinator state");
    panel.packageList.querySelector("[data-package-action='cancel']").click();
    await waitFor(() => download.pending === null,
        "Cancel did not preserve and finish partial operation");
    assert(download.calls.filter(call => call[0] === "download").length === 1,
        "Download action was duplicated");

    repository.values.set(value.packageId,
        record(value, "partial", { downloadedBytes: 20 }));
    store.set(value.packageId, { partial: 20 });
    await controller.refresh();
    panel.packageList.querySelector("[data-package-action='resume']").click();
    await waitFor(() => download.calls.some(call => call[0] === "resume"),
        "Resume action did not reach coordinator");
    download.cancel();
    await waitFor(() => download.pending === null,
        "resumed operation did not cancel");

    repository.values.set(value.packageId, record(value, "ready", {
        downloadedBytes: value.byteLength
    }));
    store.set(value.packageId, { final: value.byteLength });
    await controller.refresh();
    const staticCount = staticProviders.list().length;
    assert(basemapCatalog.list().length === staticCount + 1,
        "ready package did not compose with static providers");
    panel.packageList.querySelector("[data-package-action='select']").click();
    await waitFor(() => mapView.getBaseMapProvider()?.packageId ===
        value.packageId, "ready package was not selected");
    assert(mapView.getBaseMapProvider().attribution === value.attribution,
        "selected package attribution was lost");

    panel.packageList.querySelector("[data-package-action='delete']").click();
    await waitFor(() => regionCatalog.get(value.packageId)?.state === "available",
        "deleted package did not remain catalog-visible");
    assert(mapView.getBaseMap() === "osm",
        "deleting active package did not fall back to online basemap");
    assert(staticProviders.list().length === staticCount,
        "static provider registry was mutated");
    assert(download.calls.some(call => call[0] === "delete"),
        "Delete action did not reach coordinator");

    controller.detach();
    assert(download.listeners.size === 0,
        "panel teardown left a package download listener");
}

function testMapViewCatalogApi() {
    const staticProviders = new BasemapProviderRegistry(Config.map);
    const dynamic = {
        get(id) { return id === "package:test" ? {
            id, name: "Test Package", sourceType: "pmtiles",
            packageId: "test", attribution: "test", minZoom: 0, maxZoom: 1
        } : staticProviders.get(id); },
        normalizeId(id) { return id === "package:test"
            ? id : staticProviders.normalizeId(id); },
        list() { return [...staticProviders.list(), this.get("package:test")]; }
    };
    const mapView = new MapView(Config, new EventBus());
    mapView.setPMTilesArchiveStore({ readRange() {} });
    mapView.setBasemapProviders(dynamic);
    assert(mapView.element.querySelector(
        ".base-map-select option[value='package:test']"
    ), "MapView did not expose composed package option");
    mapView.setBaseMap("package:test");
    assert(mapView.getBaseMap() === "package:test" &&
        mapView.getBaseMapProvider().sourceType === "pmtiles",
    "MapView did not accept composed PMTiles source");
    mapView.setBaseMap("osm");
    assert(mapView.getBaseMap() === "osm",
        "MapView did not switch PMTiles back to XYZ");
}

function testMobileLayoutContract() {
    const panel = document.querySelector(".offline-maps-panel");
    const content = panel.querySelector(".offline-maps-content");
    const list = panel.querySelector(".offline-package-list");
    const panelRect = panel.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const contentStyle = getComputedStyle(content);
    const listStyle = getComputedStyle(list);
    assert(panelRect.width <= document.documentElement.clientWidth,
        "offline package panel clipped horizontally");
    assert(listRect.width <= panelRect.width,
        "offline package list exceeded panel width");
    assert(!new Set(["auto", "scroll"]).has(contentStyle.overflowY) &&
        !new Set(["auto", "scroll"]).has(listStyle.overflowY),
    "offline package section introduced nested vertical scrolling");
    assert(document.querySelector(".offline-maps-disclosure")?.open === false,
        "Offline Maps disclosure was not initially collapsed");
}

try {
    testManifestValidation();
    await testCatalogStates();
    await testUiAndController();
    testMapViewCatalogApi();
    testMobileLayoutContract();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
    throw error;
}
