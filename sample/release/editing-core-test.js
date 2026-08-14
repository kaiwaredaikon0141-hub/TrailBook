import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import GPXEditingSerializer from "../../src/js/services/GPXEditingSerializer.js";
import GPXEditingSourceLoader, {
    GPX_EDITING_SOURCE_BLOCK_REASONS
} from "../../src/js/services/GPXEditingSourceLoader.js";
import EditingCommandHistory, {
    EDITING_HISTORY_LIMIT
} from "../../src/js/state/EditingCommandHistory.js";

const output = document.getElementById("result");
let assertions = 0;

const SOURCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:tb="urn:trailbook:test" version="1.1" creator="test">
  <metadata><name>Source</name><extensions><tb:meta>keep</tb:meta></extensions></metadata>
  <wpt lat="34" lon="134"><name>Waypoint</name><extensions><tb:wpt>keep</tb:wpt></extensions></wpt>
  <rte><name>Route</name><rtept lat="34.5" lon="134.5"/></rte>
  <trk>
    <name>Track</name>
    <extensions><tb:track>keep</tb:track></extensions>
    <trkseg>
      <trkpt lat="35" lon="135" tb:id="p1"><ele>10</ele><time>2026-08-08T00:00:00Z</time><extensions><tb:point>keep-1</tb:point></extensions></trkpt>
      <trkpt lat="35.1" lon="135.1" tb:id="p2" tb:removed="do-not-transfer"><ele>20</ele><time>2026-08-08T00:01:00Z</time><extensions><tb:point>remove</tb:point></extensions></trkpt>
      <trkpt lat="35.2" lon="135.2" tb:id="p3"><ele>30</ele><time>2026-08-08T00:02:00Z</time><extensions><tb:point>keep-3</tb:point></extensions></trkpt>
      <extensions><tb:segment>keep</tb:segment></extensions>
    </trkseg>
    <trkseg>
      <trkpt lat="36" lon="136"/><trkpt lat="36.1" lon="136.1"/>
    </trkseg>
  </trk>
  <extensions><tb:root>keep</tb:root></extensions>
