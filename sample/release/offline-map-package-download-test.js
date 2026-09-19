import OfflineMapPackageDownloadCoordinator, {
    OfflineMapPackageDownloadError
} from "../../src/js/core/OfflineMapPackageDownloadCoordinator.js";
import OfflineMapPackageRepository from
    "../../src/js/services/OfflineMapPackageRepository.js";
import PMTilesArchiveReader from
    "../../src/js/services/PMTilesArchiveReader.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

async function rejects(operation, code, message) {
    let caught = null;
    try {
        await operation();
    } catch (error) {
        caught = error;
    }
    assert(caught?.code === code,
        `${message}: ${caught?.code ?? "no code"} / ` +
        `${caught?.name ?? "no error"}: ${caught?.message ?? "resolved"}`);
    return caught;
}

function setUint64(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
    view.setUint32(offset + 4, Math.floor(value / 2 ** 32), true);
}

function fixtureBytes({ corrupt = false, padding = 20000, tileType = 2 } = {}) {
    const png = Uint8Array.from(atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    ), value => value.charCodeAt(0));
    const metadata = new TextEncoder().encode(JSON.stringify({
        name: "Remote Fixture",
        attribution: "Remote fixture attribution"
    }));
    const root = Uint8Array.of(1, 0, 1, png.length, 1);
    const rootOffset = 127;
    const metadataOffset = rootOffset + root.length;
    const tileOffset = metadataOffset + metadata.length;
    const bytes = new Uint8Array(Math.max(padding, tileOffset + png.length));
    bytes.set(new TextEncoder().encode("PMTiles"), 0);
    const view = new DataView(bytes.buffer);
    view.setUint8(7, 3);
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
    if (corrupt) bytes[0] = 0;
    return bytes;
}

