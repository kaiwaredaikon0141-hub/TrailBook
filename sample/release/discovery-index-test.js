import Config from "../../src/js/core/Config.js";
import TrackDiscoveryEntry, {
    DATE_SOURCES
} from "../../src/js/models/TrackDiscoveryEntry.js";
import GeometryCacheRepository from "../../src/js/services/GeometryCacheRepository.js";
import GPXGeometryLoader from "../../src/js/services/GPXGeometryLoader.js";
import LibraryDiscoveryIndexService from "../../src/js/services/LibraryDiscoveryIndexService.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class MemoryAdapter {
    constructor() {
        this.values = new Map();
        this.failRead = false;
        this.failWrite = false;
    }

    async get(key) {
        if (this.failRead) throw new Error("read failed");
        return this.values.get(key) || null;
    }

    async set(key, value) {
        if (this.failWrite) throw new Error("write failed");
        this.values.set(key, structuredClone(value));
    }

    async delete(key) {
        this.values.delete(key);
    }
}

function file(name, { size = 100, lastModified = Date.UTC(2026, 7, 3) } = {}) {
    return { name, size, lastModified, async text() { return "<gpx />"; } };
}

function handle(sourceFile) {
    return { name: sourceFile.name, async getFile() { return sourceFile; } };
}

function point(latitude, longitude, { time = null, elevation = null } = {}) {
    return { latitude, longitude, time, elevation };
}

function parsed({ metadataName = "Metadata Name", metadataTime = null } = {}) {
    return {
        metadata: { name: metadataName, time: metadataTime },
        tracks: [{
            name: "Morning Ride",
            segments: [{
                points: [
                    point(0, 0, {
                        time: "2026-08-02T01:00:00Z",
                        elevation: 10
                    }),
                    point(0, 1, {
                        time: "2026-08-02T02:00:00Z",
                        elevation: 30
                    })
                ]
            }, {
                points: [point(10, 10, {
                    time: "2026-08-02T00:30:00Z",
                    elevation: 20
                })]
            }]
        }, {
            name: "Morning Ride",
            segments: [{ points: [point(20, 20)] }]
        }],
        waypoints: [],
        warnings: []
    };
}

