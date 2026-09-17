import LibraryCacheResetCoordinator from
    "../../src/js/core/LibraryCacheResetCoordinator.js";
import OfflineMapArchiveStore from
    "../../src/js/services/OfflineMapArchiveStore.js";
import OfflineMapPackageRepository, {
    evaluatePackageLifecycle
} from "../../src/js/services/OfflineMapPackageRepository.js";
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

function missing() {
    return new DOMException("Missing entry", "NotFoundError");
}

async function bytesFrom(value) {
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (typeof value === "string") return new TextEncoder().encode(value);
    throw new TypeError("Unsupported memory file write.");
}

class MemoryWritable {
    constructor(handle, keepExistingData) {
        this.handle = handle;
        this.bytes = keepExistingData
            ? handle.bytes.slice() : new Uint8Array();
        this.position = 0;
    }
    async seek(position) { this.position = position; }
    async truncate(size) {
        const next = new Uint8Array(size);
        next.set(this.bytes.slice(0, size));
        this.bytes = next;
        this.position = Math.min(this.position, size);
    }
    async write(value) {
        const bytes = await bytesFrom(value);
        const size = Math.max(this.bytes.length, this.position + bytes.length);
        const next = new Uint8Array(size);
        next.set(this.bytes);
        next.set(bytes, this.position);
        this.bytes = next;
        this.position += bytes.length;
    }
    async close() { this.handle.bytes = this.bytes; }
    async abort() {}
}

class MemoryFileHandle {
    constructor(name) {
        this.kind = "file";
        this.name = name;
        this.bytes = new Uint8Array();
    }
    async getFile() {
        return new Blob([this.bytes], {
            type: "application/vnd.pmtiles"
        });
    }
    async createWritable(options = {}) {
        return new MemoryWritable(this, options.keepExistingData === true);
    }
}

class MemoryDirectoryHandle {
    constructor(name) {
        this.kind = "directory";
        this.name = name;
        this.directories = new Map();
        this.files = new Map();
    }
    async getDirectoryHandle(name, { create = false } = {}) {
        if (!this.directories.has(name)) {
            if (!create) throw missing();
            this.directories.set(name, new MemoryDirectoryHandle(name));
        }
        return this.directories.get(name);
    }
    async getFileHandle(name, { create = false } = {}) {
        if (!this.files.has(name)) {
            if (!create) throw missing();
            this.files.set(name, new MemoryFileHandle(name));
        }
        return this.files.get(name);
    }
    async removeEntry(name) {
        if (!this.files.delete(name) && !this.directories.delete(name)) {
            throw missing();
        }
    }
    async *entries() {
        yield* this.directories.entries();
        yield* this.files.entries();
    }
}

class MemoryStorageManager {
    constructor() {
        this.root = new MemoryDirectoryHandle("");
        this.persistCalls = 0;
    }
    async getDirectory() { return this.root; }
    async estimate() { return { usage: 12, quota: 1024 }; }
    async persisted() { return true; }
    async persist() { this.persistCalls += 1; return true; }
}

function packageRecord(packageId = "kanto") {
    return {
        packageId,
        sourceId: "test-japan",
        version: "2026-09-16",
        status: "partial",
        opfsPath: "trailbook/offline-map-packages/" + packageId + ".pmtiles",
        byteLength: 6,
        downloadedBytes: 3,
        checksum: "blake3:test",
        bounds: { west: 138, south: 34, east: 141, north: 37 },
        minZoom: 0,
        maxZoom: 15,
        tileType: "mvt",
        attribution: "Test attribution",
        stylePackageId: "style-v1"
    };
}

function uniqueDatabase(prefix) {
    return prefix + "." + Date.now() + "." +
        Math.random().toString(36).slice(2);
}

