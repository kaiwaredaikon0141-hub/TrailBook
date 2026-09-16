import Config from "../../src/js/core/Config.js";
import OfflineDownloadCoordinator from
    "../../src/js/core/OfflineDownloadCoordinator.js";
import BasemapProviderRegistry from
    "../../src/js/services/BasemapProviderRegistry.js";
import OfflineMapsRepository from
    "../../src/js/services/OfflineMapsRepository.js";
import { canonicalTileKey } from
    "../../src/js/services/XYZTileEnumerator.js";

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

function uniqueDatabase(suffix) {
    return `trailbook.offlineMaps.download.${suffix}.${Date.now()}.${
        Math.random().toString(36).slice(2)}`;
}

const testProvider = Object.freeze({
    id: "testDownload",
    tileUrl: "https://local.invalid/{z}/{x}/{y}.png",
    attribution: "local test",
    minZoom: 0,
    maxZoom: 4,
    tileSetVersion: "test-download-v1",
    offlineDownloadAllowed: true,
    termsUrl: "https://local.invalid/terms"
});

function createRegistry() {
    return new BasemapProviderRegistry(Config.map, {
        additionalProviders: [testProvider]
    });
}

function createRepository(suffix) {
    return new OfflineMapsRepository({ databaseName: uniqueDatabase(suffix) });
}

function worldPlan(id, zoom = 1) {
    return {
        id,
        name: `Area ${id}`,
        providerId: testProvider.id,
        bbox: { west: -180, south: -85, east: 180, north: 85 },
        minZoom: zoom,
        maxZoom: zoom,
        estimatedTileBytes: 10
    };
}

function responseFor(url, bytes = new TextEncoder().encode(url).byteLength) {
    return {
        ok: true,
        status: 200,
        headers: { get: name => name === "content-type" ? "image/png" : null },
        async blob() { return new Blob([new Uint8Array(bytes)], {
            type: "image/png"
        }); }
    };
}

async function testPlanningAndGuard() {
    const repository = createRepository("guard");
    let fetchCalls = 0;
    const coordinator = new OfflineDownloadCoordinator({
        providerRegistry: createRegistry(),
        repository,
        fetchImpl: async () => { fetchCalls += 1; return responseFor("test"); },
        storageEstimate: async () => ({ quota: 100, usage: 70 }),
        concurrency: 2
    });

    for (const providerId of ["osm", "gsiStandard", "unknown"]) {
        await rejects(() => coordinator.planDownload({
            ...worldPlan(`guard-${providerId}`), providerId
        }), `${providerId} was accepted for offline download`);
    }
    assert(fetchCalls === 0, "provider rejection issued a tile request");

    const plan = await coordinator.planDownload(worldPlan("plan"));
    assert(plan.tileCount === 4 && plan.tiles.length === 4,
        "download plan has the wrong exact tile count");
    assert(new Set(plan.tiles.map(tile => canonicalTileKey(
        plan.providerId, plan.providerTileSetVersion, tile
    ))).size === plan.tileCount,
    "download plan contains duplicate tiles");
    assert(plan.estimatedBytes === 40 && plan.quota.available &&
        plan.quota.availableBytes === 30 && !plan.quota.sufficient,
    "quota advisory did not identify an obviously insufficient estimate");
    assert(fetchCalls === 0,
        "planning or coordinator construction started background fetching");
    assert(!coordinator.cancel(), "idle coordinator reported cancellation");
}

async function testSuccessSkipSharingAndProgress() {
    const repository = createRepository("success");
    const registry = createRegistry();
    let active = 0;
    let maxActive = 0;
    const requested = [];
    const fetchImpl = async url => {
        requested.push(url);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active -= 1;
        return responseFor(url, 5);
    };
    const coordinator = new OfflineDownloadCoordinator({
        providerRegistry: registry,
        repository,
        fetchImpl,
        storageEstimate: async () => null,
        concurrency: 2,
        now: () => 123
    });
    const plan = await coordinator.planDownload(worldPlan("A"));
    const existing = plan.tiles[0];
    const existingBlob = new Blob(["old"], { type: "image/png" });
    await repository.putTile({
        providerId: plan.providerId,
        tileSetVersion: plan.providerTileSetVersion,
        ...existing,
        blob: existingBlob
    });
    const progress = [];
    const unsubscribe = coordinator.subscribe(value => progress.push(value));
    const result = await coordinator.startDownload(plan);
    unsubscribe();

    assert(result.status === "complete" && result.completedCount === 4 &&
        result.failedCount === 0 && result.missingCount === 0,
    "successful area was not marked complete");
    assert(result.fetchedCount === 3 && result.skippedCount === 1 &&
        requested.length === 3,
    "already-stored tile was not skipped");
    assert(maxActive === 2,
        "configured bounded concurrency was not observed");
    assert(progress[0].status === "downloading" &&
        progress.at(-1).status === "complete" &&
        progress.at(-1).completedCount === 4,
    "progress sequence did not converge to complete");
    assert(progress.every((value, index) => index === 0 ||
        value.completedCount >= progress[index - 1].completedCount),
    "progress completed count moved backwards");

    const areaA = await repository.getArea("A");
    assert(areaA.status === "complete" && areaA.storedTileCount === 4 &&
        areaA.storedBytes === existingBlob.size + 15,
    "stored area count or byte accounting is wrong");

    const planB = await coordinator.planDownload({ ...worldPlan("B"),
        name: "Shared B" });
    const beforeShared = requested.length;
    const shared = await coordinator.startDownload(planB);
    assert(shared.status === "complete" && shared.fetchedCount === 0 &&
        shared.skippedCount === 4 && requested.length === beforeShared,
    "shared tiles were fetched again for a second area");
    const areaB = await repository.getArea("B");
    assert(areaB.storedTileCount === 4 &&
        areaB.storedBytes === areaA.storedBytes,
    "shared area accounting did not include linked tiles");
    const firstKey = canonicalTileKey(plan.providerId,
        plan.providerTileSetVersion, plan.tiles[0]);
    assert(await repository.getTileReferenceCount(firstKey) === 2,
        "shared tile did not retain both area memberships");
}

