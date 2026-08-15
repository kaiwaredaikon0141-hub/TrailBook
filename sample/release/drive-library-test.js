import DriveAuthService, {
    DRIVE_READONLY_SCOPE
} from "../../src/js/services/DriveAuthService.js";
import DrivePickerService from "../../src/js/services/DrivePickerService.js";
import DriveLibraryService, {
    DriveFileHandle
} from "../../src/js/services/DriveLibraryService.js";
import GPXGeometryLoader from "../../src/js/services/GPXGeometryLoader.js";
import GPXDisplayQueue from "../../src/js/services/GPXDisplayQueue.js";
import drivePerformance from "../../src/js/services/DrivePerformanceMonitor.js";
import DriveLibraryCoordinator from "../../src/js/core/DriveLibraryCoordinator.js";
import { getGoogleDriveRuntimeConfig } from "../../src/js/core/Config.js";

const results = document.querySelector("#results");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function response(body, { status = 200, binary = false } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        arrayBuffer: async () => binary
            ? new TextEncoder().encode(body).buffer
            : new ArrayBuffer(0)
    };
}

async function testRuntimeConfig() {
    const configured = getGoogleDriveRuntimeConfig({
        googleOAuthClientId: "dummy-client",
        googleApiKey: "dummy-key",
        googlePickerAppId: "123456789"
    });

    assert(configured.clientId === "dummy-client", "runtime OAuth config");
    assert(configured.apiKey === "dummy-key", "runtime API key config");
    assert(configured.appId === "123456789", "runtime Picker App ID");
    assert(
        Object.values(getGoogleDriveRuntimeConfig(null))
            .every(value => value === ""),
        "missing runtime config is empty"
    );
}

async function testAuth() {
    let request = null;
    const browserWindow = { google: { accounts: { oauth2: {
        initTokenClient: options => {
            assert(options.scope === DRIVE_READONLY_SCOPE, "readonly scope");
            return { requestAccessToken: value => {
                request = value;
                options.callback({ access_token: "session-token", expires_in: 60 });
            } };
        }
    } } } };
    const auth = new DriveAuthService({ clientId: "client", browserWindow });

    assert(await auth.authorize() === "session-token", "OAuth token returned");
    assert(request.prompt === "consent", "explicit authorization prompt");
    assert(auth.getAccessToken() === "session-token", "token held in memory");
    assert(!JSON.stringify(auth).includes("localStorage"), "no token storage dependency");
    auth.clear();
    assert(auth.getAccessToken() === null, "expired token cleared");
}

async function testPicker() {
    assert(
        !new DrivePickerService({ apiKey: "key", appId: "" }).isConfigured(),
        "missing Picker App ID is not configured"
    );
    let callback;
    const pickerApi = {
        ViewId: { FOLDERS: "folders" }, Action: { PICKED: "picked", CANCEL: "cancel" },
        DocsView: class {
            setIncludeFolders() { return this; }
            setSelectFolderEnabled() { return this; }
            setMimeTypes() { return this; }
        },
        PickerBuilder: class {
            addView() { return this; }
            setOAuthToken(token) { assert(token === "token", "Picker token"); return this; }
            setDeveloperKey(key) { assert(key === "key", "Picker API key"); return this; }
            setAppId(appId) { assert(appId === "123456789", "Picker App ID"); return this; }
            setCallback(value) { callback = value; return this; }
            build() { return { setVisible: () => callback({
                action: "picked", docs: [{ id: "root", name: "Drive Root" }]
            }) }; }
        }
    };
    const picker = new DrivePickerService({
        apiKey: "key",
        appId: "123456789",
        browserWindow: { google: { picker: pickerApi } }
    });
    const selected = await picker.pickFolder("token");

    assert(selected.id === "root" && selected.name === "Drive Root", "folder selected");
}