async function testPackageRepository() {
    const databaseName = uniqueDatabase("trailbook.offlineMapPackages.test");
    const repository = new OfflineMapPackageRepository({ databaseName });
    const database = await repository.open();
    assert(database.version === 1 &&
        database.objectStoreNames.contains("packages"),
    "dedicated package metadata store was not created");
    database.close();

    const original = packageRecord();
    const created = await repository.createPackage(original);
    original.bounds.west = 0;
    assert(created.status === "partial" &&
        (await repository.getPackage("kanto")).bounds.west === 138,
    "package creation/read did not persist an isolated metadata record");

    const updated = await repository.updatePackage("kanto", {
        status: "ready", downloadedBytes: 6
    });
    assert(updated.status === "ready" && updated.downloadedBytes === 6 &&
        updated.checksum === "blake3:test" &&
        updated.stylePackageId === "style-v1",
    "package update lost lifecycle or package metadata");

    const reopened = new OfflineMapPackageRepository({ databaseName });
    const restored = await reopened.getPackage("kanto");
    assert(restored.version === "2026-09-16" &&
        restored.bounds.east === 141 && restored.minZoom === 0 &&
        restored.maxZoom === 15 && restored.tileType === "mvt" &&
        restored.attribution === "Test attribution",
    "package metadata did not survive repository restart");
    assert((await reopened.listPackages()).length === 1,
        "package listing did not survive repository restart");
    await rejects(() => reopened.updatePackage("kanto", {
        packageId: "renamed"
    }), "package identity was mutable");
    await rejects(() => reopened.updatePackage("kanto", {
        downloadedBytes: 7
    }), "downloaded bytes exceeded the expected archive length");
    assert(await reopened.deletePackage("kanto") &&
        await reopened.getPackage("kanto") === null &&
        !await reopened.deletePackage("kanto"),
    "package metadata deletion was not idempotent");

    indexedDB.deleteDatabase(databaseName);
}

async function testArchiveStore() {
    const storageManager = new MemoryStorageManager();
    const store = new OfflineMapArchiveStore({ storageManager });

    assert((await store.getCapabilityStatus()).status === "available",
        "available OPFS capability was not reported");
    const storage = await store.getStorageStatus();
    assert(storage.estimate.usage === 12 && storage.estimate.quota === 1024 &&
        storage.persisted === true && storageManager.persistCalls === 0,
    "storage status was not read safely or persist() was called automatically");

    const created = await store.createPartial("kanto");
    assert(created.size === 0 && created.path.endsWith("kanto.partial"),
        "partial archive was not created in the package directory");
    assert(await store.writePartial("kanto", new TextEncoder().encode("abc")) === 3 &&
        await store.writePartial("kanto", new Blob(["def"])) === 6,
    "sequential archive writes did not append");
    await store.writePartial("kanto", new TextEncoder().encode("Z"), {
        offset: 1
    });
    assert(await store.getFileSize("kanto", { kind: "partial" }) === 6,
        "partial archive size is incorrect");
    const range = new TextDecoder().decode(await store.readRange("kanto", {
        kind: "partial", offset: 1, length: 3
    }));
    assert(range === "Zcd", "arbitrary archive range read returned wrong bytes");

    const reopened = new OfflineMapArchiveStore({ storageManager });
    const partial = await reopened.inspectPackageFiles("kanto");
    assert(partial.partial.exists && partial.partial.size === 6 &&
        !partial.final.exists,
    "partial archive did not survive a simulated restart");
    assert((await reopened.listPackagePaths()).length === 1 &&
        (await reopened.listPackagePaths())[0].endsWith("kanto.partial"),
    "partial archive path was not discoverable");

    const finalized = await reopened.finalize("kanto", { chunkSize: 2 });
    const files = await reopened.inspectPackageFiles("kanto");
    assert(finalized.size === 6 && files.final.exists &&
        files.final.size === 6 && !files.partial.exists,
    "partial archive was not safely finalized");
    assert(new TextDecoder().decode(await reopened.readRange("kanto", {
        offset: 0, length: 6
    })) === "aZcdef", "final archive bytes changed during promotion");

    const deleted = await reopened.deleteArchive("kanto");
    assert(deleted.final && !deleted.partial &&
        (await reopened.listPackagePaths()).length === 0,
    "archive deletion did not remove only known package files");
    const missingFiles = await reopened.inspectPackageFiles("missing");
    assert(!missingFiles.partial.exists && !missingFiles.final.exists,
        "missing archive was reported as present");

    const unavailable = new OfflineMapArchiveStore({ storageManager: {} });
    assert((await unavailable.getCapabilityStatus()).status === "unavailable",
        "missing OPFS API was not reported as unavailable");
    await rejects(() => unavailable.createPartial("test"),
        "OPFS-unavailable write did not fail closed");
    const broken = new OfflineMapArchiveStore({ storageManager: {
        async getDirectory() { throw new Error("OPFS failed"); }
    } });
    assert((await broken.getCapabilityStatus()).status === "error",
        "OPFS access failure was not reported as an error");
}

