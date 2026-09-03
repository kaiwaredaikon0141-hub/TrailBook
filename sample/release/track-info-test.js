import TrackInfoCoordinator from "../../src/js/core/TrackInfoCoordinator.js";
import TrackDiscoveryEntry, {
    DATE_SOURCES
} from "../../src/js/models/TrackDiscoveryEntry.js";
import LibraryDiscoveryIndexService from "../../src/js/services/LibraryDiscoveryIndexService.js";
import GPXLoader from "../../src/js/services/GPXLoader.js";
import GPXParser from "../../src/js/services/GPXParser.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";
import TrackInfoView from "../../src/js/ui/TrackInfoView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function entry(path = "trips/sample.gpx", overrides = {}) {
    return new TrackDiscoveryEntry({
        relativePath: path,
        folderPath: "trips",
        originalFileName: "sample.gpx",
        displayName: "Morning Ride",
        resolvedDate: new Date("2026-08-08T01:02:03Z"),
        dateSource: DATE_SOURCES.METADATA,
        pointCount: 1234,
        startTime: new Date("2026-08-08T01:02:03Z"),
        endTime: new Date("2026-08-08T02:03:04Z"),
        duration: 3661000,
        distance: 12345,
        elevationMin: 12.34,
        elevationMax: 456.78,
        fileSize: 10,
        lastModified: 20,
        ...overrides
    });
}

function field(view, name) {
    return view.element.querySelector(
        `[data-track-info-field="${name}"]`
    ).textContent;
}

function deferred() {
    let resolve;
    const promise = new Promise(next => { resolve = next; });
    return { promise, resolve };
}

function joinBytes(...parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;

    parts.forEach(part => {
        result.set(part, offset);
        offset += part.length;
    });
    return result;
}

function encodeUTF16LE(value) {
    const bytes = new Uint8Array(value.length * 2);

    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);

        bytes[index * 2] = code & 0xff;
        bytes[index * 2 + 1] = code >> 8;
    }
    return bytes;
}

async function testGPXDecoding() {
    const loader = new GPXLoader();
    const parser = new GPXParser();
    const encoder = new TextEncoder();
    const suffix = encoder.encode(
        "</name><trkseg><trkpt lat=\"35\" lon=\"135\"/>" +
        "</trkseg></trk></gpx>"
    );
    const shiftJisName = new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
    const createFile = bytes => ({
        name: "encoded.gpx",
        size: bytes.length,
        lastModified: 1,
        async arrayBuffer() {
            return bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
            );
        }
    });
    const shiftJisBytes = joinBytes(
        encoder.encode(
            "<?xml version=\"1.0\" encoding=\"Windows-31J\"?>" +
            "<gpx version=\"1.1\"><trk><name>"
        ),
        shiftJisName,
        suffix
    );
    const shiftJisText = await loader.decode(createFile(shiftJisBytes));
    const shiftJisResult = parser.parse(shiftJisText, "encoded.gpx");

    assert(shiftJisResult.tracks[0].name === "テスト",
        "Windows-31J Track name was not decoded");
    const summary = new TrackSummaryBuilder().build(
        "encoded.gpx",
        createFile(shiftJisBytes),
        shiftJisResult
    );
    assert(summary.displayName === "テスト",
        "decoded Track name did not reach Discovery summary");

    const replacementXml = encoder.encode(
        "<gpx version=\"1.1\"><trk><name>Broken � name</name>" +
        "<trkseg><trkpt lat=\"35\" lon=\"135\"/></trkseg></trk></gpx>"
    );
    const replacementText = await loader.decode(createFile(replacementXml));
    const replacementResult = parser.parse(
        replacementText,
        "2022-01-02_12-39_Sun_reduce.gpx"
    );
    assert(replacementResult.tracks[0].name.includes("�"),
        "Parser path did not preserve the decoded replacement character");
    const replacementSummary = new TrackSummaryBuilder().build(
        "msx/2022-01-02_12-39_Sun_reduce.gpx",
        {
            ...createFile(replacementXml),
            name: "2022-01-02_12-39_Sun_reduce.gpx"
        },
        replacementResult
    );
    assert(
        replacementSummary.displayName === "2022-01-02_12-39_Sun_reduce.gpx",
        "broken Parser Track name did not fallback to relative filename"
    );
    assert(replacementSummary.trackNames.length === 0,
        "broken Parser Track name remained searchable");

    const utf8Xml = encoder.encode(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<gpx version=\"1.1\"><trk><name>朝練" +
        "</name><trkseg><trkpt lat=\"35\" lon=\"135\"/>" +
        "</trkseg></trk></gpx>"
    );
    const utf8Bom = joinBytes(new Uint8Array([0xef, 0xbb, 0xbf]), utf8Xml);

    assert((await loader.decode(createFile(utf8Bom))).includes("朝練"),
        "UTF-8 BOM Track name was not decoded");

    const utf16Bom = joinBytes(
        new Uint8Array([0xff, 0xfe]),
        encodeUTF16LE(
            "<?xml version=\"1.0\" encoding=\"UTF-16\"?>" +
            "<gpx version=\"1.1\"><trk><name>朝練</name></trk></gpx>"
        )
    );
    assert((await loader.decode(createFile(utf16Bom))).includes("朝練"),
        "UTF-16 BOM Track name was not decoded");

    const implicitShiftJis = joinBytes(
        encoder.encode("<gpx version=\"1.1\"><trk><name>"),
        shiftJisName,
        suffix
    );
    assert((await loader.decode(createFile(implicitShiftJis))).includes("テスト"),
        "invalid UTF-8 did not use safe Shift_JIS fallback");

    const unsupported = encoder.encode(
        "<?xml version=\"1.0\" encoding=\"unsupported\"?>" +
        "<gpx version=\"1.1\"><trk><name>朝練</name></trk></gpx>"
    );
    assert((await loader.decode(createFile(unsupported))).includes("朝練"),
        "unsupported declaration did not preserve UTF-8 fallback");
}