async function testLibrary() {
    let listCalls = 0;
    let downloads = 0;
    const fetchFunction = async url => {
        if (url.includes("alt=media")) {
            downloads += 1;
            return response("<gpx></gpx>", { binary: true });
        }
        listCalls += 1;
        const parsed = new URL(url);
        const query = parsed.searchParams.get("q");
        const page = parsed.searchParams.get("pageToken");

        if (query.includes("'root'")) {
            return response(page ? {
                files: [{ id: "json", name: "trailbook.json", mimeType: "application/json", size: "2" }]
            } : {
                nextPageToken: "next",
                files: [
                    { id: "f1", name: "2026", mimeType: "application/vnd.google-apps.folder" },
                    { id: "backup", name: "TrailBook_Backup", mimeType: "application/vnd.google-apps.folder" },
                    { id: "txt", name: "memo.txt", mimeType: "text/plain" },
                    { id: "g1", name: "root.gpx", mimeType: "application/gpx+xml", size: "12" }
                ]
            });
        }
        return response({ files: [
            { id: "g2", name: "nested.GPX", mimeType: "application/octet-stream", size: "15", modifiedTime: "2026-08-15T00:00:00Z" }
        ] });
    };
    const service = new DriveLibraryService({
        apiKey: "key", getAccessToken: () => "token", fetchFunction
    });
    const library = await service.scan({ id: "root", name: "Drive Root" });

    assert(library.readOnly && library.sourceType === "google-drive", "read-only source flag");
    assert(library.gpxFileCount === 2 && library.folderCount === 2, "recursive GPX scan");
    assert(listCalls === 3, "pagination and nested folder processed");
    assert(downloads === 0, "scan does not download GPX bodies");
    assert(!library.rootFolder.folders.some(folder => folder.name === "TrailBook_Backup"), "backup excluded");
    assert(library.rootFolder.gpxFiles.length === 1, "non-GPX excluded");
    const nested = library.rootFolder.folders[0].gpxFiles[0];

    assert(nested.driveEntry.relativePath === "2026/nested.GPX", "relative path generated");
    await nested.getFile();
    assert(downloads === 1, "GPX downloaded lazily");
    const settings = await library.rootFolder.handle.getFileHandle("trailbook.json");
    await settings.getFile();
    assert(downloads === 2, "root settings readable on demand");
    assert(await library.rootFolder.handle.requestPermission({ mode: "readwrite" }) === "denied", "write permission denied");
}

