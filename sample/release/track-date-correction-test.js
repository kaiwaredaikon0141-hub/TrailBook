import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import GPXEditingSerializer from "../../src/js/services/GPXEditingSerializer.js";
import GPXParser from "../../src/js/services/GPXParser.js";
import TrackDateCorrectionService from "../../src/js/services/TrackDateCorrectionService.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

const SOURCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
 <metadata><time>2026-08-08T15:00:00Z</time></metadata>
 <trk><name>Date Test</name>
  <trkseg>
   <trkpt lat="35" lon="135"><time>2026-08-08T15:30:00Z</time></trkpt>
   <trkpt lat="35.001" lon="135.001"><ele>10</ele></trkpt>
   <trkpt lat="35.002" lon="135.002"><time>invalid</time></trkpt>
  </trkseg>
  <trkseg>
   <trkpt lat="35.003" lon="135.003"><time>2026-08-09T16:30:00Z</time></trkpt>
  </trkseg>
 </trk>
</gpx>
`;

function createSource(xmlText = SOURCE_XML) {
    const document = new DOMParser().parseFromString(xmlText, "application/xml");
    const tracks = [...document.querySelectorAll("trk")].map(
        (track, trackIndex) => ({
            trackIndex,
            segments: [...track.querySelectorAll(":scope > trkseg")].map(
                (segment, segmentIndex) => ({
                    trackIndex,
                    segmentIndex,
                    points: [...segment.querySelectorAll(":scope > trkpt")].map(point => ({
                        latitude: Number(point.getAttribute("lat")),
                        longitude: Number(point.getAttribute("lon"))
                    }))
                })
            )
        })
    );

    return {
        canSerialize: true,
        rootVersion: "1.1",
        namespaceURI: "http://www.topografix.com/GPX/1/1",
        waypointCount: 0,
        routeCount: 0,
        tracks,
        cloneDocument: () => document.cloneNode(true)
    };
}

function directChild(element, localName) {
    return [...(element?.children || [])].find(child => child.localName === localName);
}

function pointTimes(document) {
    return [...document.querySelectorAll("trkpt")].map(point =>
        directChild(point, "time")?.textContent ?? null
    );
}

function testShiftAndSerialization() {
    const source = createSource();
    const service = new TrackDateCorrectionService();
    const offset = service.calculateOffset(source, "2026-09-10");
    const first = service.getFirstTrackPointTime(source);
    const shiftedFirst = new Date(first.getTime() + offset);

    assert(
        shiftedFirst.getFullYear() === 2026 &&
        shiftedFirst.getMonth() === 8 && shiftedFirst.getDate() === 10,
        "first TrackPoint local date was not replaced"
    );
    assert(
        shiftedFirst.getHours() === first.getHours() &&
        shiftedFirst.getMinutes() === first.getMinutes() &&
        shiftedFirst.getSeconds() === first.getSeconds(),
        "first TrackPoint local time component changed"
    );

    const session = new GPXEditingSession(source);
    assert(session.applyDateOffset(offset), "date correction was not applied");
    assert(session.isDirty && session.canUndo, "date command was not recorded");

    const serialized = new GPXEditingSerializer().serialize(
        source,
        session.getRetainedPointMasks(),
        { timeOffsetMs: session.getTimeOffsetMs() }
    );
    const document = new DOMParser().parseFromString(serialized, "application/xml");
    const times = pointTimes(document);
    const firstOutput = new Date(times[0]);
    const lastOutput = new Date(times[3]);
    const sourceDuration = new Date("2026-08-09T16:30:00Z") -
        new Date("2026-08-08T15:30:00Z");

    assert(lastOutput - firstOutput === sourceDuration,
        "point interval or day crossing changed");
    assert(times[1] === null, "missing TrackPoint time was created");
    assert(times[2] === "invalid", "invalid TrackPoint time was changed");
    assert(times[0].endsWith("Z") && !times[0].includes(".000Z"),
        "existing timezone or precision representation changed");
    assert(document.querySelectorAll("trkseg").length === 2,
        "TrackSegment boundary changed");
    assert(
        new Date(document.querySelector("metadata > time").textContent).getTime() ===
        new Date("2026-08-08T15:00:00Z").getTime() + offset,
        "existing metadata time did not use the TrackPoint offset"
    );

    const parserResult = new GPXParser().parse(serialized, "date-test.gpx");
    const summary = new TrackSummaryBuilder().build(
        "date-test.gpx",
        { name: "date-test.gpx", size: serialized.length, lastModified: 0 },
        parserResult
    );
    assert(
        summary.resolvedDate.getTime() ===
        new Date("2026-08-08T15:00:00Z").getTime() + offset,
        "Discovery summary did not use the corrected date"
    );

    assert(session.undo(), "date correction Undo failed");
    assert(session.getTimeOffsetMs() === 0 && !session.isDirty,
        "Undo did not restore source time state");
    assert(session.redo(), "date correction Redo failed");
    assert(session.getTimeOffsetMs() === offset,
        "Redo did not restore date offset");

    const masks = session.getRetainedPointMasks();
    masks[0][0][1] = false;
    assert(session.applyRetainedPointMasks(masks, "simplify"),
        "simplification could not follow date correction");
    assert(session.getTimeOffsetMs() === offset &&
        !session.getRetainedPointMasks()[0][0][1],
        "date correction and simplification did not coexist");
    session.undo();
    assert(session.getTimeOffsetMs() === offset &&
        session.getRetainedPointMasks()[0][0][1],
        "combined history did not undo only the latest command");
}

function testMissingMetadataAndTimes() {
    const noMetadata = createSource(SOURCE_XML.replace(
        "<metadata><time>2026-08-08T15:00:00Z</time></metadata>",
        ""
    ));
    const service = new TrackDateCorrectionService();
    const offset = service.calculateOffset(noMetadata, "2026-09-10");
    const document = noMetadata.cloneDocument();

    service.apply(document, offset);
    assert(document.querySelector("metadata") === null,
        "missing metadata/time was created");

    const noValidTime = createSource(SOURCE_XML
        .replace("2026-08-08T15:30:00Z", "invalid-first")
        .replace("2026-08-09T16:30:00Z", "invalid-last"));
    let rejected = false;

    try {
        service.calculateOffset(noValidTime, "2026-09-10");
    } catch (error) {
        rejected = error.code === "TRACK_TIME_UNAVAILABLE";
    }
    assert(rejected, "GPX without a valid TrackPoint time was accepted");
}

try {
    testShiftAndSerialization();
    testMissingMetadataAndTimes();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.stack || error}`;
}
