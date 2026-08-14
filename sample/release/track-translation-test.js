import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import GPXEditingSerializer from "../../src/js/services/GPXEditingSerializer.js";
import TrackTranslationService from "../../src/js/services/TrackTranslationService.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function children(element, localName) {
    return Array.from(element?.children || []).filter(
        child => child.localName === localName
    );
}

function createSource() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <metadata><time>2026-08-15T00:00:00Z</time></metadata>
  <wpt lat="34" lon="134"><name>W</name></wpt>
  <rte><rtept lat="34.5" lon="134.5"/></rte>
  <trk><name>T</name><trkseg>
    <trkpt lat="35.0000000" lon="135.0000000"><ele>10</ele><time>2026-08-15T00:00:00Z</time><extensions><x xmlns="urn:test">keep</x></extensions></trkpt>
    <trkpt lat="35.0010000" lon="135.0010000"><ele>20</ele><time>2026-08-15T00:01:00Z</time></trkpt>
  </trkseg><trkseg><trkpt lat="36.0000000" lon="136.0000000"/></trkseg></trk>
</gpx>`;
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const tracks = children(document.documentElement, "trk").map(track => ({
        segments: children(track, "trkseg").map(segment => ({
            points: children(segment, "trkpt").map(point => ({
                latitude: Number(point.getAttribute("lat")),
                longitude: Number(point.getAttribute("lon"))
            }))
        }))
    }));

    return Object.freeze({
        canSerialize: true,
        sourceFileName: "source.gpx",
        rootVersion: "1.1",
        namespaceURI: "http://www.topografix.com/GPX/1/1",
        waypointCount: 1,
        routeCount: 1,
        tracks,
        cloneDocument: () => document.cloneNode(true)
    });
}

function translatedDocument(source, translation, masks = [[[true, true], [true]]]) {
    const xml = new GPXEditingSerializer().serialize(source, masks, {
        translation
    });
    return new DOMParser().parseFromString(xml, "application/xml");
}

function run() {
    const service = new TrackTranslationService();
    const source = createSource();
    const translation = service.normalize({
        latitudeDelta: 0.25,
        longitudeDelta: -0.5,
        northMeters: 27830,
        eastMeters: -45594
    });
    const session = new GPXEditingSession(source);

    assert(!session.setTranslationPreview(session.getTranslation()),
        "zero translation became applicable");
    assert(session.setTranslationPreview(translation), "translation preview rejected");
    assert(session.applyPreview(), "translation Apply failed");
    assert(session.canUndo, "translation was not added to history");
    assert(session.undo(), "translation Undo failed");
    assert(service.isZero(session.getTranslation()), "Undo did not restore position");
    assert(session.redo(), "translation Redo failed");
    assert(session.getTranslation().latitudeDelta === 0.25,
        "Redo did not restore translation");

    const document = translatedDocument(source, translation);
    const root = document.documentElement;
    const track = children(root, "trk")[0];
    const segments = children(track, "trkseg");
    const points = segments.flatMap(segment => children(segment, "trkpt"));

    assert(segments.length === 2, "Segment structure changed");
    assert(points[0].getAttribute("lat") === "35.2500000",
        "latitude was not translated");
    assert(points[0].getAttribute("lon") === "134.5000000",
        "longitude was not translated");
    assert(points[1].querySelector("time").textContent === "2026-08-15T00:01:00Z",
        "Track Point time changed");
    assert(points[0].querySelector("ele").textContent === "10",
        "elevation changed");
    assert(points[0].querySelector("extensions"), "extensions changed");
    assert(children(root, "wpt")[0].getAttribute("lat") === "34",
        "Waypoint was translated");
    assert(children(root, "rte")[0].querySelector("rtept").getAttribute("lat") === "34.5",
        "Route Point was translated");

    const distanceBefore = Math.hypot(0.001, 0.001);
    const distanceAfter = Math.hypot(
        Number(points[1].getAttribute("lat")) - Number(points[0].getAttribute("lat")),
        Number(points[1].getAttribute("lon")) - Number(points[0].getAttribute("lon"))
    );
    assert(Math.abs(distanceBefore - distanceAfter) < 1e-10,
        "Track shape changed");

    session.cancel();
    assert(service.isZero(session.getTranslation()), "Cancel retained translation");

    const map = {
        getCenter: () => ({ lat: 35, lng: 135 }),
        getZoom: () => 10,
        project: value => ({ x: value.lng * 100, y: -value.lat * 100 }),
        unproject: value => ({ lat: -value.y / 100, lng: value.x / 100 })
    };
    const drag = service.calculateFromDrag(
        map,
        { x: 10, y: 10 },
        { x: 110, y: -40 }
    );

    assert(drag.latitudeDelta === 0.5 && drag.longitudeDelta === 1,
        "project/unproject drag offset mismatch");

    const combined = new GPXEditingSession(source);

    combined.applyRetainedPointMasks([[[true, false], [true]]], "simplify");
    combined.applyDateOffset(24 * 60 * 60 * 1000, "2026_08_16.gpx");
    combined.setTranslationPreview(translation);
    combined.applyPreview();
    const combinedXml = new GPXEditingSerializer().serialize(
        source,
        combined.getRetainedPointMasks(),
        {
            timeOffsetMs: combined.getTimeOffsetMs(),
            trackNameFileName: combined.getDesiredFileName(),
            translation: combined.getTranslation()
        }
    );

    assert(combinedXml.includes("2026-08-16T00:00:00Z"),
        "date correction was lost when translating");
    assert(combinedXml.includes("<name>2026_08_16</name>"),
        "filename Track name synchronization was lost");
    assert(new DOMParser().parseFromString(combinedXml, "application/xml")
        .querySelectorAll("trkpt").length === 2,
    "simplification mask was lost when translating");
    assert(combinedXml.includes('lat="35.2500000"'),
        "combined serializer lost Track translation");

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    run();
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
