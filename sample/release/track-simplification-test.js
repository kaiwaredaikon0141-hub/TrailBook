import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import TrackSimplificationMetrics, {
    pathDistanceMeters,
    pointToSegmentDistanceMeters
} from "../../src/js/services/TrackSimplificationMetrics.js";
import TrackSimplificationService from "../../src/js/services/TrackSimplificationService.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function approximately(actual, expected, tolerance, message) {
    assert(Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

function point(latitude, longitude, attributes = {}) {
    return Object.freeze({ latitude, longitude, ...attributes });
}

function sourceFromTracks(tracks) {
    return Object.freeze({
        tracks: Object.freeze(tracks.map(track => Object.freeze({
            segments: Object.freeze(track.map(points => Object.freeze({
                points: Object.freeze([...points])
            })))
        })))
    });
}

async function rejects(callback, expectedCode, message) {
    try {
        await callback();
    } catch (error) {
        assert(!expectedCode || error.code === expectedCode, message);
        return;
    }

    assert(false, message);
}

async function testSegmentBoundariesAndOrdering() {
    const service = new TrackSimplificationService();
    const source = sourceFromTracks([[
        [],
        [point(35, 135)],
        [point(35, 135), point(35, 135.001)],
        [
            point(35, 135, { time: "start", elevation: 1 }),
            point(35, 135.001, { time: "middle", elevation: 2 }),
            point(35, 135.002, { time: "end", elevation: 3 })
        ]
    ]]);
    const preview = await service.createPreview(source, 5);

    assert(preview.retainedPointMasks[0][0].length === 0,
        "empty Segment changed shape");
    assert(preview.retainedPointMasks[0][1].join() === "true",
        "one-point Segment was removed");
    assert(preview.retainedPointMasks[0][2].join() === "true,true",
        "two-point Segment was simplified");
    assert(preview.retainedPointMasks[0][3].join() === "true,false,true",
        "straight Segment did not retain ordered endpoints only");
    assert(preview.metrics.sourcePointCount === 6,
        "Track total source count is incorrect");
    assert(preview.metrics.retainedPointCount === 5,
        "Track total retained count is incorrect");
    assert(preview.metrics.removedPointCount === 1,
        "Track total removed count is incorrect");
    approximately(preview.metrics.reductionRatio, 1 / 6, 1e-12,
        "Track total reduction ratio is incorrect");
    assert(source.tracks[0].segments[3].points[1].time === "middle",
        "retained-mask calculation mutated point attributes");
    assert(Object.isFrozen(preview.retainedPointMasks[0][3]),
        "preview mask is mutable");
}

async function testRdpToleranceAndMetrics() {
    const source = sourceFromTracks([[[
        point(0, 0),
        point(0.001, 0.001),
        point(0, 0.002)
    ]]]);
    const service = new TrackSimplificationService();
    const strict = await service.createPreview(source, 50);
    const relaxed = await service.createPreview(source, 150);

    assert(strict.retainedPointMasks[0][0].join() === "true,true,true",
        "RDP removed a point above tolerance");
    assert(relaxed.retainedPointMasks[0][0].join() === "true,false,true",
        "RDP retained a point below tolerance");
    assert(relaxed.metrics.sourcePointCount === 3,
        "source metric count is incorrect");
    assert(relaxed.metrics.retainedPointCount === 2,
        "retained metric count is incorrect");
    approximately(relaxed.metrics.reductionRatio, 1 / 3, 1e-12,
        "reduction ratio is incorrect");
    assert(relaxed.metrics.sourceDistanceMeters >
        relaxed.metrics.simplifiedDistanceMeters,
        "simplified distance should be shorter for the corner fixture");
    assert(relaxed.metrics.distanceDifferenceMeters < 0,
        "signed distance difference is not simplified minus source");
    approximately(
        relaxed.metrics.absoluteDistanceDifferenceMeters,
        Math.abs(relaxed.metrics.distanceDifferenceMeters),
        1e-9,
        "absolute distance difference is incorrect"
    );
    assert(relaxed.metrics.maxDeviationMeters > 110 &&
        relaxed.metrics.maxDeviationMeters < 112,
        "maximum shape deviation is not measured in meters");
    assert(relaxed.trackMetrics[0].segments[0].maxDeviationMeters ===
        relaxed.metrics.maxDeviationMeters,
        "Segment and Track max deviation disagree");
}

async function testMultipleTracksAndSegments() {
    const source = sourceFromTracks([
        [
            [point(0, 0), point(0, 0.001), point(0, 0.002)],
            [point(1, 1), point(1, 1.001), point(1, 1.002)]
        ],
        [[point(2, 2), point(2.001, 2.001), point(2, 2.002)]]
    ]);
    const preview = await new TrackSimplificationService()
        .createPreview(source, 150);

    assert(preview.retainedPointMasks.length === 2,
        "Track boundary was lost");
    assert(preview.retainedPointMasks[0].length === 2,
        "Segment boundary was lost");
    assert(preview.retainedPointMasks[0][0].join() === "true,false,true",
        "first Segment was not simplified independently");
    assert(preview.retainedPointMasks[0][1].join() === "true,false,true",
        "second Segment was not simplified independently");
    assert(preview.retainedPointMasks[1][0].join() === "true,false,true",
        "second Track was not aggregated independently");
    assert(preview.trackMetrics.length === 2,
        "per-Track metrics are missing");
    assert(preview.trackMetrics[0].segments.length === 2,
        "per-Segment metrics are missing");
    assert(preview.metrics.sourcePointCount === 9 &&
        preview.metrics.retainedPointCount === 6,
        "Track-wide aggregate count is incorrect");
}

async function testInvalidCoordinates() {
    const invalid = point(Number.NaN, 135, { extension: "preserve" });
    const source = sourceFromTracks([[[
        point(35, 135),
        point(35, 135.001),
        invalid,
        point(35, 135.002),
        point(35, 135.003)
    ]]]);
    const preview = await new TrackSimplificationService()
        .createPreview(source, 1000);

    assert(preview.retainedPointMasks[0][0].join() ===
        "true,true,true,true,true",
        "invalid coordinate was removed or bridged across");
    assert(preview.metrics.invalidPointCount === 1,
        "invalid coordinate metric is incorrect");
    assert(invalid.extension === "preserve",
        "invalid point attributes were mutated");
    assert(Number.isFinite(preview.metrics.sourceDistanceMeters),
        "invalid coordinate produced a non-finite distance");
}

async function testGeographicDistance() {
    const start = point(0, 179.9);
    const middle = point(0.01, 180);
    const end = point(0, -179.9);
    const deviation = pointToSegmentDistanceMeters(middle, start, end);
    const distance = pathDistanceMeters(
        [start, middle, end],
        [true, true, true]
    );

    assert(deviation > 1100 && deviation < 1120,
        "antimeridian deviation used a world-spanning longitude delta");
    assert(distance < 30000,
        "antimeridian path distance used a world-spanning longitude delta");

    const preview = await new TrackSimplificationService().createPreview(
        sourceFromTracks([[[start, middle, end]]]),
        1200
    );
    assert(preview.retainedPointMasks[0][0].join() === "true,false,true",
        "antimeridian fixture was not simplified in local meters");

    const highLatitudeDeviation = pointToSegmentDistanceMeters(
        point(80.001, 10.01),
        point(80, 10),
        point(80, 10.02)
    );
    assert(highLatitudeDeviation > 100 && highLatitudeDeviation < 125,
        "latitude-aware projection produced an unexpected deviation");
}

async function testPreviewAndHistory() {
    const source = sourceFromTracks([[[
        point(0, 0),
        point(0, 0.001),
        point(0, 0.002)
    ]]]);
    const service = new TrackSimplificationService();
    const session = new GPXEditingSession(source);
    const preview = await service.createPreview(source, 10);

    session.setPreview(preview);
    assert(session.hasPreview, "Session did not retain preview");
    assert(session.historyLength === 0,
        "preview-only tolerance result entered history");
    assert(session.getRetainedPointMasks()[0][0].join() === "true,true,true",
        "preview mutated working state");
    assert(session.applyPreview(), "changed preview was not applied");
    assert(!session.hasPreview, "applied preview was not cleared");
    assert(session.historyLength === 1 && session.canUndo,
        "Apply did not create one command");
    assert(session.getRetainedPointMasks()[0][0].join() === "true,false,true",
        "Apply did not copy retained mask to working state");
    assert(session.undo(), "simplification command could not be undone");
    assert(session.getRetainedPointMasks()[0][0].join() === "true,true,true",
        "Undo did not restore source mask");
    assert(session.redo(), "simplification command could not be redone");
    assert(session.getRetainedPointMasks()[0][0].join() === "true,false,true",
        "Redo did not restore simplified mask");

    session.setPreview(await service.createPreview(source, 20));
    assert(!session.applyPreview(),
        "same retained result created a redundant Apply command");
    assert(session.historyLength === 1,
        "same retained result increased history length");

    session.setPreview(await service.createPreview(source, 5));
    session.cancel();
    assert(!session.isActive && !session.hasPreview,
        "Cancel did not discard preview and deactivate session");
    assert(session.historyLength === 0,
        "Cancel did not clear history");
}

async function testValidationCancellationAndYielding() {
    const service = new TrackSimplificationService();
    const source = sourceFromTracks([[[point(0, 0), point(0, 0.001)]]]);

    await rejects(() => service.createPreview(source, 0), null,
        "zero tolerance was accepted");
    await rejects(() => service.createPreview(source, -1), null,
        "negative tolerance was accepted");
    await rejects(() => service.createPreview(source, Number.NaN), null,
        "non-finite tolerance was accepted");
    await rejects(() => service.createPreview(source, 1, {
        signal: { aborted: true }
    }), "SIMPLIFICATION_ABORTED", "aborted preview was not rejected");

    const largePoints = Array.from({ length: 200 }, (_, index) =>
        point(35 + (index % 2) * 0.0001, 135 + index * 0.00001)
    );
    let yields = 0;
    let progress = 0;
    const preview = await service.createPreview(
        sourceFromTracks([[largePoints]]),
        1,
        {
            yieldEvery: 16,
            yieldControl: async () => { yields += 1; },
            onProgress: value => { progress = value.processedSegments; }
        }
    );

    assert(yields > 0, "large preview never yielded control");
    assert(progress === 1, "Segment progress callback was not reported");
    assert(preview.metrics.sourcePointCount === 200,
        "large preview metrics lost points");
}

async function run() {
    await testSegmentBoundariesAndOrdering();
    await testRdpToleranceAndMetrics();
    await testMultipleTracksAndSegments();
    await testInvalidCoordinates();
    await testGeographicDistance();
    await testPreviewAndHistory();
    await testValidationCancellationAndYielding();

    output.textContent = `PASS: ${assertions} assertions`;
}

run().catch(error => {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
});