function testView() {
    const view = new TrackInfoView();

    assert(view.element.matches("section.track-info"), "Track Info section missing");
    assert(view.state.getAttribute("aria-live") === "polite", "live status missing");
    assert(field(view, "displayName") === "—", "empty state value");

    view.showLoading();
    assert(view.state.textContent.includes("読み込み中"), "loading state missing");

    view.showEntry(entry());
    assert(field(view, "displayName") === "Morning Ride", "display name");
    assert(field(view, "folderPath") === "trips", "folder path");
    assert(field(view, "resolvedDate") !== "—", "resolved date");
    assert(field(view, "dateSource") === "GPX metadata", "date source");
    assert(field(view, "distance").includes("12.35 km"), "distance format");
    assert(field(view, "pointCount").replace(/\D/g, "") === "1234", "point count");
    assert(field(view, "startTime") !== "—", "start time");
    assert(field(view, "endTime") !== "—", "end time");
    assert(field(view, "duration") === "1時間 1分 1秒", "duration format");
    assert(field(view, "elevationMin").includes("12.3 m"), "minimum elevation");
    assert(field(view, "elevationMax").includes("456.8 m"), "maximum elevation");

    view.showEntry(entry("root.gpx", {
        folderPath: "",
        resolvedDate: null,
        dateSource: DATE_SOURCES.UNKNOWN,
        startTime: null,
        endTime: null,
        duration: null,
        elevationMin: null,
        elevationMax: null
    }));
    assert(field(view, "folderPath") === "Library root", "root Folder label");
    assert(field(view, "resolvedDate") === "—", "unknown date fallback");
    assert(field(view, "duration") === "—", "missing duration fallback");
    assert(field(view, "elevationMin") === "—", "missing elevation fallback");

    view.showEntry(entry("broken.gpx", { status: "error" }));
    assert(view.state.textContent.includes("取得できません"), "error state missing");
    assert(field(view, "displayName") === "Morning Ride", "known error name hidden");
    assert(field(view, "distance") === "—", "failed summary metrics shown");

    view.showUnavailable();
    assert(field(view, "displayName") === "—", "unavailable state not cleared");
}