function testSummaryBuilder() {
    const builder = new TrackSummaryBuilder();
    const sourceFile = file("ride_20260804.gpx", {
        size: 4321,
        lastModified: Date.UTC(2026, 7, 3, 12)
    });
    const result = parsed({ metadataTime: "2026-08-01T23:00:00Z" });
    const summary = builder.build("deep/ride_20260804.gpx", sourceFile, result);

    assert(summary instanceof TrackDiscoveryEntry, "summary model missing");
    assert(Object.isFrozen(summary), "summary is mutable");
    assert(Object.isFrozen(summary.trackNames), "trackNames are mutable");
    assert(summary.relativePath === "deep/ride_20260804.gpx", "relativePath");
    assert(summary.folderPath === "deep", "folderPath");
    assert(summary.originalFileName === sourceFile.name, "originalFileName");
    assert(summary.displayName === "Metadata Name", "metadata displayName");
    assert(summary.trackNames.length === 1 && summary.trackNames[0] === "Morning Ride",
        "track name dedupe");
    assert(summary.dateSource === DATE_SOURCES.METADATA, "metadata date priority");
    assert(summary.resolvedDate.toISOString() === "2026-08-01T23:00:00.000Z",
        "metadata date value");
    assert(summary.pointCount === 4, "point count");
    assert(summary.startTime.toISOString() === "2026-08-02T00:30:00.000Z",
        "start time");
    assert(summary.endTime.toISOString() === "2026-08-02T02:00:00.000Z",
        "end time");
    assert(summary.duration === 5400000, "duration");
    assert(summary.distance > 111000 && summary.distance < 111300,
        "Segment distance or boundary calculation");
    assert(summary.elevationMin === 10 && summary.elevationMax === 30,
        "elevation range");
    assert(summary.fileSize === 4321, "fileSize");
    assert(summary.lastModified === sourceFile.lastModified, "lastModified");

    const pointDate = builder.build(
        "point.gpx",
        file("point.gpx"),
        parsed({ metadataTime: "invalid" })
    );
    assert(pointDate.dateSource === DATE_SOURCES.TRACK_POINT,
        "TrackPoint fallback missing");
    assert(pointDate.resolvedDate.toISOString() === "2026-08-02T01:00:00.000Z",
        "first valid TrackPoint document order changed");

    const invalidCalendarMetadata = builder.build(
        "invalid-calendar.gpx",
        file("invalid-calendar.gpx"),
        parsed({ metadataTime: "2026-02-31T00:00:00Z" })
    );
    assert(invalidCalendarMetadata.dateSource === DATE_SOURCES.TRACK_POINT,
        "invalid metadata calendar date accepted");

    const noTracks = { metadata: { name: null, time: null }, tracks: [], waypoints: [] };
    const modified = builder.build("modified.gpx", file("modified.gpx"), noTracks);
    assert(modified.dateSource === DATE_SOURCES.FILE_MODIFIED,
        "File.lastModified fallback missing");
    assert(modified.displayName === "modified.gpx", "filename display fallback");
    assert(modified.duration === null && modified.startTime === null,
        "missing time did not remain null");
    assert(modified.elevationMin === null && modified.elevationMax === null,
        "missing elevation did not remain null");

    const brokenNames = parsed({ metadataName: "���" });
    brokenNames.tracks.forEach(track => { track.name = "Broken � name"; });
    const brokenNameSummary = builder.build(
        "msx/2022-01-02_12-39_Sun_reduce.gpx",
        file("2022-01-02_12-39_Sun_reduce.gpx"),
        brokenNames
    );
    assert(
        brokenNameSummary.displayName === "2022-01-02_12-39_Sun_reduce.gpx",
        "replacement character name outranked relative filename"
    );
    assert(brokenNameSummary.trackNames.length === 0,
        "broken Track name entered Discovery Index");

    const mixedNames = parsed({ metadataName: "Invalid � metadata" });
    mixedNames.tracks[0].name = "���";
    mixedNames.tracks[1].name = "正常なTrack";
    const mixedNameSummary = builder.build(
        "mixed.gpx",
        file("mixed.gpx"),
        mixedNames
    );
    assert(mixedNameSummary.displayName === "正常なTrack",
        "valid Track name did not outrank filename fallback");
    assert(mixedNameSummary.trackNames.length === 1 &&
        mixedNameSummary.trackNames[0] === "正常なTrack",
        "invalid and valid Track names were not separated");

    const filename = builder.build(
        "ride_20260804.gpx",
        file("ride_20260804.gpx", { lastModified: Number.NaN }),
        noTracks
    );
    assert(filename.dateSource === DATE_SOURCES.FILE_NAME, "filename fallback missing");
    assert(filename.resolvedDate.getFullYear() === 2026 &&
        filename.resolvedDate.getMonth() === 7 &&
        filename.resolvedDate.getDate() === 4, "filename date value");

    const invalidFilename = builder.build(
        "ride_20260231.gpx",
        file("ride_20260231.gpx", { lastModified: Number.NaN }),
        noTracks
    );
    assert(invalidFilename.dateSource === DATE_SOURCES.UNKNOWN,
        "invalid filename date accepted");
    assert(invalidFilename.resolvedDate === null, "Unknown Date has a value");

    const restored = TrackDiscoveryEntry.fromRecord(summary.toRecord());
    assert(restored?.resolvedDate instanceof Date, "cache record date not restored");
    assert(restored?.distance === summary.distance, "cache record metric changed");
    assert(TrackDiscoveryEntry.fromRecord({}) === null, "invalid cache summary accepted");
}