async function bytesOf(value) {
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

class MemoryArchiveStore {
    constructor() {
        this.files = new Map();
        this.writeSizes = [];
        this.failWriteAt = null;
    }
    getPaths(id) {
        const base = `trailbook/offline-map-packages/${id}`;
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
        const chunk = await bytesOf(value);
        const entry = this.entry(id);
        const current = entry.partial ?? new Uint8Array();
        const position = offset ?? current.length;
        if (this.failWriteAt !== null && position >= this.failWriteAt) {
            throw new DOMException("Storage quota exceeded", "QuotaExceededError");
        }
        const next = new Uint8Array(Math.max(
            current.length, position + chunk.length
        ));
        next.set(current);
        next.set(chunk, position);
        entry.partial = next;
        this.writeSizes.push(chunk.length);
        return next.length;
    }
    async getFileSize(id, { kind = "final" } = {}) {
        return this.files.get(id)?.[kind]?.length ?? null;
    }
    async readRange(id, { kind = "final", offset = 0, length } = {}) {
        const value = this.files.get(id)?.[kind];
        if (!value) throw new DOMException("Archive missing", "NotFoundError");
        return value.slice(offset, offset + length).buffer;
    }
    async finalize(id) {
        const entry = this.entry(id);
        if (!entry.partial) throw new Error("Partial archive missing");
        entry.final = entry.partial.slice();
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
        const result = {
            partial: Boolean(entry.partial),
            final: Boolean(entry.final)
        };
        this.files.delete(id);
        return result;
    }
}

function uniqueDatabase() {
    return `trailbook.offlineMapPackages.phaseC.${Date.now()}.` +
        Math.random().toString(36).slice(2);
}

function descriptor(id, bytes, changes = {}) {
    return {
        packageId: id,
        sourceId: "test-source",
        version: "2026-09",
        url: `https://packages.test/${id}.pmtiles`,
        byteLength: bytes.length,
        checksum: null,
        checksumAlgorithm: null,
        bounds: { west: -180, south: -85, east: 180, north: 85 },
        minZoom: 0,
        maxZoom: 0,
        tileType: "png",
        attribution: "Remote fixture attribution",
        etag: '"fixture-v1"',
        lastModified: "Wed, 17 Sep 2026 00:00:00 GMT",
        ...changes
    };
}

function metadataRecord(value, downloadedBytes) {
    return {
        packageId: value.packageId,
        sourceId: value.sourceId,
        version: value.version,
        status: downloadedBytes > 0 ? "partial" : "planned",
        opfsPath: `trailbook/offline-map-packages/${value.packageId}.pmtiles`,
        byteLength: value.byteLength,
        downloadedBytes,
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
        errorMessage: null
    };
}

function streamResponse(bytes, {
    status = 200,
    total = bytes.length,
    start = 0,
    etag = '"fixture-v1"',
    lastModified = "Wed, 17 Sep 2026 00:00:00 GMT",
    chunkSize = 2048,
    includeContentLength = true,
    contentRange = status === 206
        ? `bytes ${start}-${start + bytes.length - 1}/${total}` : null,
    streamErrorAfter = null
} = {}) {
    let offset = 0;
    const body = new ReadableStream({
        pull(controller) {
            if (streamErrorAfter !== null && offset >= streamErrorAfter) {
                controller.error(new Error("Simulated stream failure"));
                return;
            }
            if (offset >= bytes.length) {
                controller.close();
                return;
            }
            const end = Math.min(bytes.length, offset + chunkSize);
            controller.enqueue(bytes.slice(offset, end));
            offset = end;
        }
    });
    const headers = new Headers({ etag, "last-modified": lastModified });
    if (includeContentLength) {
        headers.set("content-length", String(bytes.length));
    }
    if (contentRange !== null) headers.set("content-range", contentRange);
    return new Response(body, { status, headers });
}

function coordinator(repository, store, fetchImpl, options = {}) {
    return new OfflineMapPackageDownloadCoordinator({
        repository,
        archiveStore: store,
        archiveReader: new PMTilesArchiveReader(),
        fetchImpl,
        storageEstimate: options.storageEstimate ??
            (() => Promise.resolve({ quota: 10 ** 9, usage: 0 })),
        quotaHeadroomBytes: options.quotaHeadroomBytes ?? 0,
        verifyChunkSize: options.verifyChunkSize ?? 1024,
        integrityVerifier: options.integrityVerifier ?? null
    });
}

async function seedPartial(repository, store, value, bytes) {
    store.entry(value.packageId).partial = bytes.slice();
    await repository.createPackage(metadataRecord(value, bytes.length));
}

function sum(bytes) {
    return bytes.reduce((total, byte) => (total + byte) >>> 0, 0)
        .toString(16).padStart(8, "0");
}

const streamingSumVerifier = {
    supports(algorithm) { return algorithm === "sum32-test"; },
    create() {
        let total = 0;
        return {
            update(bytes) {
                for (const byte of bytes) total = (total + byte) >>> 0;
            },
            digest() { return total.toString(16).padStart(8, "0"); }
        };
    }
};

async function testFreshDownload(repository, store, bytes) {
    const requests = [];
    const progress = [];
    const value = descriptor("fresh", bytes);
    const download = coordinator(repository, store, (url, options) => {
        requests.push({ url, options });
        return Promise.resolve(streamResponse(bytes, { chunkSize: 1536 }));
    });
    download.subscribe(state => progress.push(state));
    assert(requests.length === 0 && download.getState().status === "idle",
        "constructor caused a package request");
    const plan = await download.planDownload(value);
    assert(requests.length === 0 && plan.remainingBytes === bytes.length &&
        plan.quota.sufficient,
    "planning caused a request or returned an invalid quota plan");
    const ready = await download.startDownload(value);
    assert(ready.status === "ready" && ready.integrityStatus === "none",
        "fresh streamed package did not become ready");
    assert(requests.length === 1 && !requests[0].options.headers?.Range,
        "fresh package request unexpectedly used Range");
    assert(store.writeSizes.length > 1 &&
        Math.max(...store.writeSizes) <= 1536,
    "fresh package was not written as bounded response chunks");
    assert(progress.some(item => item.status === "downloading" &&
        item.downloadedBytes > 0) &&
        progress.some(item => item.status === "verifying") &&
        progress.at(-1).status === "ready",
    "package progress lifecycle was incomplete");
    const files = await store.inspectPackageFiles(value.packageId);
    assert(files.final.exists && files.final.size === bytes.length &&
        !files.partial.exists,
    "ready package did not contain only the finalized archive");
}

async function testCancelResumeRestart(repository, store, bytes) {
    const value = descriptor("cancel-resume", bytes);
    let first = null;
    const initial = coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes, { chunkSize: 4096 })));
    initial.subscribe(state => {
        if (!first && state.status === "downloading" &&
            state.downloadedBytes > 0) {
            first = state.downloadedBytes;
            initial.cancel();
        }
    });
    const partial = await initial.startDownload(value);
    assert(partial.status === "partial" && partial.cancelled && first === 4096,
        "cancel did not retain a partial package");
    assert((await repository.getPackage(value.packageId)).status === "partial",
        "cancel did not persist partial metadata");

    await repository.updatePackage(value.packageId, { downloadedBytes: 1 });
    const requests = [];
    const restarted = coordinator(repository, store, (url, options) => {
        requests.push(options);
        return Promise.resolve(streamResponse(bytes.slice(first), {
            status: 206,
            start: first,
            total: bytes.length
        }));
    });
    const plan = await restarted.planDownload(value);
    assert(plan.downloadedBytes === first &&
        (await repository.getPackage(value.packageId)).downloadedBytes === first,
    "restart did not reconcile metadata with actual partial size");
    const ready = await restarted.resume(value);
    assert(ready.status === "ready" &&
        requests[0].headers.Range === `bytes=${first}-`,
    "resume did not send the exact actual-file Range offset");
    assert(store.entry(value.packageId).final.every(
        (byte, index) => byte === bytes[index]
    ), "resume duplicated or corrupted package bytes");
}