async function testIndexEntryLoad() {
    let loadCount = 0;
    const summary = entry();
    const loader = {
        setLibraryNamespace() {},
        async loadSummary() { loadCount += 1; return summary; }
    };
    const sourceResolver = {
        resolve: path => ({
            status: "ready",
            relativePath: path,
            actualFileHandle: { kind: "file", async getFile() {} }
        })
    };
    const index = new LibraryDiscoveryIndexService({
        loader, sourceResolver
    });

    index.setLibrary({
        generation: 1,
        fileEntries: [{ path: summary.relativePath, fileHandle: {} }]
    });
    const [first, second] = await Promise.all([
        index.loadEntry(summary.relativePath),
        index.loadEntry(summary.relativePath)
    ]);
    assert(first === summary && second === summary, "entry load result");
    assert(loadCount === 1, "entry load was not deduplicated");
    assert(index.getEntry(summary.relativePath) === summary, "entry not indexed");
    assert(index.getStatus() === "idle", "single entry load started full build");
    assert(await index.loadEntry("missing.gpx") === null, "stale path not ignored");

    const wait = deferred();
    const staleIndex = new LibraryDiscoveryIndexService({
        loader: {
            setLibraryNamespace() {},
            loadSummary() { return wait.promise; }
        },
        sourceResolver
    });
    staleIndex.setLibrary({
        generation: 1,
        fileEntries: [{ path: summary.relativePath, fileHandle: {} }]
    });
    const staleLoad = staleIndex.loadEntry(summary.relativePath);
    staleIndex.setLibrary({ generation: 2, fileEntries: [] });
    wait.resolve(summary);
    assert(await staleLoad === null, "old Library summary was projected");
    assert(staleIndex.getEntries().length === 0, "stale entry mixed into new Library");
}

async function testCoordinator() {
    const first = entry("first.gpx");
    const second = entry("second.gpx", { displayName: "Second" });
    const wait = deferred();
    const calls = [];
    const view = {
        element: document.createElement("section"),
        showEmpty() { calls.push("empty"); },
        showLoading() { calls.push("loading"); },
        showUnavailable() { calls.push("unavailable"); },
        showEntry(value) { calls.push(`entry:${value.displayName}`); }
    };
    const entries = new Map([[second.relativePath, second]]);
    const index = {
        getEntry(path) { return entries.get(path) || null; },
        loadEntry(path) {
            if (path === first.relativePath) return wait.promise;
            if (path === "failure.gpx") return Promise.reject(new Error("failed"));
            return Promise.resolve(null);
        }
    };
    const coordinator = new TrackInfoCoordinator({ index, view });

    coordinator.setLibrary({ generation: 1, isCurrent: () => true });
    const staleRequest = coordinator.setSelectedPath(first.relativePath);
    assert(calls.at(-1) === "loading", "selection did not show loading immediately");
    assert(await coordinator.setSelectedPath(second.relativePath), "cached entry failed");
    assert(calls.at(-1) === "entry:Second", "cached entry not shown immediately");
    wait.resolve(first);
    assert(await staleRequest === false, "stale selection request committed");
    assert(calls.at(-1) === "entry:Second", "stale selection replaced current info");

    assert(!await coordinator.setSelectedPath("stale.gpx"), "missing path accepted");
    assert(calls.at(-1) === "unavailable", "missing path state");
    assert(!await coordinator.setSelectedPath("failure.gpx"), "load failure accepted");
    assert(calls.at(-1) === "unavailable", "failure state");
    assert(!await coordinator.setSelectedPath(null), "empty selection accepted");
    assert(calls.at(-1) === "empty", "selection clear did not show empty state");
    coordinator.clearLibrary();
    assert(calls.at(-1) === "empty", "Library clear did not clear Track Info");
    assert(!await coordinator.setSelectedPath(second.relativePath),
        "stale selection after Library clear was accepted");
    assert(calls.at(-1) === "unavailable",
        "stale selection after Library clear was displayed");
}

try {
    testView();
    await testGPXDecoding();
    await testIndexEntryLoad();
    await testCoordinator();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.stack || error}`;
}