async function testSharedLoaderAndCache() {
    const adapter = new MemoryAdapter();
    const repository = new GeometryCacheRepository(Config.geometryCache, { adapter });
    const sourceFile = file("shared.gpx");
    let parseCalls = 0;
    let textCalls = 0;
    let decodeCalls = 0;
    sourceFile.text = async () => { textCalls += 1; return "<gpx />"; };
    const fileLoader = {
        getFile(fileHandle) { return fileHandle.getFile(); },
        async decode(fileValue) {
            decodeCalls += 1;
            return fileValue.text();
        }
    };
    const parser = {
        parse() { parseCalls += 1; return parsed({ metadataTime: null }); }
    };
    const loader = new GPXGeometryLoader({ parser, repository, fileLoader });
    loader.setLibraryNamespace("discovery-library");

    const resultPromise = loader.load("folder/shared.gpx", handle(sourceFile));
    const summaryPromise = loader.loadSummary("folder/shared.gpx", handle(sourceFile));
    const [result, summary] = await Promise.all([resultPromise, summaryPromise]);

    assert(result.tracks.length === 2, "display result missing");
    assert(summary.relativePath === "folder/shared.gpx", "summary missing");
    assert(parseCalls === 1 && textCalls === 1, "display/index duplicate parse");
    assert(decodeCalls === 1, "shared loader bypassed GPX decode path");
    assert(loader.getStats().deduplicated === 1, "shared inflight not recorded");
    assert(adapter.values.size === 1, "cache write duplicated");

    const stored = [...adapter.values.values()][0];
    assert(stored.cacheSchemaVersion === 3, "discovery cache schema");
    assert(stored.textDecoderSchemaVersion === 1,
        "discovery cache decoder schema");
    assert(stored.summary.pointCount === 4, "compact summary not cached");
    assert(!JSON.stringify(stored).includes("<gpx"), "GPX XML cached");
    assert(!JSON.stringify(stored).includes("leaflet"), "Leaflet state cached");

    const warmParser = { parse() { throw new Error("warm cache parsed XML"); } };
    const warmLoader = new GPXGeometryLoader({ parser: warmParser, repository });
    warmLoader.setLibraryNamespace("discovery-library");
    const warmSummary = await warmLoader.loadSummary(
        "folder/shared.gpx",
        handle(sourceFile)
    );
    assert(warmSummary.pointCount === 4, "warm summary cache miss");
    assert(warmLoader.getStats().hits === 1, "warm cache hit not counted");

    const key = JSON.stringify(["discovery-library", "folder/shared.gpx"]);
    adapter.values.get(key).summary = { broken: true };
    const reparsed = await loader.loadSummary("folder/shared.gpx", handle(sourceFile));
    assert(reparsed.pointCount === 4, "corrupt summary did not fallback");
    assert(parseCalls === 2, "corrupt summary did not reparse exactly once");

    await loader.loadSummary("folder/other.gpx", handle(sourceFile));
    const otherKey = JSON.stringify(["discovery-library", "folder/other.gpx"]);
    adapter.values.get(key).summary.displayName = "Broken � name";
    adapter.values.get(key).summary.trackNames = ["���"];
    let brokenNameParses = 0;
    const brokenNameResult = parsed({ metadataName: "���" });
    brokenNameResult.tracks.forEach(track => { track.name = "���"; });
    const brokenNameLoader = new GPXGeometryLoader({
        parser: {
            parse() {
                brokenNameParses += 1;
                return brokenNameResult;
            }
        },
        repository,
        fileLoader
    });
    brokenNameLoader.setLibraryNamespace("discovery-library");
    const repairedName = await brokenNameLoader.loadSummary(
        "folder/shared.gpx",
        handle(sourceFile)
    );
    assert(repairedName.displayName === "shared.gpx",
        "broken cached name did not fallback to filename");
    assert(brokenNameParses === 1,
        "broken cached name did not reparse exactly once");
    assert(adapter.values.has(otherKey),
        "unrelated cache entry was cleared");
    assert(adapter.values.get(key).summary.displayName === "shared.gpx",
        "repaired summary was not cached");

    adapter.failRead = true;
    const fallback = await loader.loadSummary("read-failure.gpx", handle(sourceFile));
    adapter.failRead = false;
    assert(fallback.relativePath === "read-failure.gpx", "read failure stopped fallback");

    adapter.failWrite = true;
    const quota = await loader.loadSummary("quota.gpx", handle(sourceFile));
    adapter.failWrite = false;
    assert(quota.pointCount === 4, "quota failure stopped summary");
    assert(loader.getStats().writeFailures === 1, "quota failure not counted");
}

async function testLazyIndex() {
    const builder = new TrackSummaryBuilder();
    let loadCalls = 0;
    let namespace = null;
    let active = 0;
    let maxActive = 0;
    const loader = {
        setLibraryNamespace(value) { namespace = value; },
        async loadSummary(path, fileHandle) {
            loadCalls += 1;
            active += 1;
            maxActive = Math.max(maxActive, active);
            await Promise.resolve();
            active -= 1;
            if (path === "broken.gpx") throw new Error("broken GPX");
            return builder.build(path, await fileHandle.getFile(), parsed());
        }
    };
    const index = new LibraryDiscoveryIndexService({ loader, concurrency: 2 });
    const sources = [
        { path: "b.gpx", fileHandle: handle(file("b.gpx")) },
        { path: "a.gpx", fileHandle: handle(file("a.gpx")) },
        { path: "a.gpx", fileHandle: handle(file("duplicate.gpx")) },
        { path: "broken.gpx", fileHandle: handle(file("broken.gpx")) }
    ];

    index.setLibrary({ namespace: "lazy", fileEntries: sources, generation: 4 });
    assert(index.getStatus() === "idle", "index did not remain lazy");
    assert(loadCalls === 0 && index.getEntries().length === 0,
        "setLibrary started index build");
    assert(namespace === "lazy", "Library namespace not applied");

    const progress = [];
    const firstBuild = index.build({
        onProgress: value => progress.push(value),
        isCurrent: generation => generation === 4
    });
    const duplicateBuild = index.build();
    assert(firstBuild === duplicateBuild, "duplicate build did not share promise");
    const entries = await firstBuild;

    assert(index.getStatus() === "ready", "index did not become ready");
    assert(entries.length === 3, "one entry per unique GPX not enforced");
    assert(entries.map(entry => entry.relativePath).join(",") ===
        "a.gpx,b.gpx,broken.gpx", "index path order unstable");
    assert(index.getEntry("broken.gpx").status === "error",
        "invalid GPX fallback entry missing");
    assert(index.getFailures().size === 1, "partial failure not recorded");
    assert(progress.at(-1).completed === 3, "progress did not complete");
    assert(maxActive <= 2, "index concurrency exceeded limit");
    assert(loadCalls === 3, "duplicate path was loaded");

    await index.build();
    assert(loadCalls === 3, "ready index rebuilt unexpectedly");
}