async function testNativeFetchBinding() {
    const originalFetch = globalThis.fetch;
    let receiverWasWindow = false;

    globalThis.fetch = function () {
        receiverWasWindow = this === globalThis;
        return Promise.resolve(response({ files: [] }));
    };

    try {
        const service = new DriveLibraryService({
            apiKey: "dummy-key",
            getAccessToken: () => "session-token"
        });

        await service.scan({ id: "root", name: "Drive Root" });
        assert(receiverWasWindow, "default native fetch keeps Window receiver");
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function testDriveGeometryCacheOrdering() {
    const modifiedTime = "2026-08-15T00:00:00Z";
    const lastModified = Date.parse(modifiedTime);
    const cached = {
        result: { tracks: [{ segments: [] }], waypoints: [] },
        summary: { displayName: "cached" }
    };
    const createService = counter => new DriveLibraryService({
        apiKey: "dummy-key",
        getAccessToken: () => "session-token",
        fetchFunction: async url => {
            assert(url.includes("alt=media"), "Drive media request unchanged");
            counter.count += 1;
            return response("<gpx/>", { binary: true });
        }
    });
    const createHandle = (service, overrides = {}) => new DriveFileHandle({
        fileId: "dummy-file",
        relativePath: "track.gpx",
        name: "track.gpx",
        mimeType: "application/gpx+xml",
        size: 6,
        modifiedTime,
        ...overrides
    }, service);
    const createLoader = ({ repository, parseCounter }) =>
        new GPXGeometryLoader({
            parser: {
                parse: () => {
                    parseCounter.count += 1;
                    return { tracks: [{ segments: [] }], waypoints: [] };
                }
            },
            repository,
            fileLoader: {
                getFile: handle => handle.getFile(),
                decode: async () => "<gpx/>"
            },
            summaryBuilder: { build: () => ({ displayName: "parsed" }) }
        });

    const hitDownloads = { count: 0 };
    const hitParses = { count: 0 };
    let hitWrites = 0;
    const hitLoader = createLoader({
        parseCounter: hitParses,
        repository: {
            getWithSummary: async (namespace, path, identity) => {
                assert(namespace === "drive:root", "Drive cache namespace");
                assert(path === "track.gpx", "Drive cache relative path");
                assert(identity.size === 6, "Drive metadata size identity");
                assert(identity.lastModified === lastModified,
                    "Drive metadata modifiedTime identity");
                return cached;
            },
            set: async () => { hitWrites += 1; return true; }
        }
    });

    hitLoader.setLibraryNamespace("drive:root");
    drivePerformance.start();
    const hitResult = await hitLoader.load(
        "track.gpx",
        createHandle(createService(hitDownloads))
    );
    assert(hitResult === cached.result, "Drive cache hit returns cached geometry");
    assert(hitDownloads.count === 0, "Drive cache hit skips media fetch");
    assert(hitParses.count === 0, "Drive cache hit skips parse");
    assert(hitWrites === 0, "Drive cache hit skips rewrite");
    assert(drivePerformance.metrics.cacheHits === 1,
        "Drive cache hit performance count");
    assert(drivePerformance.metrics.gpxDownloadCount === 0,
        "Drive cache hit download performance count");
    assert(drivePerformance.metrics.parseCount === 0,
        "Drive cache hit parse performance count");
    drivePerformance.cancel();

    const exerciseMiss = async ({ overrides = {}, lookup }) => {
        const downloads = { count: 0 };
        const parses = { count: 0 };
        let writes = 0;
        const service = createService(downloads);
        const loader = createLoader({
            parseCounter: parses,
            repository: {
                getWithSummary: lookup,
                set: async () => { writes += 1; return true; }
            }
        });

        loader.setLibraryNamespace("drive:root");
        drivePerformance.start();
        await loader.load("track.gpx", createHandle(service, overrides));
        const performanceCounts = {
            misses: drivePerformance.metrics.cacheMisses,
            downloads: drivePerformance.metrics.gpxDownloadCount,
            parses: drivePerformance.metrics.parseCount,
            writes: drivePerformance.metrics.cacheWriteCount
        };
        drivePerformance.cancel();
        return { downloads: downloads.count, parses: parses.count, writes,
            performanceCounts };
    };
    const miss = await exerciseMiss({ lookup: async () => null });

    assert(miss.downloads === 1 && miss.parses === 1 && miss.writes === 1,
        "Drive cache miss downloads, parses, and writes");
    assert(miss.performanceCounts.misses === 1 &&
        miss.performanceCounts.downloads === 1 &&
        miss.performanceCounts.parses === 1 &&
        miss.performanceCounts.writes === 1,
        "Drive cache miss performance counts");

    const sizeMiss = await exerciseMiss({
        overrides: { size: 7 },
        lookup: async (_namespace, _path, identity) =>
            identity.size === 6 ? cached : null
    });
    assert(sizeMiss.downloads === 1, "Drive size change misses cache");

    const modifiedMiss = await exerciseMiss({
        overrides: { modifiedTime: "2026-08-16T00:00:00Z" },
        lookup: async (_namespace, _path, identity) =>
            identity.lastModified === lastModified ? cached : null
    });
    assert(modifiedMiss.downloads === 1,
        "Drive modifiedTime change misses cache");

    const schemaMiss = await exerciseMiss({ lookup: async () => null });
    assert(schemaMiss.downloads === 1, "Drive schema mismatch misses cache");

    const lookupFailure = await exerciseMiss({
        lookup: async () => { throw new Error("IndexedDB unavailable"); }
    });
    assert(lookupFailure.downloads === 1 && lookupFailure.parses === 1,
        "Drive cache lookup failure falls back to download");

    const localOrder = [];
    const localLoader = new GPXGeometryLoader({
        parser: { parse: () => ({ tracks: [], waypoints: [] }) },
        repository: {
            getWithSummary: async () => { localOrder.push("lookup"); return cached; },
            set: async () => true
        },
        summaryBuilder: { build: () => ({}) }
    });
    localLoader.setLibraryNamespace("local:root");
    await localLoader.load("local.gpx", {
        name: "local.gpx",
        getFile: async () => {
            localOrder.push("getFile");
            return new File(["<gpx/>"], "local.gpx", { lastModified });
        }
    });
    assert(localOrder.join(",") === "getFile,lookup",
        "Local cache lookup remains after getFile");
}

async function waitFor(condition) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (condition()) return;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    throw new Error("Timed out waiting for asynchronous test state");
}

async function testDriveMissConcurrency() {
    const cached = {
        result: { id: "cached", tracks: [], waypoints: [] },
        summary: { displayName: "cached" }
    };
    const releases = [];
    let active = 0;
    let peak = 0;
    let started = 0;
    let completed = 0;
    const loader = new GPXGeometryLoader({
        parser: { parse: (_text, name) => ({ id: name, tracks: [], waypoints: [] }) },
        repository: {
            getWithSummary: async (_namespace, path) =>
                path === "hit.gpx" ? cached : null,
            set: async () => true
        },
        fileLoader: {
            getFile: handle => new Promise(resolve => {
                started += 1;
                active += 1;
                peak = Math.max(peak, active);
                releases.push(() => {
                    active -= 1;
                    completed += 1;
                    resolve(new File(["<gpx/>"], handle.name, {
                        lastModified: Date.parse(handle.driveEntry.modifiedTime)
                    }));
                });
            }),
            decode: async () => "<gpx/>"
        },
        summaryBuilder: { build: path => ({ displayName: path }) }
    });
    const handles = Array.from({ length: 10 }, (_, index) => ({
        name: `track-${index}.gpx`,
        driveEntry: {
            size: 6,
            modifiedTime: "2026-08-15T00:00:00Z"
        }
    }));

    loader.setLibraryNamespace("drive:root");
    drivePerformance.start();
    const requests = handles.map((handle, index) =>
        loader.load(`track-${index}.gpx`, handle));

    await waitFor(() => started === 4);
    assert(active === 4 && peak === 4,
        "Drive cache misses start with maximum concurrency four");
    await Promise.resolve();
    assert(started === 4, "fifth Drive miss waits for a slot");

    const hit = await loader.load("hit.gpx", {
        name: "hit.gpx",
        driveEntry: { size: 6, modifiedTime: "2026-08-15T00:00:00Z" }
    });
    assert(hit.id === "cached" && started === 4,
        "Drive cache hit consumes no download slot");

    releases.shift()();
    await waitFor(() => started === 5);
    assert(active === 4, "fifth Drive miss starts after slot release");

    while (completed < handles.length) {
        const pending = releases.splice(0);

        pending.forEach(release => release());
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    const results = await Promise.all(requests);

    assert(results.every((result, index) =>
        result.id === `track-${index}.gpx`),
    "concurrent Drive results preserve path identity");
    assert(drivePerformance.metrics.peakConcurrentDriveGpxOperations === 4,
        "Drive performance monitor records peak concurrency");
    assert(
        drivePerformance.metrics.gpxLoadPhaseStartedAt !== null &&
        drivePerformance.metrics.gpxLoadPhaseEndedAt !== null,
        "Drive performance monitor records GPX load phase"
    );
    drivePerformance.cancel();

    let failureStarts = 0;
    const failureLoader = new GPXGeometryLoader({
        parser: { parse: () => ({ tracks: [], waypoints: [] }) },
        repository: {
            getWithSummary: async () => null,
            set: async () => true
        },
        fileLoader: {
            getFile: async handle => {
                failureStarts += 1;
                if (handle.name === "fail.gpx") throw new Error("download failed");
                return new File(["<gpx/>"], handle.name, { lastModified: 0 });
            },
            decode: async () => "<gpx/>"
        },
        summaryBuilder: { build: () => ({}) }
    });
    const failureHandles = ["fail.gpx", "a.gpx", "b.gpx", "c.gpx", "d.gpx"]
        .map(name => ({
            name,
            driveEntry: { size: 6, modifiedTime: null }
        }));

    failureLoader.setLibraryNamespace("drive:root");
    const settled = await Promise.allSettled(failureHandles.map(handle =>
        failureLoader.load(handle.name, handle)));
    assert(failureStarts === 5 &&
        settled.filter(result => result.status === "fulfilled").length === 4,
    "Drive failure releases slot and remaining files continue");

    const queue = new GPXDisplayQueue(2);
    const queueReleases = [];
    let queueActive = 0;
    let queuePeak = 0;
    const queueDone = [];

    handles.forEach((handle, index) => queue.enqueue({
        path: `track-${index}.gpx`,
        fileHandle: handle,
        run: () => new Promise(resolve => {
            queueActive += 1;
            queuePeak = Math.max(queuePeak, queueActive);
            queueReleases.push(() => {
                queueActive -= 1;
                resolve(index);
            });
        }),
        onSuccess: value => queueDone.push(value)
    }));
    await waitFor(() => queueReleases.length === 4);
    assert(queuePeak === 4, "Display Queue starts four Drive requests");

    while (queueDone.length < handles.length) {
        const pending = queueReleases.splice(0);

        pending.forEach(release => release());
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    await queue.whenIdle();
    assert(queue.getActiveCount() === 0 && queue.getQueuedCount() === 0,
        "Display Queue becomes idle after all Drive requests");

    const localQueue = new GPXDisplayQueue(2);
    const localReleases = [];
    let localActive = 0;
    let localPeak = 0;

    for (let index = 0; index < 3; index += 1) {
        localQueue.enqueue({
            path: `local-${index}.gpx`,
            fileHandle: { name: `local-${index}.gpx` },
            run: () => new Promise(resolve => {
                localActive += 1;
                localPeak = Math.max(localPeak, localActive);
                localReleases.push(() => {
                    localActive -= 1;
                    resolve();
                });
            })
        });
    }
    await waitFor(() => localReleases.length === 2);
    assert(localPeak === 2, "Local Display Queue remains concurrency two");
    while (localQueue.getActiveCount() > 0 || localQueue.getQueuedCount() > 0) {
        const pending = localReleases.splice(0);

        pending.forEach(release => release());
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    await localQueue.whenIdle();
}

async function testDrivePerformanceCompletionLifecycle() {
    const summaries = [];
    const originalInfo = console.info;

    console.info = (...args) => {
        if (args[0] === "[TrailBook Drive Perf]") {
            summaries.push(args[1]);
        }
    };

    try {
        const coldOwner = () => true;
        const staleOwner = () => true;
        const coldSession = drivePerformance.start({
            restoreOwner: coldOwner
        });

        drivePerformance.markInitialRestoreStarted(coldSession);
        drivePerformance.markRestoreProducerStarted(staleOwner);
        drivePerformance.markRestoreProducerCompleted(staleOwner);
        drivePerformance.markDisplayQueueIdle(staleOwner);
        assert(!drivePerformance.restoreProducerStarted,
            "unowned restore cannot attach to active Drive session");
        drivePerformance.markRestoreProducerStarted(coldOwner);
        assert(drivePerformance.expectedEnqueueCount === null,
            "producer start treated an unset expected count as zero");
        drivePerformance.setRestoreGeneration(7, 10);
        drivePerformance.markDisplayQueueIdle(coldOwner);
        assert(!drivePerformance.summaryEmitted,
            "idle before producer completion does not emit summary");

        const endOperations = [];

        for (let index = 0; index < 10; index += 1) {
            drivePerformance.recordComponentCall("GPXDisplayQueue.enqueue");
            drivePerformance.recordComponentCall("GPXDisplayQueue.run");
            drivePerformance.increment("gpxDownloadCount");
            drivePerformance.increment("parseCount");
            drivePerformance.increment("cacheMisses");
            drivePerformance.increment("cacheWriteCount");
            drivePerformance.increment("mapLayerCount");
            drivePerformance.recordGenerationEnqueue(7, index + 1);

            if (index < 4) {
                endOperations.push(
                    drivePerformance.beginDriveGpxOperation()
                );
            }
        }

        drivePerformance.markRestoreProducerCompleted(coldOwner);
        assert(!drivePerformance.summaryEmitted,
            "producer completion waits for active consumers");
        await new Promise(resolve => setTimeout(resolve, 1));
        endOperations.forEach(end => end());
        assert(!drivePerformance.summaryEmitted,
            "consumer completion waits for explicit queue idle");
        drivePerformance.markDisplayQueueIdle(coldOwner);

        assert(drivePerformance.summaryEmitted && summaries.length === 1,
            "producer completion and queue idle emit one summary");
        assert(summaries[0].gpxDownload.count === 10 &&
            summaries[0].parse.count === 10 &&
            summaries[0].geometryCache.misses === 10 &&
            summaries[0].geometryCache.writes === 10 &&
            summaries[0].mapLayer.count === 10,
        "cold summary includes all ten processing results");
        assert(summaries[0].peakConcurrentDriveGpxOperations === 4,
            "cold summary preserves peak concurrency four");
        assert(summaries[0].gpxLoadPhaseWallMs > 0,
            "cold summary records GPX load phase wall time");
        assert(drivePerformance.firstPostSummaryComponent === null,
            "no component starts after cold summary");

        summaries.length = 0;
        const warmOwner = () => true;
        const warmSession = drivePerformance.start({
            restoreOwner: warmOwner
        });
        drivePerformance.markRestoreProducerStarted(warmOwner);
        drivePerformance.setRestoreGeneration(8, 10);
        drivePerformance.recordGenerationEnqueue(8, 10);
        drivePerformance.increment("cacheHits", 10);
        drivePerformance.increment("mapLayerCount", 10);
        drivePerformance.markRestoreProducerCompleted(warmOwner);
        drivePerformance.markDisplayQueueIdle(warmOwner);
        assert(!drivePerformance.summaryEmitted,
            "warm summary waits for restore readiness");
        drivePerformance.markInitialRestoreStarted(warmSession);
        assert(drivePerformance.summaryEmitted && summaries.length === 1,
            "warm cache-hit lifecycle emits one summary");
        assert(summaries[0].geometryCache.hits === 10 &&
            summaries[0].gpxDownload.count === 0 &&
            summaries[0].parse.count === 0 &&
            summaries[0].mapLayer.count === 10 &&
            summaries[0].peakConcurrentDriveGpxOperations === 0,
        "warm summary records hits without download or parse");

        const oldOwner = () => true;
        drivePerformance.start({ restoreOwner: oldOwner });
        const endOldSession = drivePerformance.begin("parseMs", "parseCount");
        const newOwner = () => true;
        drivePerformance.start({ restoreOwner: newOwner });
        endOldSession();
        assert(drivePerformance.metrics.parseCount === 0 &&
            drivePerformance.metrics.parseMs === 0,
        "operation completion cannot write into a newer session");
    } finally {
        drivePerformance.cancel();
        console.info = originalInfo;
    }
}

async function testRestoreEnqueueCompletionBoundary() {
    const summaries = [];
    const originalInfo = console.info;

    console.info = (...args) => {
        if (args[0] === "[TrailBook Drive Perf]") {
            summaries.push(args[1]);
        }
    };

    const runBatch = async ({ warm }) => {
        const owner = () => true;
        const session = drivePerformance.start({ restoreOwner: owner });
        const queue = new GPXDisplayQueue(2, 4);
        const generation = warm ? 42 : 41;
        const enqueued = queue.whenEnqueued({ generation, count: 10 });

        drivePerformance.markInitialRestoreStarted(session);
        drivePerformance.markRestoreProducerStarted(owner);
        assert(drivePerformance.expectedEnqueueCount === null,
            "restore expected count was not initially unset");
        drivePerformance.markRestoreProducerCompleted(owner);
        assert(!drivePerformance.restoreProducerCompleted,
            "unset expected count allowed producer completion");
        drivePerformance.setRestoreGeneration(generation, 10);
        assert(drivePerformance.expectedEnqueueCount === 10 &&
            drivePerformance.actualEnqueueCount === 0,
        "expected count was not fixed before enqueue");

        for (let index = 0; index < 10; index += 1) {
            Promise.resolve().then(() => queue.enqueue({
                generation,
                fileHandle: { driveEntry: {} },
                run: async () => {
                    if (warm) {
                        drivePerformance.increment("cacheHits");
                    } else {
                        const endOperation =
                            drivePerformance.beginDriveGpxOperation();
                        drivePerformance.increment("cacheMisses");
                        drivePerformance.increment("gpxDownloadCount");
                        drivePerformance.increment("parseCount");
                        await new Promise(resolve => setTimeout(resolve, 1));
                        endOperation();
                    }
                    drivePerformance.increment("mapLayerCount");
                }
            }));
        }

        assert(!drivePerformance.restoreProducerCompleted,
            "producer completed before delayed enqueue handlers");
        await enqueued;
        assert(
            drivePerformance.componentCalls.get("GPXDisplayQueue.enqueue") === 10,
            "producer boundary did not observe all ten enqueues"
        );
        drivePerformance.markRestoreProducerCompleted(owner);
        assert(!drivePerformance.summaryEmitted,
            "summary emitted before queued consumers completed");
        await queue.whenIdle();
        drivePerformance.markDisplayQueueIdle(owner);

        return summaries.at(-1);
    };

    try {
        const cold = await runBatch({ warm: false });
        assert(cold.gpxDownload.count === 10 &&
            cold.geometryCache.misses === 10 &&
            cold.parse.count === 10 &&
            cold.mapLayer.count === 10,
        "cold enqueue boundary summary omitted processing counters");
        assert(cold.peakConcurrentDriveGpxOperations === 4,
            "cold enqueue boundary did not preserve concurrency four");
        assert(summaries.length === 1,
            "cold enqueue boundary emitted more than one summary");

        const warm = await runBatch({ warm: true });
        assert(warm.geometryCache.hits === 10 &&
            warm.gpxDownload.count === 0 &&
            warm.parse.count === 0 &&
            warm.mapLayer.count === 10,
        "warm enqueue boundary summary is incorrect");
        assert(summaries.length === 2,
            "warm enqueue boundary emitted more than one summary");
        assert(drivePerformance.firstPostSummaryComponent === null,
            "component activity continued after final summary");
    } finally {
        drivePerformance.cancel();
        console.info = originalInfo;
    }
}

async function testZeroVisibleRestoreBoundary() {
    const summaries = [];
    const originalInfo = console.info;

    console.info = (...args) => {
        if (args[0] === "[TrailBook Drive Perf]") summaries.push(args[1]);
    };

    try {
        const owner = () => true;
        const session = drivePerformance.start({ restoreOwner: owner });

        drivePerformance.markInitialRestoreStarted(session);
        drivePerformance.markRestoreProducerStarted(owner);
        drivePerformance.markRestoreProducerCompleted(owner);
        drivePerformance.markDisplayQueueIdle(owner);
        assert(!drivePerformance.summaryEmitted,
            "unset expected count emitted an empty restore summary");

        drivePerformance.setRestoreGeneration(51, 0);
        drivePerformance.markRestoreProducerCompleted(owner);
        drivePerformance.markDisplayQueueIdle(owner);
        assert(drivePerformance.summaryEmitted && summaries.length === 1,
            "confirmed zero-visible restore did not emit one summary");
        assert(drivePerformance.expectedEnqueueCount === 0 &&
            drivePerformance.actualEnqueueCount === 0,
        "zero-visible restore counters are incorrect");
    } finally {
        drivePerformance.cancel();
        console.info = originalInfo;
    }
}

async function testCoordinator() {
    const data = new Map();
    const storage = {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value)
    };
    let applyCount = 0;
    const fullyConfigured = new DriveLibraryCoordinator({
        config: {
            clientId: "dummy-client",
            apiKey: "dummy-key",
            appId: "123456789"
        },
        storage: null,
        applyLibrary: async () => true
    });
    assert(!fullyConfigured.button.disabled, "all three config values enable Drive");
    assert(fullyConfigured.button.textContent.trim() === "Google Driveに直接接続",
        "Drive action does not use direct-connection wording");
    assert(fullyConfigured.element.querySelector(".drive-library-description")
        ?.textContent.includes("TrailBookからGoogle Driveへ接続"),
    "Drive direct-connection explanation is missing");
    const warningMessages = [];
    const originalWarn = console.warn;
    console.warn = message => warningMessages.push(String(message));
    const partiallyConfigured = new DriveLibraryCoordinator({
        config: {
            clientId: "dummy-client",
            apiKey: "dummy-key",
            appId: ""
        },
        storage: null,
        applyLibrary: async () => true
    });
    console.warn = originalWarn;
    assert(partiallyConfigured.button.disabled, "one missing value disables Drive");
    assert(
        !warningMessages.join(" ").includes("dummy-client") &&
        !warningMessages.join(" ").includes("dummy-key"),
        "credential values are not logged"
    );
    const auth = {
        isConfigured: () => true, authorize: async () => "token",
        getAccessToken: () => "token", clear() {}
    };
    const cancelled = new DriveLibraryCoordinator({
        auth, picker: { isConfigured: () => true, pickFolder: async () => null },
        libraryService: { scan: async () => { throw new Error("not called"); } },
        storage, applyLibrary: async () => { applyCount += 1; }
    });

    assert(await cancelled.open() === false && applyCount === 0, "Picker cancel preserves Library");

    const root = { id: "saved-root", name: "Saved Drive" };
    const connected = new DriveLibraryCoordinator({
        auth, picker: { isConfigured: () => true, pickFolder: async () => root },
        libraryService: { scan: async value => ({
            name: value.name, sourceType: "google-drive", readOnly: true
        }) },
        storage, applyLibrary: async () => { applyCount += 1; return true; },
        getCurrentLibrary: () => ({ sourceType: "google-drive" })
    });

    assert(await connected.open() === true, "Drive Library applied");
    assert(connected.button.textContent.trim() ===
        "別のGoogle Drive Libraryに直接接続",
    "Drive reconnect wording is inconsistent");
    assert(JSON.parse(data.get("trailbook.driveLibrary")).id === "saved-root", "previous root persisted");
    const reconnectAuth = { ...auth, authorize: async () => { applyCount += 1; return "token"; } };

    new DriveLibraryCoordinator({
        auth: reconnectAuth,
        picker: { isConfigured: () => true }, storage,
        applyLibrary: async () => true
    });
    assert(applyCount === 1, "reload makes no automatic API or OAuth call");

    const disabled = new DriveLibraryCoordinator({
        auth: { isConfigured: () => false },
        picker: { isConfigured: () => false }, storage: null
    });
    assert(disabled.button.disabled, "missing config disables Drive button");
}

try {
    await testRuntimeConfig();
    await testAuth();
    await testPicker();
    await testLibrary();
    await testNativeFetchBinding();
    await testDriveGeometryCacheOrdering();
    await testDriveMissConcurrency();
    await testDrivePerformanceCompletionLifecycle();
    await testRestoreEnqueueCompletionBoundary();
    await testZeroVisibleRestoreBoundary();
    await testCoordinator();
    results.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    results.textContent = `FAIL: ${error.message}`;
    document.title = "FAIL";
    throw error;
}