</gpx>`;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function createHandle(xmlText, {
    name = "source.gpx",
    lastModified = 123456
} = {}) {
    const bytes = new TextEncoder().encode(xmlText);
    let reads = 0;
    const file = {
        name,
        size: bytes.length,
        lastModified,
        async arrayBuffer() {
            return bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
            );
        }
    };

    return {
        name,
        get reads() { return reads; },
        async getFile() {
            reads += 1;
            return file;
        }
    };
}

function directChildren(element, localName) {
    return Array.from(element.children).filter(
        child => child.localName === localName
    );
}

async function testSourceMapping() {
    const handle = createHandle(SOURCE_XML);
    const source = await new GPXEditingSourceLoader().load(
        handle,
        "trips/source.gpx"
    );

    assert(source.canSerialize, "valid source was blocked");
    assert(source.saveBlockReasons.length === 0, "valid source has block reasons");
    assert(source.relativePath === "trips/source.gpx", "relative path lost");
    assert(source.sourceFileName === "source.gpx", "source filename lost");
    assert(source.fingerprint.size === new TextEncoder().encode(SOURCE_XML).length,
        "source size fingerprint mismatch");
    assert(source.fingerprint.lastModified === 123456,
        "source timestamp fingerprint mismatch");
    const sourceBytes = source.getSourceBytes();
    assert(
        new TextDecoder().decode(sourceBytes) === SOURCE_XML,
        "immutable source bytes mismatch"
    );
    sourceBytes[0] = 0;
    assert(
        new TextDecoder().decode(source.getSourceBytes()) === SOURCE_XML,
        "source bytes leaked a mutable reference"
    );
    assert(source.tracks.length === 1, "Track mapping mismatch");
    assert(source.tracks[0].segments.length === 2, "Segment mapping mismatch");
    assert(source.tracks[0].segments[0].points.length === 3,
        "first Segment point mapping mismatch");
    assert(source.tracks[0].segments[1].points.length === 2,
        "second Segment point mapping mismatch");
    assert(source.tracks[0].segments[0].points[1].latitude === 35.1,
        "mapped latitude mismatch");
    assert(source.waypointCount === 1, "Waypoint count mismatch");
    assert(source.routeCount === 1, "route count mismatch");
    assert(source.rootVersion === "1.1", "GPX version lost");
    assert(Object.isFrozen(source), "source object is mutable");
    assert(Object.isFrozen(source.fingerprint), "fingerprint is mutable");
    assert(Object.isFrozen(source.tracks[0].segments[0].points),
        "point mapping array is mutable");
    const firstClone = source.cloneDocument();
    const secondClone = source.cloneDocument();
    directChildren(
        directChildren(directChildren(firstClone.documentElement, "trk")[0], "trkseg")[0],
        "trkpt"
    )[0].remove();
    assert(
        directChildren(
            directChildren(
                directChildren(secondClone.documentElement, "trk")[0],
                "trkseg"
            )[0],
            "trkpt"
        ).length === 3,
        "source DOM clone leaked mutation"
    );
    assert(handle.reads === 1, "source was read more than once");
    assert(typeof handle.createWritable === "undefined", "test handle exposed write API");

    return source;
}

function testSession(source) {
    const session = new GPXEditingSession(source);
    const sourceMasks = session.getRetainedPointMasks();

    assert(sourceMasks[0][0].every(Boolean), "source mask did not retain all points");
    assert(!session.isDirty, "new session is dirty");
    assert(!session.canUndo && !session.canRedo, "new session has history");

    const edited = session.getRetainedPointMasks();
    edited[0][0][1] = false;

    assert(session.applyRetainedPointMasks(edited, "simplify"),
        "Apply did not change working state");
    assert(session.isDirty, "Apply did not mark session dirty");
    assert(session.historyLength === 1 && session.canUndo,
        "Apply was not recorded");
    assert(!session.applyRetainedPointMasks(edited, "preview"),
        "unchanged preview was added to history");
    assert(session.historyLength === 1, "unchanged state changed history");
    assert(source.xmlText.includes("do-not-transfer"), "source XML was mutated");

    assert(session.undo(), "Undo failed");
    assert(!session.isDirty, "Undo to source remained dirty");
    assert(session.canRedo, "Redo unavailable after Undo");
    assert(session.getRetainedPointMasks()[0][0][1], "Undo mask mismatch");
    assert(session.redo(), "Redo failed");
    assert(!session.getRetainedPointMasks()[0][0][1], "Redo mask mismatch");

    assert(EDITING_HISTORY_LIMIT === 20, "default history limit changed");
    const limitedHistory = new EditingCommandHistory(2);
    const compactSession = new GPXEditingSession(source, {
        history: limitedHistory
    });
    const first = compactSession.getRetainedPointMasks();
    first[0][0][0] = false;
    compactSession.applyRetainedPointMasks(first, "one");
    const second = compactSession.getRetainedPointMasks();
    second[0][0][1] = false;
    compactSession.applyRetainedPointMasks(second, "two");
    const third = compactSession.getRetainedPointMasks();
    third[0][0][2] = false;
    compactSession.applyRetainedPointMasks(third, "three");
    assert(compactSession.historyLength === 2, "history limit not enforced");
    compactSession.undo();
    const branch = compactSession.getRetainedPointMasks();
    branch[0][1][0] = false;
    compactSession.applyRetainedPointMasks(branch, "branch");
    assert(!compactSession.canRedo, "new command did not truncate Redo branch");

    const serializationMasks = session.getRetainedPointMasks();
    session.cancel();
    assert(!session.isActive, "Cancel left session active");
    assert(!session.isDirty && session.historyLength === 0,
        "Cancel retained working state or history");
    assert(session.getRetainedPointMasks()[0][0].every(Boolean),
        "Cancel did not restore source mask");
    let inactiveRejected = false;
    try {
        session.applyRetainedPointMasks(serializationMasks);
    } catch {
        inactiveRejected = true;
    }
    assert(inactiveRejected, "cancelled session accepted a command");

    return serializationMasks;
}

function testSerializer(source, masks) {
    const serialized = new GPXEditingSerializer().serialize(source, masks);
    const document = new DOMParser().parseFromString(
        serialized,
        "application/xml"
    );
    const root = document.documentElement;
    const track = directChildren(root, "trk")[0];
    const segments = directChildren(track, "trkseg");
    const firstPoints = directChildren(segments[0], "trkpt");

    assert(serialized.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"),
        "UTF-8 declaration missing");
    assert(!serialized.startsWith("\uFEFF"), "serializer added BOM");
    assert(!serialized.includes("\r"), "serializer did not normalize LF");
    assert(serialized.endsWith("\n") && !serialized.endsWith("\n\n"),
        "serializer final newline is not deterministic");
    assert(segments.length === 2, "Segment boundary changed");
    assert(firstPoints.length === 2, "removed point remained serialized");
    assert(directChildren(segments[1], "trkpt").length === 2,
        "unmodified Segment changed");
    assert(firstPoints[0].getAttributeNS("urn:trailbook:test", "id") === "p1",
        "retained point attributes changed");
    assert(firstPoints[0].getElementsByTagNameNS("*", "ele")[0].textContent === "10",
        "retained elevation changed");
    assert(firstPoints[0].getElementsByTagNameNS("*", "time")[0].textContent ===
        "2026-08-08T00:00:00Z", "retained time changed");
    assert(serialized.includes("keep-1") && serialized.includes("keep-3"),
        "retained point extensions changed");
    assert(!serialized.includes("do-not-transfer") && !serialized.includes(">remove<"),
        "removed point attributes were retained or transferred");
    assert(directChildren(root, "wpt").length === 1, "Waypoint changed");
    assert(directChildren(root, "rte").length === 1, "route changed");
    assert(serialized.includes("<tb:meta>keep</tb:meta>"), "metadata extension lost");
    assert(serialized.includes("<tb:track>keep</tb:track>"), "Track extension lost");
    assert(serialized.includes("<tb:segment>keep</tb:segment>"),
        "Segment extension lost");
    assert(serialized.includes("<tb:root>keep</tb:root>"), "root extension lost");
    assert(source.xmlText.includes("tb:id=\"p2\""), "source XML changed after serialization");
}

async function testBlockedSources() {
    const lossyXml = SOURCE_XML.replace("Source", "Broken \uFFFD Source");
    const lossy = await new GPXEditingSourceLoader().load(
        createHandle(lossyXml),
        "lossy.gpx"
    );

    assert(!lossy.canSerialize, "lossy source was save-capable");
    assert(lossy.saveBlockReasons.includes(
        GPX_EDITING_SOURCE_BLOCK_REASONS.LOSSY_DECODE
    ), "lossy source reason missing");

    const mismatchXml = SOURCE_XML.replace(
        'lat="35.1" lon="135.1"',
        'lat="invalid" lon="135.1"'
    );
    const mismatch = await new GPXEditingSourceLoader().load(
        createHandle(mismatchXml),
        "mismatch.gpx"
    );

    assert(!mismatch.canSerialize, "DOM / Parser mismatch was save-capable");
    assert(mismatch.saveBlockReasons.includes(
        GPX_EDITING_SOURCE_BLOCK_REASONS.DOM_MAPPING_MISMATCH
    ), "mapping mismatch reason missing");

    let blocked = false;
    try {
        new GPXEditingSerializer().serialize(
            mismatch,
            new GPXEditingSession(mismatch).getRetainedPointMasks()
        );
    } catch (error) {
        blocked = error.code === "SOURCE_NOT_SERIALIZABLE";
    }
    assert(blocked, "serializer accepted a blocked source");
}

async function run() {
    const source = await testSourceMapping();
    const masks = testSession(source);
    testSerializer(source, masks);
    await testBlockedSources();
    output.textContent = `PASS: ${assertions} assertions`;
}

run().catch(error => {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
});