async function testGenerationGuard() {
    const builder = new TrackSummaryBuilder();
    const releases = [];
    const loader = {
        setLibraryNamespace() {},
        loadSummary(path, fileHandle) {
            return new Promise(resolve => releases.push(async () => {
                resolve(builder.build(path, await fileHandle.getFile(), parsed()));
            }));
        }
    };
    const index = new LibraryDiscoveryIndexService({ loader });

    index.setLibrary({
        namespace: "old",
        generation: 1,
        fileEntries: [{ path: "old.gpx", fileHandle: handle(file("old.gpx")) }]
    });
    const oldBuild = index.build({ isCurrent: generation => generation === 1 });
    index.setLibrary({
        namespace: "new",
        generation: 2,
        fileEntries: [{ path: "new.gpx", fileHandle: handle(file("new.gpx")) }]
    });
    await releases.shift()();
    await oldBuild;
    assert(index.getEntry("old.gpx") === null, "stale Library result applied");
    assert(index.getStatus() === "idle", "new Library status changed by stale build");

    const newBuild = index.build({ isCurrent: generation => generation === 2 });
    await releases.shift()();
    await newBuild;
    assert(index.getEntry("new.gpx") !== null, "new Library result missing");
}

async function testLargeWarmIndexContract() {
    const builder = new TrackSummaryBuilder();
    const cachedResult = parsed({ metadataTime: "2026-08-01T00:00:00Z" });
    let calls = 0;
    const loader = {
        setLibraryNamespace() {},
        async loadSummary(path, fileHandle) {
            calls += 1;
            return builder.build(path, await fileHandle.getFile(), cachedResult);
        }
    };
    const index = new LibraryDiscoveryIndexService({ loader, concurrency: 2 });
    const fileEntries = Array.from({ length: 806 }, (_, itemIndex) => {
        const name = `track-${String(itemIndex).padStart(4, "0")}.gpx`;
        return { path: `bulk/${name}`, fileHandle: handle(file(name)) };
    });

    index.setLibrary({
        namespace: "warm-806",
        generation: 1,
        fileEntries
    });
    assert(calls === 0, "806 entry configuration was not lazy");
    const entries = await index.build();
    assert(entries.length === 806, "806 entry index incomplete");
    assert(calls === 806, "806 entry index duplicated or skipped load");
    assert(new Set(entries.map(entry => entry.relativePath)).size === 806,
        "806 entry index contains duplicate paths");
}

async function testTargetedEntryReplacement() {
    const releases = [];
    const loader = {
        setLibraryNamespace() {},
        loadSummary(path, fileHandle) {
            return new Promise(resolve => releases.push(() => resolve({
                relativePath: path,
                displayName: fileHandle.marker,
                resolvedDate: null
            })));
        }
    };
    const index = new LibraryDiscoveryIndexService({ loader });
    const oldHandle = { marker: "old" };
    const newHandle = { marker: "edited" };

    index.setLibrary({
        namespace: "replace",
        generation: 1,
        fileEntries: [{ path: "same.gpx", fileHandle: oldHandle }]
    });
    const stale = index.loadEntry("same.gpx");
    assert(index.replaceFileEntry({
        relativePath: "same.gpx",
        fileHandle: newHandle
    }), "same-path Discovery source was not replaceable");
    const current = index.loadEntry("same.gpx");

    releases.shift()();
    assert(await stale === null, "stale pre-save summary was applied");
    releases.shift()();
    assert((await current).displayName === "edited",
        "edited same-path summary was not applied");
    assert(index.getEntries().length === 1,
        "same-path refresh created a duplicate Discovery entry");
}

try {
    assert(Config.version === "1.8.0", "Config version is 1.8.0");
    assert(Config.geometryCache.cacheSchemaVersion === 3,
        "Geometry/discovery cache schema not updated");
    assert(Config.geometryCache.textDecoderSchemaVersion === 1,
        "Geometry/discovery decoder schema missing");
    testSummaryBuilder();
    await testSharedLoaderAndCache();
    await testLazyIndex();
    await testGenerationGuard();
    await testTargetedEntryReplacement();
    await testLargeWarmIndexContract();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