async function testCancellationAndResume() {
    const repository = createRepository("resume");
    let mode = "cancel";
    const initialRequests = [];
    const resumedRequests = [];
    let requestIndex = 0;
    const fetchImpl = (url, { signal }) => {
        const target = mode === "cancel" ? initialRequests : resumedRequests;
        target.push(url);
        requestIndex += 1;
        if (mode === "resume" || requestIndex === 1) {
            return Promise.resolve(responseFor(url, 2));
        }
        return new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(
                new DOMException("Cancelled", "AbortError")
            ), { once: true });
        });
    };
    const coordinator = new OfflineDownloadCoordinator({
        providerRegistry: createRegistry(),
        repository,
        fetchImpl,
        storageEstimate: async () => null,
        concurrency: 2
    });
    const plan = await coordinator.planDownload(worldPlan("resume", 2));
    let cancellationRequested = false;
    coordinator.subscribe(progress => {
        if (mode === "cancel" && !cancellationRequested &&
            progress.completedCount >= 1) {
            cancellationRequested = coordinator.cancel();
        }
    });
    const partial = await coordinator.startDownload(plan);
    assert(cancellationRequested && partial.cancelled &&
        partial.status === "partial",
    "cancel did not leave the area partial");
    assert(partial.completedCount === 1 && partial.failedCount === 0 &&
        partial.missingCount === 15,
    "cancel did not preserve exactly the completed tile");
    const retainedUrl = initialRequests[0];

    mode = "resume";
    const completed = await coordinator.resume("resume");
    assert(completed.status === "complete" &&
        completed.completedCount === 16 && completed.missingCount === 0,
    "resume did not complete the partial area");
    assert(resumedRequests.length === 15 &&
        !resumedRequests.includes(retainedUrl),
    "resume fetched an already-completed tile");
    assert((await repository.getArea("resume")).status === "complete",
        "resumed area status was not persisted");
}

async function testFailures() {
    const repository = createRepository("failures");
    let call = 0;
    const coordinator = new OfflineDownloadCoordinator({
        providerRegistry: createRegistry(),
        repository,
        fetchImpl: async url => {
            call += 1;
            if (call === 1) return { ok: false, status: 503 };
            if (call === 2) throw new Error("network failed");
            return responseFor(url, 1);
        },
        storageEstimate: async () => null,
        concurrency: 1
    });
    const result = await coordinator.startDownload(worldPlan("failures"));
    assert(result.status === "partial" && result.failedCount === 2 &&
        result.completedCount === 2 && result.missingCount === 2,
    "failed or non-2xx tiles incorrectly completed the area");
    assert(result.errors.length === 2 &&
        result.errors.some(value => value.error.message.includes("503")) &&
        result.errors.some(value => value.error.message === "network failed"),
    "individual fetch failures were not reported");
    assert((await repository.getArea("failures")).status === "partial",
        "failed area status was not persisted");

    const quotaRepository = createRepository("quota-error");
    const quotaProxy = new Proxy(quotaRepository, {
        get(target, property) {
            if (property === "putTile") {
                return async () => { throw new DOMException(
                    "Quota exceeded", "QuotaExceededError"
                ); };
            }
            const value = target[property];
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
    const quotaCoordinator = new OfflineDownloadCoordinator({
        providerRegistry: createRegistry(),
        repository: quotaProxy,
        fetchImpl: async url => responseFor(url, 1),
        storageEstimate: async () => null,
        concurrency: 1
    });
    const quotaResult = await quotaCoordinator.startDownload(
        worldPlan("quota", 0)
    );
    assert(quotaResult.status === "partial" &&
        quotaResult.failedCount === 1 && quotaResult.completedCount === 0,
    "storage quota failure incorrectly completed the area");
    assert(quotaResult.errors[0].error.name === "QuotaExceededError",
        "quota failure detail was not retained");
}

try {
    await testPlanningAndGuard();
    await testSuccessSkipSharingAndProgress();
    await testCancellationAndResume();
    await testFailures();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    document.title = "FAIL";
}