async function testLifecycle() {
    const metadata = { ...packageRecord(), status: "ready",
        downloadedBytes: 6 };
    const noFiles = {
        partial: { exists: false, size: null },
        final: { exists: false, size: null }
    };
    assert(evaluatePackageLifecycle(metadata, noFiles).status === "missing" &&
        !evaluatePackageLifecycle(metadata, noFiles).ready,
    "ready metadata made a missing archive ready");

    const partialFiles = {
        partial: { exists: true, size: 3 },
        final: { exists: false, size: null }
    };
    const recoverable = evaluatePackageLifecycle(metadata, partialFiles);
    assert(recoverable.status === "partial" && recoverable.recoverable &&
        !recoverable.ready,
    "partial archive was not exposed as recoverable");

    const readyFiles = {
        partial: { exists: false, size: null },
        final: { exists: true, size: 6 }
    };
    assert(evaluatePackageLifecycle(metadata, readyFiles).ready,
        "matching ready metadata and final archive were rejected");
    assert(evaluatePackageLifecycle(metadata, {
        ...readyFiles, final: { exists: true, size: 5 }
    }).status === "invalid",
    "final archive size mismatch was accepted");
    const failed = evaluatePackageLifecycle({
        ...metadata, status: "failed"
    }, partialFiles);
    assert(failed.status === "failed" && failed.recoverable,
        "failed metadata was discarded instead of preserved");
}

async function testSubsystemIsolation() {
    const packageDatabase = uniqueDatabase(
        "trailbook.offlineMapPackages.isolation"
    );
    const areaDatabase = uniqueDatabase("trailbook.offlineMaps.isolation");
    const packages = new OfflineMapPackageRepository({
        databaseName: packageDatabase
    });
    const storageManager = new MemoryStorageManager();
    const archives = new OfflineMapArchiveStore({ storageManager });
    await packages.createPackage(packageRecord("isolation"));
    await archives.createPartial("isolation");
    await archives.writePartial("isolation", new Blob(["abc"]));

    const areas = new OfflineMapsRepository({ databaseName: areaDatabase });
    await areas.createArea({
        id: "cached-area",
        name: "Cached Area",
        providerId: "test",
        providerTileSetVersion: "v1",
        bbox: { west: 0, south: 0, east: 1, north: 1 },
        minZoom: 0, maxZoom: 1, createdAt: 1,
        status: "planned", plannedTileCount: 1, estimatedBytes: 1
    });
    await packages.deletePackage("isolation");
    assert(await areas.getArea("cached-area") !== null &&
        (await archives.inspectPackageFiles("isolation")).partial.exists,
    "package metadata deletion changed Cached Areas or archive files");

    await packages.createPackage(packageRecord("isolation"));
    const reset = new LibraryCacheResetCoordinator({
        eventBus: { on() {} },
        confirmReset: () => true,
        clearers: [{ name: "existing-library-cache",
            clear: async () => true }],
        clearRuntime: async () => {}
    });
    assert((await reset.reset()).status === "success" &&
        await packages.getPackage("isolation") !== null &&
        (await archives.inspectPackageFiles("isolation")).partial.exists,
    "Library cache reset touched Offline Map Package state");

    indexedDB.deleteDatabase(packageDatabase);
    indexedDB.deleteDatabase(areaDatabase);
}

try {
    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (...args) => {
        fetchCalls += 1;
        throw new Error("Unexpected package foundation fetch: " + args[0]);
    };
    try {
        await testPackageRepository();
        await testArchiveStore();
        await testLifecycle();
        await testSubsystemIsolation();
        assert(fetchCalls === 0,
            "package foundation introduced network or download behavior");
    } finally {
        globalThis.fetch = originalFetch;
    }
    output.textContent = "PASS: " + assertions + " assertions";
    document.title = "PASS";
} catch (error) {
    output.textContent = "FAIL after " + assertions +
        " assertions\n" + error.stack;
    document.title = "FAIL";
}