async function expectResumeFailure(repository, store, bytes, id,
    responseFactory, code, changes = {}) {
    const value = descriptor(id, bytes, changes);
    const offset = 4096;
    await seedPartial(repository, store, value, bytes.slice(0, offset));
    const download = coordinator(repository, store, responseFactory);
    await rejects(() => download.resume(value), code,
        `${id} resume validation did not fail closed`);
    assert(store.entry(id).partial.length === offset &&
        !store.entry(id).final,
    `${id} resume failure modified or finalized its partial`);
}

async function testResumeGuards(repository, store, bytes) {
    await expectResumeFailure(repository, store, bytes, "range-200",
        () => Promise.resolve(streamResponse(bytes.slice(4096), {
            status: 200
        })), "range-not-honored");
    await expectResumeFailure(repository, store, bytes, "range-start",
        () => Promise.resolve(streamResponse(bytes.slice(4096), {
            status: 206, start: 2048, total: bytes.length
        })), "content-range-invalid");
    await expectResumeFailure(repository, store, bytes, "range-total",
        () => Promise.resolve(streamResponse(bytes.slice(4096), {
            status: 206, start: 4096, total: bytes.length + 1
        })), "remote-size-changed");
    await expectResumeFailure(repository, store, bytes, "etag-change",
        () => Promise.resolve(streamResponse(bytes.slice(4096), {
            status: 206, start: 4096, total: bytes.length,
            etag: '"fixture-v2"'
        })), "remote-identity-changed");
    await expectResumeFailure(repository, store, bytes, "modified-change",
        () => Promise.resolve(streamResponse(bytes.slice(4096), {
            status: 206, start: 4096, total: bytes.length,
            lastModified: "Thu, 18 Sep 2026 00:00:00 GMT"
        })), "remote-identity-changed");

    const identity = descriptor("identity-change", bytes);
    await seedPartial(repository, store, identity, bytes.slice(0, 4096));
    await rejects(() => coordinator(repository, store, () => {
        throw new Error("must not fetch");
    }).resume({ ...identity, version: "changed-version" }),
    "partial-incompatible", "package version identity change was accepted");
    assert(store.entry(identity.packageId).partial.length === 4096,
        "identity mismatch overwrote the existing partial");
}

async function testFailures(repository, store, bytes) {
    let fetches = 0;
    const network = descriptor("network-error", bytes);
    await rejects(() => coordinator(repository, store, () => {
        fetches += 1;
        return Promise.reject(new Error("offline"));
    }).startDownload(network), "network-error",
    "network exception was not exposed");
    assert(fetches === 1 &&
        (await repository.getPackage(network.packageId)).status !== "ready",
    "network failure marked a package ready");

    const non2xx = descriptor("non-2xx", bytes);
    await rejects(() => coordinator(repository, store, () =>
        Promise.resolve(new Response(null, { status: 503 })))
        .startDownload(non2xx), "http-status",
    "non-2xx package response was accepted");

    const stream = descriptor("stream-error", bytes);
    let reads = 0;
    const streamFailureResponse = {
        status: 200,
        headers: new Headers({
            "content-length": String(bytes.length),
            etag: stream.etag,
            "last-modified": stream.lastModified
        }),
        body: {
            getReader() {
                return {
                    async read() {
                        if (reads++ === 0) {
                            return { done: false, value: bytes.slice(0, 2048) };
                        }
                        throw new Error("Simulated stream failure");
                    }
                };
            }
        }
    };
    await rejects(() => coordinator(repository, store, () =>
        Promise.resolve(streamFailureResponse))
        .startDownload(stream), "download-failed",
    "response stream failure was hidden");
    assert(store.entry(stream.packageId).partial.length === 2048,
        "stream interruption did not retain downloaded bytes");

    const quotaWrite = descriptor("quota-write", bytes);
    store.failWriteAt = 2048;
    await rejects(() => coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes, { chunkSize: 2048 })))
        .startDownload(quotaWrite), "quota-exceeded",
    "QuotaExceededError was hidden");
    assert(store.entry(quotaWrite.packageId).partial.length === 2048 &&
        (await repository.getPackage(quotaWrite.packageId)).status === "partial",
    "quota failure did not preserve its recoverable partial");
    store.failWriteAt = null;

    const short = descriptor("short-body", bytes);
    await rejects(() => coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes.slice(0, -1), {
            total: bytes.length, includeContentLength: false
        }))).startDownload(short), "byte-length-mismatch",
    "final byte length mismatch was accepted");

    const corruptBytes = fixtureBytes({ corrupt: true });
    const corrupt = descriptor("invalid-pmtiles", corruptBytes);
    await rejects(() => coordinator(repository, store, () =>
        Promise.resolve(streamResponse(corruptBytes)))
        .startDownload(corrupt), "download-failed",
    "invalid PMTiles archive became ready");
    assert((await repository.getPackage(corrupt.packageId)).status === "partial",
        "invalid PMTiles archive was not retained as non-ready partial");

    const quotaPlan = descriptor("quota-plan", bytes);
    let quotaFetches = 0;
    await rejects(() => coordinator(repository, store, () => {
        quotaFetches += 1;
    }, {
        storageEstimate: () => Promise.resolve({ quota: 100, usage: 99 }),
        quotaHeadroomBytes: 0
    }).startDownload(quotaPlan), "quota-preflight",
    "impossible quota plan was allowed");
    assert(quotaFetches === 0,
        "quota preflight failure issued a network request");
}

