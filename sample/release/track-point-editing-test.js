import EditingPreviewLayerManager from "../../src/js/map/EditingPreviewLayerManager.js";
import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import GPXEditingSerializer from "../../src/js/services/GPXEditingSerializer.js";
import TrackPointEditingService from "../../src/js/services/TrackPointEditingService.js";
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

function createSource(pointCount = 4) {
    const points = Array.from({ length: pointCount }, (_, index) => `
      <trkpt lat="${(35 + index * 0.001).toFixed(7)}"
        lon="${(135 + index * 0.001).toFixed(7)}" data-id="${index}">
        <ele>${10 + index}</ele>
        <time>2026-08-22T00:${String(index).padStart(2, "0")}:00Z</time>
        <extensions><x xmlns="urn:test">${index}</x></extensions>
      </trkpt>`).join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <metadata><time>2026-08-22T00:00:00Z</time></metadata>
  <wpt lat="34" lon="134"/><rte><rtept lat="34.5" lon="134.5"/></rte>
  <trk><name>Point Edit</name><trkseg>${points}
  </trkseg></trk>
</gpx>`;
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const tracks = children(document.documentElement, "trk").map(
        (track, trackIndex) => ({
            trackIndex,
            segments: children(track, "trkseg").map(
                (segment, segmentIndex) => ({
                    trackIndex,
                    segmentIndex,
                    points: children(segment, "trkpt").map(point => ({
                        latitude: Number(point.getAttribute("lat")),
                        longitude: Number(point.getAttribute("lon"))
                    }))
                })
            )
        })
    );

    return Object.freeze({
        canSerialize: true,
        sourceFileName: "point-edit.gpx",
        rootVersion: "1.1",
        namespaceURI: "http://www.topografix.com/GPX/1/1",
        waypointCount: 1,
        routeCount: 1,
        tracks,
        cloneDocument: () => document.cloneNode(true)
    });
}

function parseTrackPoints(xml) {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return {
        document,
        points: [...document.querySelectorAll("trkpt")]
    };
}

function testSessionAndSerializer() {
    const source = createSource();
    const service = new TrackPointEditingService();
    const session = new GPXEditingSession(source);
    const identity = { trackIndex: 0, segmentIndex: 0, pointIndex: 1 };
    const original = { ...source.tracks[0].segments[0].points[1] };
    const moved = { latitude: 35.25, longitude: 135.5 };

    assert(service.key(identity) === "0/0/1", "source point identity changed");
    assert(session.applyPointEdit(identity, moved), "point drag was not applied");
    assert(session.historyLength === 1, "one drag did not create one command");
    assert(source.tracks[0].segments[0].points[1].latitude === original.latitude,
        "source geometry was mutated");
    assert(session.getPointEdits()[0].latitude === moved.latitude,
        "working point coordinate missing");
    assert(!session.applyPointEdit(identity, moved),
        "no-op point drag created a command");
    assert(session.historyLength === 1, "no-op changed history length");
    assert(session.undo(), "point move Undo failed");
    assert(session.getPointEdits().length === 0, "Undo retained point edit");
    assert(session.redo(), "point move Redo failed");
    assert(session.getPointEdits()[0].longitude === moved.longitude,
        "Redo did not restore point edit");

    const secondIdentity = { trackIndex: 0, segmentIndex: 0, pointIndex: 2 };

    assert(session.applyPointEdit(secondIdentity, {
        latitude: 35.3,
        longitude: 135.6
    }), "second point edit failed");
    assert(session.getPointEdits().length === 2,
        "point identity collision replaced another point");

    const serializer = new GPXEditingSerializer();
    const serialized = serializer.serialize(
        source,
        session.getRetainedPointMasks(),
        { pointEdits: session.getPointEdits() }
    );
    const { document, points } = parseTrackPoints(serialized);

    assert(points[0].getAttribute("lat") === "35.0000000",
        "unselected Track Point latitude changed");
    assert(points[1].getAttribute("lat") === "35.2500000" &&
        points[1].getAttribute("lon") === "135.5000000",
    "serializer did not update selected trkpt lat/lon");
    assert(points[1].querySelector("ele").textContent === "11",
        "point edit changed elevation");
    assert(points[1].querySelector("time").textContent ===
        "2026-08-22T00:01:00Z", "point edit changed time");
    assert(points[1].querySelector("extensions x").textContent === "1",
        "point edit changed extensions");
    assert(document.querySelector("wpt").getAttribute("lat") === "34" &&
        document.querySelector("rtept").getAttribute("lat") === "34.5",
    "point edit changed Waypoint or Route Point");

    const masks = session.getRetainedPointMasks();
    masks[0][0][1] = false;
    const simplified = serializer.serialize(source, masks, {
        pointEdits: session.getPointEdits()
    });

    assert(!simplified.includes('data-id="1"'),
        "simplification-excluded edited point was serialized");
    assert(parseTrackPoints(simplified).points.length === 3,
        "simplification point count changed");

    const translation = new TrackTranslationService().normalize({
        latitudeDelta: 0.1,
        longitudeDelta: -0.2
    });
    const combined = serializer.serialize(
        source,
        session.getRetainedPointMasks(),
        { pointEdits: session.getPointEdits(), translation }
    );
    const combinedPoints = parseTrackPoints(combined).points;

    assert(combinedPoints[1].getAttribute("lat") === "35.3500000" &&
        combinedPoints[1].getAttribute("lon") === "135.3000000",
    "point edit and Track translation composition order changed");

    const ordered = new GPXEditingSession(source);

    ordered.applyPointEdit(identity, moved);
    ordered.setTranslationPreview(translation);
    ordered.applyPreview();
    assert(ordered.historyLength === 2,
        "point and translation commands did not share one history");
    assert(ordered.undo() && ordered.getPointEdits().length === 1 &&
        new TrackTranslationService().isZero(ordered.getTranslation()),
    "Undo order did not remove translation before point edit");
    assert(ordered.undo() && ordered.getPointEdits().length === 0,
        "second Undo did not remove point edit");
    assert(ordered.redo() && ordered.getPointEdits().length === 1,
        "Redo order did not restore point edit first");
    assert(ordered.redo() && ordered.getTranslation().latitudeDelta === 0.1,
        "Redo order did not restore translation second");

    const composed = new GPXEditingSession(source);
    const composedMasks = composed.getRetainedPointMasks();

    composed.applyPointEdit(identity, moved);
    composedMasks[0][0][3] = false;
    composed.applyRetainedPointMasks(composedMasks, "simplify");
    composed.applyDateOffset(24 * 60 * 60 * 1000, "2026_08_23.gpx");
    assert(composed.getPointEdits().length === 1 &&
        !composed.getRetainedPointMasks()[0][0][3] &&
        composed.getDesiredFileName() === "2026_08_23.gpx",
    "simplification/date/filename command lost point edit state");

    session.cancel();
    assert(session.getPointEdits().length === 0,
        "Cancel retained point edits");
}

function createLeafletFakes() {
    const layers = [];
    const displayed = new Set();
    const panes = new Map();
    let draggingEnabled = true;
    const map = {
        getPane: name => panes.get(name) || null,
        createPane(name) {
            const pane = { style: {} };
            panes.set(name, pane);
            return pane;
        },
        hasLayer: layer => displayed.has(layer),
        getZoom: () => 10,
        getCenter: () => ({ lat: 35, lng: 135 }),
        project: value => ({
            x: Number(value.lng ?? value.longitude) * 100,
            y: -Number(value.lat ?? value.latitude) * 100
        }),
        unproject: value => ({ lat: -value.y / 100, lng: value.x / 100 }),
        mouseEventToContainerPoint: event => ({
            x: event.clientX,
            y: event.clientY
        }),
        dragging: {
            enabled: () => draggingEnabled,
            disable: () => { draggingEnabled = false; },
            enable: () => { draggingEnabled = true; }
        }
    };

    globalThis.L = {
        canvas: options => ({ kind: "canvas", options }),
        layerGroup() {
            return {
                layers: [],
                addTo() { displayed.add(this); return this; },
                remove() { displayed.delete(this); }
            };
        },
        polyline(latLngs, options) {
            const layer = {
                type: "line",
                latLngs,
                options,
                handlers: {},
                on(name, handler) { this.handlers[name] = handler; return this; },
                setLatLngs(value) { this.latLngs = value; this.updates = (this.updates || 0) + 1; },
                addTo(group) { group.layers.push(this); return this; }
            };
            layers.push(layer);
            return layer;
        },
        circleMarker(latLng, options) {
            const layer = {
                type: "point",
                latLng,
                options,
                handlers: {},
                on(name, handler) { this.handlers[name] = handler; return this; },
                setLatLng(value) { this.latLng = value; },
                addTo(target) {
                    if (target.layers) target.layers.push(this);
                    else displayed.add(this);
                    return this;
                },
                remove() { displayed.delete(this); this.removed = true; }
            };
            layers.push(layer);
            return layer;
        }
    };

    return { map, layers, displayed, panes, isDragging: () => draggingEnabled };
}

function testPreviewAndDrag() {
    const { map, layers, displayed, panes, isDragging } = createLeafletFakes();
    const source = createSource();
    const manager = new EditingPreviewLayerManager(map);
    const masks = [[[true, true, true, true]]];
    let selected = null;
    let committed = null;
    let editCalls = 0;

    manager.setPointSelectionHandler(value => { selected = value; });
    manager.setPointEditHandler((identity, coordinate) => {
        editCalls += 1;
        committed = { identity, coordinate };
        manager.setCandidate(source, masks, manager.translation, [{
            ...identity,
            ...new TrackPointEditingService().toSourceCoordinate(
                coordinate,
                manager.translation
            )
        }]);
        return true;
    });
    manager.setSource(source);
    manager.setCandidate(source, masks);
    manager.setMode("before");
    assert(displayed.size === 1, "Before preview mode changed");
    manager.setMode("after");
    assert(displayed.size === 1, "After preview mode changed");
    manager.setMode("both");
    assert(displayed.size === 2, "Both preview mode changed");
    manager.setPointMode("off");
    assert(manager.setPointEditingMode(true), "point editing mode rejected");
    assert(manager.pointMode === "off",
        "point editing changed the simplification point preview value");
    assert(panes.get("trailbook-edit-point-targets").style.pointerEvents === "auto",
        "point hit target pane is not interactive");
    const targets = layers.filter(layer =>
        layer.type === "point" &&
        layer.options.pane === "trailbook-edit-point-targets"
    );

    assert(targets.length === 4, "retained point hit targets missing");
    assert(targets.every(target => target.options.renderer.kind === "canvas"),
        "point hit targets do not share Canvas renderer");
    assert(targets.every(target => target.options.fillOpacity >= 0.7),
        "point editing did not automatically show editable points");
    manager.setPointMode("before");
    assert(manager.pointEditingMode,
        "simplification point preview changed point editing state");
    manager.setPointMode("off");
    targets[1].handlers.mousedown({
        originalEvent: {
            clientX: 10,
            clientY: 10,
            preventDefault() {},
            stopPropagation() {}
        }
    });
    assert(selected?.pointIndex === 1, "Track Point was not selected");
    assert(!isDragging(), "Map pan remained active during point drag");
    document.dispatchEvent(new MouseEvent("mousemove", {
        clientX: 20,
        clientY: 5
    }));
    const updatedLines = layers.filter(layer => layer.type === "line" && layer.updates);
    assert(updatedLines.length === 1 && updatedLines[0].updates === 1,
        "drag rebuilt geometry instead of updating one segment");
    document.dispatchEvent(new MouseEvent("mouseup"));
    assert(isDragging(), "Map pan did not recover after point drag");
    assert(committed?.identity.pointIndex === 1,
        "drag end did not commit selected point identity");
    assert(Math.abs(committed.coordinate.latitude - 35.051) < 1e-9 &&
        Math.abs(committed.coordinate.longitude - 135.101) < 1e-9,
    "point drag did not use project/unproject");
    const latestAfter = layers.findLast(layer =>
        layer.type === "line" && layer.options.color === "#f97316"
    );
    const latestBefore = layers.findLast(layer =>
        layer.type === "line" && layer.options.dashArray === "8 6"
    );
    assert(Math.abs(latestAfter.latLngs[1][0] - 35.051) < 1e-9,
        "After preview did not retain the point edit");
    assert(latestBefore.latLngs[1][0] === 35.001,
        "Before preview was changed by point editing");

    targets[2].handlers.mousedown({
        originalEvent: {
            clientX: 0,
            clientY: 0,
            preventDefault() {},
            stopPropagation() {}
        }
    });
    document.dispatchEvent(new MouseEvent("mouseup"));
    assert(selected?.pointIndex === 2, "selection did not switch to another point");
    assert(editCalls === 1, "no-op drag emitted a point edit command");
    manager.clearPointSelection();
    assert(selected === null, "point selection clear failed");
    manager.setPointEditingMode(false);
    assert(panes.get("trailbook-edit-point-targets").style.pointerEvents === "none",
        "point edit mode OFF left hit testing enabled");
    assert(manager.pointMode === "off",
        "point editing OFF changed the simplification point preview value");
    assert(isDragging(), "point edit mode OFF changed normal Map pan");
    manager.clear();
}

function testLargeTrackTargets() {
    const { map, layers } = createLeafletFakes();
    const source = createSource(3050);
    const masks = [[Array(3050).fill(true)]];
    const manager = new EditingPreviewLayerManager(map);
    const started = performance.now();

    manager.setSource(source);
    manager.setCandidate(source, masks);
    manager.setPointEditingMode(true);
    const elapsed = performance.now() - started;
    const targets = layers.filter(layer =>
        layer.type === "point" &&
        layer.options.pane === "trailbook-edit-point-targets"
    );

    assert(targets.length === 3050, "large Track point identities were dropped");
    assert(new Set(targets.map(target => target.options.renderer)).size === 1,
        "large Track created per-point renderers");
    assert(elapsed < 2000, "3000-point editing setup regressed severely");
    manager.clear();
}

try {
    testSessionAndSerializer();
    testPreviewAndDrag();
    testLargeTrackTargets();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
