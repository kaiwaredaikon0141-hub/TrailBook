import EditingPreviewLayerManager from "../../src/js/map/EditingPreviewLayerManager.js";
import GPXEditingSession from "../../src/js/models/GPXEditingSession.js";
import GPXEditingSerializer from "../../src/js/services/GPXEditingSerializer.js";
import TrackPointMutationService from "../../src/js/services/TrackPointMutationService.js";

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

function createSource(pointCount = 4, {
    relativePath = "mutation.gpx",
    latitudeBase = 35
} = {}) {
    const xmlPoints = Array.from({ length: pointCount }, (_, index) => `
      <trkpt lat="${(latitudeBase + index * 0.001).toFixed(7)}"
        lon="${(135 + index * 0.001).toFixed(7)}" data-id="${index}">
        <ele>${index}</ele><time>2026-08-22T00:0${index}:00Z</time>
        <extensions><x xmlns="urn:test">${index}</x></extensions>
      </trkpt>`).join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <wpt lat="34" lon="134"/><rte><rtept lat="34.5" lon="134.5"/></rte>
  <trk><name>Mutation</name><trkseg>${xmlPoints}</trkseg></trk>
</gpx>`;
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const segmentElement = document.querySelector("trkseg");
    const points = children(segmentElement, "trkpt").map(point => ({
        latitude: Number(point.getAttribute("lat")),
        longitude: Number(point.getAttribute("lon"))
    }));

    return Object.freeze({
        canSerialize: true,
        relativePath,
        sourceFileName: relativePath.split("/").at(-1),
        rootVersion: "1.1",
        namespaceURI: document.documentElement.namespaceURI,
        waypointCount: 1,
        routeCount: 1,
        tracks: [{ segments: [{ points }] }],
        cloneDocument: () => document.cloneNode(true)
    });
}

function parsePoints(xml) {
    const document = new DOMParser().parseFromString(xml, "application/xml");

    return { document, points: [...document.querySelectorAll("trkpt")] };
}

function testSessionAndSerialization() {
    const source = createSource();
    const session = new GPXEditingSession(source);
    const deleted = { trackIndex: 0, segmentIndex: 0, pointIndex: 1 };

    assert(session.deletePoint(deleted), "source point delete failed");
    assert(source.tracks[0].segments[0].points.length === 4,
        "source geometry was mutated by delete");
    assert(session.getDeletedPoints()[0].pointIndex === 1,
        "deleted source identity missing");
    assert(session.historyLength === 1, "delete was not one command");
    assert(session.undo() && session.getDeletedPoints().length === 0,
        "delete Undo failed");
    assert(session.redo() && session.getDeletedPoints().length === 1,
        "delete Redo failed");

    const added = session.addPoint({
        trackIndex: 0,
        segmentIndex: 0,
        insertionPosition: 1.5,
        latitude: 35.0015,
        longitude: 135.0015
    });

    assert(added.addedPointId === "added-1", "added point ID missing");
    assert(added.pointIndex === undefined, "added point faked a source index");
    assert(session.getAddedPoints()[0].insertionPosition === 1.5,
        "explicit insertion position missing");
    assert(session.applyPointEdit(added, {
        latitude: 35.0017,
        longitude: 135.0018
    }), "added point drag failed");
    assert(session.getAddedPoints()[0].latitude === 35.0017,
        "added point drag state missing");
    assert(session.historyLength === 3, "add/move history order changed");

    const orderedAdditions = new GPXEditingSession(source);

    orderedAdditions.addPoint({
        trackIndex: 0, segmentIndex: 0, insertionPosition: 1.75,
        latitude: 35.0017, longitude: 135.0017
    });
    orderedAdditions.addPoint({
        trackIndex: 0, segmentIndex: 0, insertionPosition: 1.25,
        latitude: 35.0012, longitude: 135.0012
    });
    assert(orderedAdditions.getAddedPoints().map(point =>
        point.insertionPosition).join() === "1.25,1.75",
    "multiple additions used command order instead of insertion order");
    assert(new Set(orderedAdditions.getAddedPoints().map(point =>
        point.addedPointId)).size === 2,
    "added point IDs are not session-unique");

    const sourceMove = { trackIndex: 0, segmentIndex: 0, pointIndex: 2 };

    assert(session.applyPointEdit(sourceMove, {
        latitude: 35.02,
        longitude: 135.02
    }), "source move composition failed");
    session.setTranslationPreview({
        latitudeDelta: 0.1,
        longitudeDelta: -0.2
    });
    assert(session.applyPreview(), "translation composition failed");
    assert(session.historyLength === 5, "mutation command ordering changed");
    assert(session.undo() && session.getTranslation().latitudeDelta === 0,
        "translation Undo did not occur first");
    assert(session.redo() && session.getTranslation().latitudeDelta === 0.1,
        "translation Redo failed");

    const serializer = new GPXEditingSerializer();
    const xml = serializer.serialize(source, session.getRetainedPointMasks(), {
        pointEdits: session.getPointEdits(),
        deletedPoints: session.getDeletedPoints(),
        addedPoints: session.getAddedPoints(),
        translation: session.getTranslation()
    });
    const { document, points } = parsePoints(xml);

    assert(points.length === 4, "delete/add serialized point count invalid");
    assert(!xml.includes('data-id="1"'), "deleted source point was serialized");
    assert(points[1].getAttribute("data-id") === null,
        "added point inherited source attributes");
    assert(points[1].children.length === 0,
        "added point generated ele/time/extensions");
    assert(points[1].getAttribute("lat") === "35.1017000" &&
        points[1].getAttribute("lon") === "134.8018000",
    "added point or translation serialization failed");
    assert(points[2].getAttribute("data-id") === "2" &&
        points[2].getAttribute("lat") === "35.1200000",
    "source move/add ordering changed");
    assert(points[2].querySelector("ele").textContent === "2" &&
        points[2].querySelector("time") && points[2].querySelector("extensions"),
    "source point attributes changed");
    assert(document.querySelector("wpt").getAttribute("lat") === "34" &&
        document.querySelector("rtept").getAttribute("lat") === "34.5",
    "Waypoint or Route Point changed");

    const simplifiedMasks = session.getRetainedPointMasks();

    simplifiedMasks[0][0][3] = false;
    const simplified = serializer.serialize(source, simplifiedMasks, {
        deletedPoints: session.getDeletedPoints(),
        addedPoints: session.getAddedPoints()
    });

    assert(parsePoints(simplified).points.length === 3,
        "added point entered simplification mask or delete lost priority");
    assert(simplified.includes('lat="35.0017000"'),
        "added point was removed by simplification");

    assert(session.deletePoint(added), "added point delete failed");
    assert(session.getAddedPoints().length === 0,
        "added point delete left draft state");
    assert(session.undo() && session.getAddedPoints().length === 1,
        "added point delete Undo failed");
    assert(session.redo() && session.getAddedPoints().length === 0,
        "added point delete Redo failed");

    session.cancel();
    assert(session.getAddedPoints().length === 0 &&
        session.getDeletedPoints().length === 0 &&
        session.getPointEdits().length === 0,
    "Cancel retained point mutation state");

    const twoPoint = new GPXEditingSession(createSource(2));

    assert(!twoPoint.canDeletePoint({
        trackIndex: 0,
        segmentIndex: 0,
        pointIndex: 0
    }), "two-point segment allowed deletion");
    assert(!twoPoint.deletePoint({
        trackIndex: 0,
        segmentIndex: 0,
        pointIndex: 0
    }), "unsafe point deletion was applied");
}

function createLeafletFakes() {
    const layers = [];
    const displayed = new Set();
    const panes = new Map();
    const mapHandlers = new Map();
    const container = document.createElement("div");

    document.body.append(container);
    let draggingEnabled = true;
    let viewportScale = 30000;
    let viewportOffsetX = 0;
    let viewportOffsetY = 0;
    const map = {
        _loaded: true,
        getContainer: () => container,
        on(names, handler) {
            names.split(/\s+/).forEach(name => mapHandlers.set(name, handler));
        },
        getPane: name => panes.get(name) || null,
        createPane(name) {
            const pane = { style: {} };
            panes.set(name, pane);
            return pane;
        },
        hasLayer: layer => displayed.has(layer),
        getCenter: () => ({ lat: 35, lng: 135 }),
        getSize: () => ({ x: 1200, y: 800 }),
        getZoom: () => 10,
        latLngToContainerPoint: value => ({
            x: (Number(value.lng ?? value.longitude) - 135) * viewportScale +
                200 + viewportOffsetX,
            y: -(Number(value.lat ?? value.latitude) - 35) * viewportScale +
                200 + viewportOffsetY
        }),
        containerPointToLatLng: value => ({
            lat: 35 - (value.y - 200) / 30000,
            lng: 135 + (value.x - 200) / 30000
        }),
        project: value => ({
            x: Number(value.lng ?? value.longitude) * 100 + 50000,
            y: -Number(value.lat ?? value.latitude) * 100 + 50000
        }),
        unproject: value => ({
            lat: -(value.y - 50000) / 100,
            lng: (value.x - 50000) / 100
        }),
        mouseEventToContainerPoint: event => ({ x: event.clientX, y: event.clientY }),
        dragging: {
            enabled: () => draggingEnabled,
            disable: () => { draggingEnabled = false; },
            enable: () => { draggingEnabled = true; }
        }
    };

    let leafletStamp = 0;
    const leafletIds = new WeakMap();

    globalThis.L = {
        stamp(value) {
            if (!leafletIds.has(value)) leafletIds.set(value, ++leafletStamp);
            return leafletIds.get(value);
        },
        latLng: (lat, lng) => ({ lat, lng }),
        canvas: options => ({ kind: "canvas", options }),
        layerGroup: () => ({
            layers: [],
            addTo(targetMap) {
                this._map = targetMap;
                this.layers.forEach(layer => { layer._map = targetMap; });
                displayed.add(this);
                return this;
            },
            remove() {
                this.layers.forEach(layer => { layer._map = null; });
                this._map = null;
                displayed.delete(this);
            }
        }),
        polyline(latLngs, options) {
            const layer = {
                type: "line", latLngs, options, handlers: {},
                on(name, handler) { this.handlers[name] = handler; return this; },
                setLatLngs(value) { this.latLngs = value; },
                getLatLngs() { return this.latLngs; },
                addTo(group) {
                    group.layers.push(this);
                    this._map = group._map || null;
                    return this;
                }
            };
            layers.push(layer);
            return layer;
        },
        circleMarker(latLng, options) {
            const layer = {
                type: "point", latLng, options, handlers: {},
                on(name, handler) { this.handlers[name] = handler; return this; },
                setLatLng(value) { this.latLng = value; },
                addTo(target) {
                    if (target.layers) {
                        target.layers.push(this);
                        this._map = target._map || null;
                    } else {
                        this._map = target;
                        displayed.add(this);
                    }
                    return this;
                },
                remove() { this._map = null; displayed.delete(this); }
            };
            layers.push(layer);
            return layer;
        }
    };

    return {
        map,
        layers,
        panes,
        displayed,
        container,
        mapHandlers,
        setViewport({ scale = 30000, x = 0, y = 0 } = {}) {
            viewportScale = scale;
            viewportOffsetX = x;
            viewportOffsetY = y;
        }
    };
}

function testHitDetectionAndPreview() {
    const service = new TrackPointMutationService();
    const screenVertices = [
        { identity: { trackIndex: 0, segmentIndex: 0, pointIndex: 0 },
            insertionPosition: 0,
            rawCoordinate: { latitude: 0, longitude: 0 },
            latLng: { lat: 0, lng: 0 },
            containerPoint: { x: 10, y: 20 } },
        { identity: { trackIndex: 0, segmentIndex: 0, pointIndex: 1 },
            insertionPosition: 1,
            rawCoordinate: { latitude: 0, longitude: 1 },
            latLng: { lat: 0, lng: 1 },
            containerPoint: { x: 110, y: 20 } }
    ];
    const near = service.findInsertion(
        { x: 60, y: 25 },
        screenVertices
    );

    assert(near && near.trackIndex === 0 && near.segmentIndex === 0,
        "nearest segment was not selected");
    assert(near.insertionPosition > 0 && near.insertionPosition < 1,
        "insertion order was not between edge endpoints");
    assert(near.nearestEdgeIndex === 0,
        "nearest After edge identity was not reported");
    assert(service.findInsertion({ x: 60, y: 50 }, screenVertices) === null,
        "far Map click added a point");
    assert(Math.abs(near.longitude - 0.5) < 1e-12,
        "normalized edge LatLng was not interpolated");
    assert(near.hitDistancePixels === 5,
        "container-point edge distance was not measured in screen pixels");
    assert(near.edgeStart.containerPoint === screenVertices[0].containerPoint &&
        near.edgeEnd.containerPoint === screenVertices[1].containerPoint,
    "nearest edge did not retain the shared screen endpoints");

    const longVertices = Array.from({ length: 101 }, (_, index) => ({
        identity: { trackIndex: 0, segmentIndex: 0, pointIndex: index },
        insertionPosition: index,
        rawCoordinate: { latitude: 35, longitude: 135 + index / 1000 },
        latLng: { lat: 35, lng: 135 + index / 1000 },
        containerPoint: { x: index * 10, y: 100 }
    }));
    let lastStats = null;
    const lastEdge = service.findInsertion(
        { x: 997, y: 102 },
        longVertices,
        {
            maxDistancePixels: Number.POSITIVE_INFINITY,
            onDiagnostics: value => { lastStats = value; }
        }
    );

    assert(lastEdge.nearestEdgeIndex === 99,
        "100-edge search remained fixed on edge 0");
    assert(lastStats.totalEdges === 100 &&
        lastStats.evaluatedEdges === 100 &&
        lastStats.finiteDistanceEdges === 100 &&
        lastStats.nanDistanceEdges === 0 &&
        lastStats.bestUpdateCount > 1,
    "100-edge search did not evaluate every finite edge");
    assert(service.findInsertion(
        { x: 506, y: 101 },
        longVertices,
        { maxDistancePixels: Number.POSITIVE_INFINITY }
    ).nearestEdgeIndex === 50,
    "middle edge was not selected");
    assert(service.findInsertion(
        { x: 3, y: 101 },
        longVertices,
        { maxDistancePixels: Number.POSITIVE_INFINITY }
    ).nearestEdgeIndex === 0,
    "edge 0 was not selected when genuinely nearest");

    const invalidVertices = [
        { ...longVertices[0], containerPoint: { x: Number.NaN, y: 100 } },
        longVertices[1],
        longVertices[2]
    ];
    let invalidStats = null;
    const afterInvalid = service.findInsertion(
        { x: 18, y: 100 },
        invalidVertices,
        {
            maxDistancePixels: Number.POSITIVE_INFINITY,
            onDiagnostics: value => { invalidStats = value; }
        }
    );

    assert(afterInvalid.nearestEdgeIndex === 1,
        "non-finite edge poisoned the nearest candidate");
    assert(invalidStats.evaluatedEdges === 2 &&
        invalidStats.finiteDistanceEdges === 1 &&
        invalidStats.nanDistanceEdges === 1,
    "non-finite edge diagnostics are incorrect");

    const {
        map: previewMap,
        layers,
        panes,
        container,
        mapHandlers,
        setViewport
    } = createLeafletFakes();
    const nativeAddEventListener = container.addEventListener.bind(container);
    const nativeRemoveEventListener = container.removeEventListener.bind(container);
    let nativeInteractionAdds = 0;
    let nativeInteractionRemoves = 0;

    container.addEventListener = (type, handler, options) => {
        if (["click", "contextmenu", "pointermove"].includes(type)) {
            nativeInteractionAdds += 1;
        }
        return nativeAddEventListener(type, handler, options);
    };
    container.removeEventListener = (type, handler, options) => {
        if (["click", "contextmenu", "pointermove"].includes(type)) {
            nativeInteractionRemoves += 1;
        }
        return nativeRemoveEventListener(type, handler, options);
    };
    const source = createSource();
    const manager = new EditingPreviewLayerManager(previewMap);
    let addedCandidate = null;
    let addRequestCount = 0;
    let draggedAdded = null;
    const addedPoint = {
        addedPointId: "added-preview",
        trackIndex: 0,
        segmentIndex: 0,
        insertionPosition: 1.5,
        latitude: 35.0015,
        longitude: 135.0015
    };

    manager.setPointAddHandler(candidate => {
        addedCandidate = candidate;
        addRequestCount += 1;
        return addedPoint;
    });
    let deletedIdentity = null;

    manager.setPointDeleteHandler(identity => {
        deletedIdentity = identity;
        return true;
    });
    manager.setPointEditHandler((identity, coordinate) => {
        draggedAdded = { identity, coordinate };
        return true;
    });
    manager.setSource(source);
    manager.setCandidate(
        source,
        [[[true, false, false, true]]],
        {
            latitudeDelta: 0.1,
            longitudeDelta: 0.2,
            northMeters: 11132,
            eastMeters: 18200
        },
        [{
            trackIndex: 0,
            segmentIndex: 0,
            pointIndex: 3,
            latitude: 35.004,
            longitude: 135.004
        }],
        [{ trackIndex: 0, segmentIndex: 0, pointIndex: 1 }],
        [addedPoint]
    );
    assert(nativeInteractionAdds === 0,
        "point interaction listeners were bound while editing was OFF");
    manager.setPointEditingMode(true);
    assert(nativeInteractionAdds === 3,
        "native hover/click/contextmenu listeners were not bound on mode ON");
    manager.setPointEditingMode(true);
    assert(nativeInteractionAdds === 3,
        "native point interaction listeners were registered twice");
    manager.setPointAddMode(true);
    assert(manager.pointAddMode &&
        panes.get("trailbook-edit-point-add").style.pointerEvents === "none",
    "point add mode did not use the non-blocking Map click path");
    const editPoints = layers.filter(layer => layer.type === "point" &&
        layer.options.pane === "trailbook-edit-point-targets");

    assert(editPoints.length === 3,
        "After preview hit geometry did not combine mask/delete/add state");
    assert(editPoints.some(point => point.options.fillColor === "#16a34a"),
        "added point is not visually distinct");
    const addedTarget = editPoints.find(
        point => point.options.fillColor === "#16a34a"
    );

    addedTarget.handlers.mousedown({
        originalEvent: {
            clientX: 13500.15,
            clientY: -3500.15,
            preventDefault() {},
            stopPropagation() {}
        }
    });
    document.dispatchEvent(new MouseEvent("mousemove", {
        clientX: 13501.15,
        clientY: -3500.15
    }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    assert(draggedAdded?.identity.addedPointId === "added-preview",
        "added point drag did not preserve added identity");
    const addLine = layers.findLast(layer =>
        layer.type === "line" && layer.options.pane === "trailbook-edit-point-add"
    );

    assert(addLine && addLine.options.weight === 24,
        "add hit test did not use a Canvas/polyline target");
    assert(addLine.latLngs.length === 3 &&
        Math.abs(addLine.latLngs[0][0] - 35.1) < 1e-12 &&
        Math.abs(addLine.latLngs[1][0] - 35.1015) < 1e-12 &&
        Math.abs(addLine.latLngs[2][0] - 35.104) < 1e-12,
    "add target differs from moved/translated/simplified/deleted After geometry");
    const edgeStart = previewMap.latLngToContainerPoint({
        lat: addLine.latLngs[0][0],
        lng: addLine.latLngs[0][1]
    });
    const edgeEnd = previewMap.latLngToContainerPoint({
        lat: addLine.latLngs[1][0],
        lng: addLine.latLngs[1][1]
    });
    const edgeX = (edgeStart.x + edgeEnd.x) / 2;
    const edgeY = (edgeStart.y + edgeEnd.y) / 2;
    const edgeHover = new MouseEvent("pointermove", {
        bubbles: true,
        clientX: edgeX,
        clientY: edgeY
    });

    container.dispatchEvent(edgeHover);
    assert(container.style.cursor === "crosshair",
    "Add mode edge hover did not activate the shared hit cursor");

    const assertCurrentViewportHit = (viewport, message) => {
        setViewport(viewport);
        container.dispatchEvent(new MouseEvent("pointermove", {
            bubbles: true,
            clientX: -1000,
            clientY: -1000
        }));
        const currentStart = previewMap.latLngToContainerPoint({
            lat: addLine.latLngs[0][0],
            lng: addLine.latLngs[0][1]
        });
        const currentEnd = previewMap.latLngToContainerPoint({
            lat: addLine.latLngs[1][0],
            lng: addLine.latLngs[1][1]
        });

        container.dispatchEvent(new MouseEvent("pointermove", {
            bubbles: true,
            clientX: (currentStart.x + currentEnd.x) / 2,
            clientY: (currentStart.y + currentEnd.y) / 2
        }));
        assert(container.style.cursor === "crosshair", message);
    };

    assertCurrentViewportHit({ x: 120, y: 60 },
        "pan reused stale editing container points");
    assertCurrentViewportHit({ scale: 45000, x: 120, y: 60 },
        "zoom reused stale editing container points");
    assertCurrentViewportHit({ scale: 24000, x: -80, y: 90 },
        "fitBounds reused stale editing container points");
    assertCurrentViewportHit({ scale: 24000, x: 35, y: -25 },
        "resize reused stale editing container points");
    setViewport();

    container.dispatchEvent(new MouseEvent("pointermove", {
        bubbles: true,
        clientX: -1000,
        clientY: -1000
    }));
    assert(container.style.cursor === "",
    "Add cursor did not reset outside the editing edge");
    container.dispatchEvent(edgeHover);

    const edgeClick = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: edgeX,
        clientY: edgeY
    });

    container.dispatchEvent(edgeClick);
    assert(addedCandidate !== null, "edge click did not request point addition");
    assert(manager.pointSelection?.addedPointId === "added-preview",
        "new point was not selected");

    const addedCoordinate = previewMap.latLngToContainerPoint({
        lat: 35.1015,
        lng: 135.2015
    });
    const addedContextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: addedCoordinate.x,
        clientY: addedCoordinate.y
    });

    container.dispatchEvent(addedContextEvent);
    assert(addedContextEvent.defaultPrevented &&
        manager.pointSelection?.addedPointId === "added-preview" &&
        document.querySelector(".track-point-context-menu")?.textContent
            .includes("ポイントを削除"),
    "added point context menu did not take point priority");
    document.querySelector(".track-point-context-menu button")?.click();
    assert(deletedIdentity?.addedPointId === "added-preview",
        "added point context Delete did not use the shared handler");

    const sourceCoordinate = previewMap.latLngToContainerPoint({
        lat: 35.1,
        lng: 135.2
    });
    const sourceContextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: sourceCoordinate.x,
        clientY: sourceCoordinate.y
    });

    container.dispatchEvent(sourceContextEvent);
    assert(sourceContextEvent.defaultPrevented &&
        manager.pointSelection?.pointIndex === 0,
    "existing point context menu did not select the source point");
    document.querySelector(".track-point-context-menu button")?.click();
    assert(deletedIdentity?.pointIndex === 0,
        "existing point context Delete did not use the shared handler");

    const edgeContextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: edgeX,
        clientY: edgeY
    });

    container.dispatchEvent(edgeContextEvent);
    const contextMenuStyle = getComputedStyle(manager.contextMenu.element);

    assert(edgeContextEvent.defaultPrevented &&
        document.querySelector(".track-point-context-menu")?.textContent
            .includes("ここにポイントを追加"),
    "After edge context menu did not offer point addition");
    assert(manager.contextMenu.element.parentElement === document.body &&
        contextMenuStyle.position === "fixed" &&
        Number(contextMenuStyle.zIndex) >= 2000 &&
        contextMenuStyle.display !== "none",
    "context menu is clipped or behind the Leaflet panes");
    const addCountBeforeContextAction = addRequestCount;

    document.querySelector(".track-point-context-menu button")?.click();
    assert(addRequestCount === addCountBeforeContextAction + 1 &&
        manager.pointSelection?.addedPointId === "added-preview",
    "context Add action did not add/select through the shared handler");

    const outsideContextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: -1000,
        clientY: -1000
    });

    manager.contextMenu.close();
    container.dispatchEvent(outsideContextEvent);
    assert(!outsideContextEvent.defaultPrevented && manager.contextMenu.element.hidden,
        "Track-external contextmenu suppressed the browser default");

    container.dispatchEvent(edgeContextEvent);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    assert(manager.contextMenu.element.hidden, "outside pointer did not close menu");
    container.dispatchEvent(edgeContextEvent);
    document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true
    }));
    assert(manager.contextMenu.element.hidden, "Escape did not close menu");
    container.dispatchEvent(edgeHover);
    container.dispatchEvent(edgeContextEvent);
    mapHandlers.get("movestart")?.();
    assert(manager.contextMenu.element.hidden && container.style.cursor === "",
        "Map pan did not close the menu and reset the Add cursor");
    container.dispatchEvent(edgeHover);
    container.dispatchEvent(edgeContextEvent);
    mapHandlers.get("zoomstart")?.();
    assert(manager.contextMenu.element.hidden && container.style.cursor === "",
        "Map zoom did not close the menu and reset the Add cursor");

    manager.setPointAddMode(false);
    const addCountBeforeOffClick = addRequestCount;

    container.dispatchEvent(edgeHover);
    assert(container.style.cursor === "",
        "Add mode OFF retained the edge hover cursor");
    container.dispatchEvent(edgeClick);
    assert(addRequestCount === addCountBeforeOffClick,
        "point add mode OFF left edge hit testing remained enabled");
    manager.setPointEditingMode(false);
    assert(nativeInteractionRemoves === 3,
        "native hover/click/contextmenu listeners were not removed on mode OFF");
    const offContextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: sourceCoordinate.x,
        clientY: sourceCoordinate.y
    });

    container.dispatchEvent(offContextEvent);
    assert(!offContextEvent.defaultPrevented,
        "Point Editing OFF suppressed the browser context menu");
    const replacement = createLeafletFakes();

    manager.setMap(replacement.map);
    manager.setPointEditingMode(true);
    manager.setPointAddMode(true);
    const replacementStart = replacement.map.latLngToContainerPoint({
        lat: addLine.latLngs[0][0],
        lng: addLine.latLngs[0][1]
    });
    const replacementEnd = replacement.map.latLngToContainerPoint({
        lat: addLine.latLngs[1][0],
        lng: addLine.latLngs[1][1]
    });

    replacement.container.dispatchEvent(new MouseEvent("pointermove", {
        bubbles: true,
        clientX: (replacementStart.x + replacementEnd.x) / 2,
        clientY: (replacementStart.y + replacementEnd.y) / 2
    }));
    assert(replacement.container.style.cursor === "crosshair",
    "Map lifecycle replacement retained stale projection/container ownership");
    const menuElement = manager.contextMenu?.element;

    manager.clear();
    assert(!document.body.contains(menuElement),
        "Editor close retained the context menu element");
    replacement.container.remove();
    container.remove();
}

function testLargeTrack() {
    const { map, layers, container } = createLeafletFakes();
    const source = createSource(3050);
    const manager = new EditingPreviewLayerManager(map);
    const started = performance.now();

    manager.setSource(source);
    manager.setCandidate(source, [[Array(3050).fill(true)]]);
    manager.setPointEditingMode(true);
    manager.setPointAddMode(true);
    const elapsed = performance.now() - started;

    assert(layers.filter(layer => layer.options?.pane ===
        "trailbook-edit-point-add").length === 1,
    "large Track created per-point add hit layers");
    const points = source.tracks[0].segments[0].points;
    const left = map.latLngToContainerPoint({
        lat: points.at(-2).latitude,
        lng: points.at(-2).longitude
    });
    const right = map.latLngToContainerPoint({
        lat: points.at(-1).latitude,
        lng: points.at(-1).longitude
    });

    container.dispatchEvent(new MouseEvent("pointermove", {
        bubbles: true,
        clientX: (left.x + right.x) / 2,
        clientY: (left.y + right.y) / 2
    }));
    assert(container.style.cursor === "crosshair",
    "3000+ edge search did not reach the final edge");
    assert(elapsed < 2000, "3000-point mutation preview regressed severely");
    manager.clear();
    container.remove();
}

function testGeometrySeparation() {
    ["off", "before", "after", "both"].forEach(pointMode => {
        const { map, displayed, container } = createLeafletFakes();
        const source = createSource(100);
        const manager = new EditingPreviewLayerManager(map);
        const retained = Array.from({ length: 100 }, (_, index) => index < 60);

        manager.setSource(source);
        manager.setCandidate(
            source,
            [[retained]],
            { latitudeDelta: 0.1, longitudeDelta: 0.2 },
            [{
                trackIndex: 0,
                segmentIndex: 0,
                pointIndex: 0,
                latitude: 35.01,
                longitude: 135.02
            }]
        );
        manager.setPointMode(pointMode);
        const beforeGroup = manager.beforePointLayerGroup;
        const afterGroup = manager.afterPointLayerGroup;

        manager.setPointEditingMode(true);
        assert(manager.editingGeometry !== manager.beforeGeometry &&
            manager.editingGeometry !== manager.afterGeometry,
        `editing geometry reused a preview reference in ${pointMode} mode`);
        const beforeFirst = manager.beforeGeometry[0].vertices[0].coordinate;
        const afterFirst = manager.afterGeometry[0].vertices[0].coordinate;
        const editingFirst = manager.editingGeometry[0].vertices[0].coordinate;

        assert(beforeFirst.latitude === 35 && beforeFirst.longitude === 135 &&
            Math.abs(afterFirst.latitude - 35.11) < 1e-12 &&
            Math.abs(afterFirst.longitude - 135.22) < 1e-12 &&
            Math.abs(editingFirst.latitude - 35.11) < 1e-12 &&
            Math.abs(editingFirst.longitude - 135.22) < 1e-12,
        `editing overlay did not copy current After geometry in ${pointMode} mode`);
        assert(manager.beforeGeometry[0].vertices.length === 100 &&
            manager.afterGeometry[0].vertices.length === 60 &&
            manager.editingGeometry[0].vertices.length === 60,
        `geometry point counts diverged in ${pointMode} mode`);
        assert(manager.beforeGeometry !== manager.afterGeometry &&
            manager.afterGeometry !== manager.editingGeometry,
        `Before/After/editing snapshots shared ownership in ${pointMode} mode`);
        assert(manager.afterLayerGroup.layers[0].latLngs ===
            manager.afterGeometry[0].latLngs,
        `After line did not retain After geometry in ${pointMode} mode`);
        assert(manager.pointEditLayerGroup.layers.length === 60,
            `editing overlay did not own editing geometry in ${pointMode} mode`);
        assert(!displayed.has(beforeGroup) && !displayed.has(afterGroup),
            `Point Editing did not visually hide ${pointMode} Point preview`);
        assert(manager.pointMode === pointMode,
            `Point Editing changed ${pointMode} Point preview state while hidden`);
        manager.setPointEditingMode(false);
        assert(manager.pointMode === pointMode,
            `Point Editing changed ${pointMode} Point preview state`);
        assert(manager.beforePointLayerGroup === beforeGroup &&
            manager.afterPointLayerGroup === afterGroup,
        `Point Editing replaced ${pointMode} Point preview layers`);
        assert(!displayed.has(manager.pointEditLayerGroup),
            `editing overlay remained visible in ${pointMode} mode`);
        assert(displayed.has(manager.beforePointLayerGroup) ===
            (pointMode === "before" || pointMode === "both"),
        `Before Point preview visibility changed in ${pointMode} mode`);
        assert(displayed.has(manager.afterPointLayerGroup) ===
            (pointMode === "after" || pointMode === "both"),
        `After Point preview visibility changed in ${pointMode} mode`);
        if (afterGroup) {
            const afterPoint = afterGroup.layers[0];

            assert(Math.abs(afterPoint.latLng[0] - 35.11) < 1e-12 &&
                Math.abs(afterPoint.latLng[1] - 135.22) < 1e-12,
            `After Point preview rendered Before geometry in ${pointMode} mode`);
        }
        manager.clear();
        container.remove();
    });
}

function testGeometryOwnership() {
    const { map, container } = createLeafletFakes();
    const sourceA = createSource(4, {
        relativePath: "folder/a.gpx",
        latitudeBase: 35
    });
    const sourceB = createSource(4, {
        relativePath: "folder/b.gpx",
        latitudeBase: 36
    });
    const manager = new EditingPreviewLayerManager(map);

    manager.setSource(sourceA);
    assert(manager.setCandidate(sourceA, [[Array(4).fill(true)]]) === true,
        "current session candidate was rejected");
    manager.setPointEditingMode(true);

    assert(manager.setCandidate(sourceB, [[Array(4).fill(true)]]) === false,
        "stale/other Track candidate replaced current ownership");
    assert(manager.source === sourceA &&
        manager.afterGeometry[0].vertices[0].coordinate.latitude === 35,
    "rejected Track candidate contaminated preview geometry");

    manager.setPointEditingMode(false);
    manager.setSource(sourceB);
    assert(manager.setCandidate(sourceB, [[Array(4).fill(true)]]) === true,
        "explicit Track switch did not establish new ownership");
    manager.setPointEditingMode(true);
    assert(manager.source === sourceB &&
        manager.afterGeometry[0].vertices[0].coordinate.latitude === 36 &&
        manager.editingGeometry[0].vertices[0].coordinate.latitude === 36,
    "Track switch retained old session geometry");

    manager.clear();
    container.remove();
}

function testMultipleSegmentNearestEdge() {
    const { map, container } = createLeafletFakes();
    const base = createSource(3);
    const firstPoints = base.tracks[0].segments[0].points;
    const secondPoints = firstPoints.map(point => ({
        latitude: point.latitude + 0.01,
        longitude: point.longitude + 0.01
    }));
    const source = Object.freeze({
        ...base,
        tracks: [{ segments: [
            { points: firstPoints },
            { points: secondPoints }
        ] }]
    });
    const manager = new EditingPreviewLayerManager(map);
    let addedCandidate = null;

    manager.setPointAddHandler(candidate => {
        addedCandidate = candidate;
        return {
            addedPointId: "multiple-segment",
            trackIndex: candidate.trackIndex,
            segmentIndex: candidate.segmentIndex,
            insertionPosition: candidate.insertionPosition
        };
    });
    manager.setSource(source);
    manager.setCandidate(source, [[
        Array(3).fill(true),
        Array(3).fill(true)
    ]]);
    manager.setPointEditingMode(true);
    manager.setPointAddMode(true);
    const left = map.latLngToContainerPoint({
        lat: secondPoints[1].latitude,
        lng: secondPoints[1].longitude
    });
    const right = map.latLngToContainerPoint({
        lat: secondPoints[2].latitude,
        lng: secondPoints[2].longitude
    });

    container.dispatchEvent(new MouseEvent("pointermove", {
        bubbles: true,
        clientX: (left.x + right.x) / 2,
        clientY: (left.y + right.y) / 2
    }));
    assert(container.style.cursor === "crosshair",
        "multiple segment edge did not produce Add hover feedback");
    container.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: (left.x + right.x) / 2,
        clientY: (left.y + right.y) / 2
    }));
    assert(addedCandidate?.segmentIndex === 1 &&
        addedCandidate.insertionPosition > 1 &&
        addedCandidate.insertionPosition < 2,
        "multiple segment search selected an edge from the wrong segment");

    manager.clear();
    container.remove();
}

try {
    testSessionAndSerialization();
    testHitDetectionAndPreview();
    testGeometrySeparation();
    testGeometryOwnership();
    testMultipleSegmentNearestEdge();
    testLargeTrack();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