async function testIntegrity(repository, store, bytes) {
    const checksum = sum(bytes);
    const verified = descriptor("integrity-ok", bytes, {
        checksum, checksumAlgorithm: "sum32-test"
    });
    const ok = await coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes)), {
        integrityVerifier: streamingSumVerifier,
        verifyChunkSize: 777
    }).startDownload(verified);
    assert(ok.integrityStatus === "verified" &&
        (await repository.getPackage(verified.packageId)).integrityStatus ===
            "verified",
    "streaming integrity success was not persisted");

    const failed = descriptor("integrity-fail", bytes, {
        checksum: "ffffffff", checksumAlgorithm: "sum32-test"
    });
    await rejects(() => coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes)), {
        integrityVerifier: streamingSumVerifier
    }).startDownload(failed), "integrity-mismatch",
    "integrity mismatch was accepted");
    assert((await repository.getPackage(failed.packageId)).integrityStatus ===
        "failed" && store.entry(failed.packageId).partial.length === bytes.length,
    "integrity failure did not remain recoverable and non-ready");

    const unavailable = descriptor("integrity-unavailable", bytes, {
        checksum, checksumAlgorithm: "sha256"
    });
    const result = await coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes)))
        .startDownload(unavailable);
    assert(result.status === "ready" &&
        result.integrityStatus === "unavailable" &&
        (await repository.getPackage(unavailable.packageId)).integrityStatus ===
            "unavailable",
    "unavailable verifier was incorrectly reported as verified");
}

async function testDuplicateAndDelete(repository, store, bytes) {
    const active = descriptor("active-job", bytes);
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const download = coordinator(repository, store, async () => {
        await waiting;
        return streamResponse(bytes);
    });
    const running = download.startDownload(active);
    await rejects(() => download.startDownload(descriptor("second", bytes)),
        "job-active", "immediate duplicate active job was accepted");
    while (download.getState().status !== "downloading") {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    assert(download.cancel(), "active package cancellation was rejected");
    release();
    assert((await running).status === "partial",
        "cancelled waiting request did not settle as partial");

    const partialDelete = await download.deletePackage(active.packageId);
    assert(partialDelete.partial && partialDelete.metadata &&
        !store.files.has(active.packageId),
    "explicit partial package deletion was incomplete");
    const readyDelete = await download.deletePackage("fresh");
    assert(readyDelete.final && readyDelete.metadata &&
        await repository.getPackage("fresh") === null,
    "explicit ready package deletion was incomplete");
}

async function testVectorPackageBoundary(repository, store) {
    const bytes = fixtureBytes({ tileType: 1 });
    const value = descriptor("vector-download", bytes, { tileType: "mvt" });
    const result = await coordinator(repository, store, () =>
        Promise.resolve(streamResponse(bytes))).startDownload(value);
    assert(result.status === "ready" && result.metadata.tileType === "mvt" &&
        (await repository.getPackage(value.packageId)).tileType === "mvt",
    "explicit MVT package download boundary remained raster-only");
    await coordinator(repository, store, () => {
        throw new Error("delete must not fetch");
    }).deletePackage(value.packageId);
}

async function run() {
    const databaseName = uniqueDatabase();
    const repository = new OfflineMapPackageRepository({ databaseName });
    const store = new MemoryArchiveStore();
    const bytes = fixtureBytes();
    try {
        await testFreshDownload(repository, store, bytes);
        await testCancelResumeRestart(repository, store, bytes);
        await testResumeGuards(repository, store, bytes);
        await testFailures(repository, store, bytes);
        await testIntegrity(repository, store, bytes);
        await testDuplicateAndDelete(repository, store, bytes);
        await testVectorPackageBoundary(repository, store);
    } finally {
        indexedDB.deleteDatabase(databaseName);
    }
}

try {
    await run();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
}
