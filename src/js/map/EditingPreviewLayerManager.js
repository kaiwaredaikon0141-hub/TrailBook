import TrackPointEditingService from "../services/TrackPointEditingService.js";
import TrackPointMutationService, {
    DEFAULT_ADD_HIT_TOLERANCE_PX
} from "../services/TrackPointMutationService.js";
import PointEditingContextMenu from "../ui/PointEditingContextMenu.js";
import TrackTranslationService, {
    ZERO_TRACK_TRANSLATION
} from "../services/TrackTranslationService.js";

const PREVIEW_MODES = new Set(["before", "after", "both"]);
const POINT_MODES = new Set(["off", "before", "after", "both"]);

const BEFORE_STYLE = Object.freeze({
    color: "#374151",
    weight: 5,
    opacity: 0.75,
    dashArray: "8 6",
    interactive: false,
    bubblingMouseEvents: false
});

const AFTER_STYLE = Object.freeze({
    color: "#f97316",
    weight: 4,
    opacity: 1,
    interactive: false,
    bubblingMouseEvents: false
});

const BEFORE_POINT_STYLE = Object.freeze({
    radius: 4,
    color: "#374151",
    weight: 1.5,
    opacity: 0.7,
    fillColor: "#ffffff",
    fillOpacity: 0.65,
    interactive: false,
    bubblingMouseEvents: false
});

const AFTER_POINT_STYLE = Object.freeze({
    radius: 5.5,
    color: "#ffffff",
    weight: 1,
    opacity: 0.9,
    fillColor: "#f97316",
    fillOpacity: 0.95,
    interactive: false,
    bubblingMouseEvents: false
});

const POINT_EDIT_TARGET_STYLE = Object.freeze({
    radius: 7,
    color: "#ffffff",
    weight: 1,
    opacity: 0.9,
    fillColor: "#2563eb",
    fillOpacity: 0.7,
    interactive: true,
    bubblingMouseEvents: false
});

const SELECTED_POINT_STYLE = Object.freeze({
    radius: 8,
    color: "#ffffff",
    weight: 3,
    opacity: 1,
    fillColor: "#dc2626",
    fillOpacity: 1,
    interactive: false,
    bubblingMouseEvents: false
});

const ADDED_POINT_STYLE = Object.freeze({
    ...POINT_EDIT_TARGET_STYLE,
    fillColor: "#16a34a"
});

const POINT_ADD_LINE_STYLE = Object.freeze({
    weight: 24,
    opacity: 0,
    interactive: false,
    bubblingMouseEvents: false
});

/**
 * Owns Editor-only line and point layers outside the normal LayerManager.
 */
export default class EditingPreviewLayerManager {

    constructor(map, {
        translationService = new TrackTranslationService(),
        pointEditingService = new TrackPointEditingService({
            translationService
        }),
        pointMutationService = new TrackPointMutationService({
            pointEditing: pointEditingService,
            translation: translationService
        })
    } = {}) {

        this.map = map;
        this.source = null;
        this.retainedPointMasks = null;
        this.beforeGeometry = [];
        this.afterGeometry = [];
        this.editingGeometry = [];
        this.beforeLayerGroup = null;
        this.afterLayerGroup = null;
        this.beforePointLayerGroup = null;
        this.afterPointLayerGroup = null;
        this.pointEditLayerGroup = null;
        this.pointAddLayerGroup = null;
        this.selectedPointLayer = null;
        this.afterSegmentLayers = new Map();
        this.afterPointLines = new Map();
        this.mode = "both";
        this.pointMode = "off";
        this.translation = ZERO_TRACK_TRANSLATION;
        this.translationMode = false;
        this.translationHandler = null;
        this.dragState = null;
        this.translationService = translationService;
        this.pointEditingService = pointEditingService;
        this.pointMutationService = pointMutationService;
        this.pointEdits = [];
        this.deletedPoints = [];
        this.addedPoints = [];
        this.pointEditingMode = false;
        this.pointAddMode = false;
        this.pointSelection = null;
        this.pointSelectionHandler = null;
        this.pointEditHandler = null;
        this.pointAddHandler = null;
        this.pointDeleteHandler = null;
        this.contextMenu = null;
        this.interactionContainer = null;
        this.interactionMap = null;
        this.pointAddCursorActive = false;
        this.pointAddPreviousCursor = "";
        this.pointDragState = null;
        this.wasDraggingEnabled = false;
        this.pointRenderer = L.canvas({
            padding: 0.5,
            pane: "trailbook-edit-after-points"
        });
        this.pointEditRenderer = L.canvas({
            padding: 0.5,
            pane: "trailbook-edit-point-targets"
        });
        this.#ensurePanes();
        this.map?.on?.("movestart zoomstart", this.#handleMapMovementStart);
    }

    setMap(map) {

        if (!map || map === this.map) return true;

        this.#unbindPointInteractions();
        ["beforeLayerGroup", "afterLayerGroup", "beforePointLayerGroup",
            "afterPointLayerGroup", "pointEditLayerGroup", "pointAddLayerGroup"]
            .forEach(property => this.#removeGroup(property));
        this.#removeSelectedPointLayer();
        this.map?.off?.("movestart zoomstart", this.#handleMapMovementStart);
        this.map = map;
        this.pointRenderer = L.canvas({
            padding: 0.5,
            pane: "trailbook-edit-after-points"
        });
        this.pointEditRenderer = L.canvas({
            padding: 0.5,
            pane: "trailbook-edit-point-targets"
        });
        this.#ensurePanes();
        this.map.on?.("movestart zoomstart", this.#handleMapMovementStart);
        this.afterSegmentLayers.clear();
        this.afterPointLines.clear();
        if (this.source) {
            this.beforeLayerGroup = this.#createLineGroup(
                this.source,
                null,
                BEFORE_STYLE,
                "trailbook-edit-before",
                null,
                this.beforeGeometry
            );
            this.afterLayerGroup = this.#createLineGroup(
                this.source,
                this.retainedPointMasks,
                AFTER_STYLE,
                "trailbook-edit-after",
                this.translation,
                this.afterGeometry
            );
        }
        this.#applyMode();
        this.#applyPointMode();
        this.#applyPointEditingMode();
        return true;
    }

    setSource(source) {

        this.source = source;
        this.beforeGeometry = this.#segments(source, null, null);
        this.afterGeometry = [];
        this.editingGeometry = [];
        this.clearPointSelection();
        this.#removeGroup("beforeLayerGroup");
        this.#removeGroup("beforePointLayerGroup");
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.#removeGroup("pointEditLayerGroup");
        this.#removeGroup("pointAddLayerGroup");
        this.afterSegmentLayers.clear();
        this.afterPointLines.clear();
        this.beforeLayerGroup = this.#createLineGroup(
            source,
            null,
            BEFORE_STYLE,
            "trailbook-edit-before",
            null,
            this.beforeGeometry
        );
        this.#applyMode();
        this.#applyPointMode();
    }

    setCandidate(
        source,
        retainedPointMasks,
        translation = this.translation,
        pointEdits = this.pointEdits,
        deletedPoints = this.deletedPoints,
        addedPoints = this.addedPoints
    ) {

        // Candidates may complete asynchronously. Only the source explicitly
        // established by setSource() owns this preview generation.
        if (!source || source !== this.source) return false;

        this.retainedPointMasks = retainedPointMasks;
        this.translation = this.translationService.normalize(translation);
        this.pointEdits = this.pointEditingService.normalizeEdits(pointEdits);
        this.deletedPoints = this.pointMutationService.normalizeDeletedPoints(
            deletedPoints
        );
        this.addedPoints = this.pointMutationService.normalizeAddedPoints(
            addedPoints
        );
        const afterGeometry = this.#segments(
            source,
            retainedPointMasks,
            this.translation
        );
        const editingGeometry = this.#cloneGeometry(afterGeometry);

        this.afterGeometry = afterGeometry;
        this.editingGeometry = editingGeometry;
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.#removeGroup("pointEditLayerGroup");
        this.#removeGroup("pointAddLayerGroup");
        this.#removeSelectedPointLayer();
        this.afterSegmentLayers.clear();
        this.afterPointLines.clear();
        this.afterLayerGroup = this.#createLineGroup(
            source,
            retainedPointMasks,
            AFTER_STYLE,
            "trailbook-edit-after",
            this.translation,
            this.afterGeometry
        );
        this.#applyMode();
        this.#applyPointMode();
        this.#applyPointEditingMode();
        return true;
    }

    setMode(mode) {

        if (!PREVIEW_MODES.has(mode)) return false;

        this.mode = mode;
        this.#applyMode();
        return true;
    }

    setPointMode(mode) {

        if (!POINT_MODES.has(mode)) return false;

        this.pointMode = mode;
        this.#applyPointMode();
        return true;
    }

    setTranslationPreviewHandler(handler) {

        this.translationHandler = typeof handler === "function"
            ? handler
            : null;
    }

    setPointSelectionHandler(handler) {

        this.pointSelectionHandler = typeof handler === "function"
            ? handler
            : null;
    }

    setPointEditHandler(handler) {

        this.pointEditHandler = typeof handler === "function"
            ? handler
            : null;
    }

    setPointAddHandler(handler) {

        this.pointAddHandler = typeof handler === "function" ? handler : null;
    }

    setPointDeleteHandler(handler) {

        this.pointDeleteHandler = typeof handler === "function" ? handler : null;
    }

    setPointEditingMode(enabled) {

        const next = Boolean(enabled);

        if (next === this.pointEditingMode) return true;
        if (next) this.setTranslationMode(false);
        if (!next) {
            this.setPointAddMode(false);
            this.#closeContextMenu();
            this.#unbindPointInteractions();
        }
        this.#finishPointDrag();
        this.pointEditingMode = next;
        this.#applyPointEditingMode();
        return true;
    }

    setPointAddMode(enabled) {

        const next = Boolean(enabled) && this.pointEditingMode;

        if (next === this.pointAddMode) return true;
        this.pointAddMode = next;
        if (!next) {
            this.#setPointAddCursor(false);
        }
        this.#applyPointAddMode();
        return true;
    }

    selectPoint(identity) {

        this.pointSelection = identity
            ? this.pointMutationService.normalizeIdentity(identity)
            : null;
        this.pointSelectionHandler?.(this.pointSelection);
        this.#renderSelectedPoint();
        return this.pointSelection;
    }

    clearPointSelection() {

        this.pointSelection = null;
        this.#removeSelectedPointLayer();
        this.pointSelectionHandler?.(null);
    }

    setTranslation(value) {

        this.translation = this.translationService.normalize(value);
        if (!this.source) return;

        this.setCandidate(
            this.source,
            this.retainedPointMasks,
            this.translation,
            this.pointEdits,
            this.deletedPoints,
            this.addedPoints
        );
    }

    setTranslationMode(enabled) {

        const next = Boolean(enabled);

        if (next === this.translationMode) return true;

        this.#finishDrag();
        this.translationMode = next;
        const pane = this.map?.getPane?.("trailbook-edit-after");

        if (pane?.style) pane.style.pointerEvents = next ? "auto" : "none";

        if (next) {
            this.wasDraggingEnabled = Boolean(this.map?.dragging?.enabled?.());
            this.map?.dragging?.disable?.();
        } else if (this.wasDraggingEnabled) {
            this.map?.dragging?.enable?.();
            this.wasDraggingEnabled = false;
        }

        if (this.source) {
            this.setCandidate(
                this.source,
                this.retainedPointMasks,
                this.translation,
                this.pointEdits,
                this.deletedPoints,
                this.addedPoints
            );
        }
        return true;
    }

    clear() {

        this.setPointEditingMode(false);
        this.setTranslationMode(false);
        this.#finishPointDrag();
        this.#removeGroup("beforeLayerGroup");
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("beforePointLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.#removeGroup("pointEditLayerGroup");
        this.#removeGroup("pointAddLayerGroup");
        this.#removeSelectedPointLayer();
        this.contextMenu?.destroy();
        this.contextMenu = null;
        this.source = null;
        this.retainedPointMasks = null;
        this.translation = ZERO_TRACK_TRANSLATION;
        this.pointEdits = [];
        this.deletedPoints = [];
        this.addedPoints = [];
        this.beforeGeometry = [];
        this.afterGeometry = [];
        this.editingGeometry = [];
        this.pointSelection = null;
        this.afterSegmentLayers.clear();
        this.afterPointLines.clear();
    }

    #createLineGroup(
        source,
        masks,
        style,
        pane,
        translation = null,
        geometry = null
    ) {

        const group = L.layerGroup();
        const lineGeometry = geometry || this.#segments(
            source,
            masks,
            translation
        );

        lineGeometry.forEach(segment => {
            const line = L.polyline(segment.latLngs, {
                ...style,
                pane,
                interactive: Boolean(translation && this.translationMode)
            }).addTo(group);

            if (translation) {
                this.afterSegmentLayers.set(
                    `${segment.trackIndex}/${segment.segmentIndex}`,
                    line
                );
                segment.vertices.forEach(vertex => {
                    this.afterPointLines.set(
                        this.pointMutationService.key(vertex.identity),
                        { line, vertices: segment.vertices }
                    );
                });
            }

            if (translation && this.translationMode) {
                line.on("mousedown", event => this.#startDrag(event));
            }
        });

        return group;
    }

    #createPointGroup(geometry, style, pane) {

        const group = L.layerGroup();

        geometry
            .flatMap(segment => segment.vertices)
            .forEach(vertex => {
                const coordinate = vertex.coordinate;

                if (!coordinate) return;
                L.circleMarker([coordinate.latitude, coordinate.longitude], {
                        ...style,
                        pane,
                        renderer: this.pointRenderer
                    }).addTo(group);
            });

        return group;
    }

    #cloneGeometry(geometry) {

        return Object.freeze(geometry.map(segment => {
            const vertices = Object.freeze(segment.vertices.map(vertex =>
                Object.freeze({
                    identity: Object.freeze({ ...vertex.identity }),
                    insertionPosition: vertex.insertionPosition,
                    coordinate: vertex.coordinate
                        ? Object.freeze({ ...vertex.coordinate })
                        : null
                })));

            return Object.freeze({
                trackIndex: segment.trackIndex,
                segmentIndex: segment.segmentIndex,
                vertices,
                latLngs: Object.freeze(vertices.map(vertex => Object.freeze([
                    vertex.coordinate.latitude,
                    vertex.coordinate.longitude
                ])))
            });
        }));
    }

    #segments(source, masks, translation = null) {

        const segments = [];

        source.tracks.forEach((track, trackIndex) => {
            track.segments.forEach((segment, segmentIndex) => {
                const vertices = translation
                    ? this.pointMutationService.getSegmentVertices({
                        source,
                        retainedPointMasks: masks,
                        pointEdits: this.pointEdits,
                        deletedPoints: this.deletedPoints,
                        addedPoints: this.addedPoints,
                        trackIndex,
                        segmentIndex,
                        translation
                    })
                    : segment.points.map((point, pointIndex) => Object.freeze({
                        identity: Object.freeze({
                            trackIndex,
                            segmentIndex,
                            pointIndex
                        }),
                        insertionPosition: pointIndex,
                        coordinate: this.#isValidPoint(point)
                            ? Object.freeze({
                                latitude: point.latitude,
                                longitude: point.longitude
                            })
                            : null
                    }));
                let current = [];

                vertices.forEach(vertex => {
                    if (!vertex.coordinate) {
                        this.#pushSegment(
                            segments,
                            trackIndex,
                            segmentIndex,
                            current
                        );
                        current = [];
                        return;
                    }
                    current.push(vertex);
                });
                this.#pushSegment(
                    segments,
                    trackIndex,
                    segmentIndex,
                    current
                );
            });
        });

        return Object.freeze(segments);
    }

    #pushSegment(segments, trackIndex, segmentIndex, vertices) {

        if (vertices.length === 0) return;

        const snapshotVertices = Object.freeze([...vertices]);

        segments.push(Object.freeze({
            trackIndex,
            segmentIndex,
            vertices: snapshotVertices,
            latLngs: Object.freeze(snapshotVertices.map(vertex => Object.freeze([
                vertex.coordinate.latitude,
                vertex.coordinate.longitude
            ])))
        }));
    }

    #applyMode() {

        this.#setVisible(
            this.beforeLayerGroup,
            this.mode === "before" || this.mode === "both"
        );
        this.#setVisible(
            this.afterLayerGroup,
            this.mode === "after" || this.mode === "both"
        );
    }

    #applyPointMode() {

        const before = !this.pointEditingMode &&
            (this.pointMode === "before" || this.pointMode === "both");
        const after = !this.pointEditingMode &&
            (this.pointMode === "after" || this.pointMode === "both");

        if (before && !this.beforePointLayerGroup && this.source) {
            this.beforePointLayerGroup = this.#createPointGroup(
                this.beforeGeometry,
                BEFORE_POINT_STYLE,
                "trailbook-edit-before-points"
            );
        }
        if (after && !this.afterPointLayerGroup && this.source) {
            this.afterPointLayerGroup = this.#createPointGroup(
                this.afterGeometry,
                AFTER_POINT_STYLE,
                "trailbook-edit-after-points"
            );
        }

        this.#setVisible(this.beforePointLayerGroup, before);
        this.#setVisible(this.afterPointLayerGroup, after);
    }

    #applyPointEditingMode() {

        const pane = this.map?.getPane?.("trailbook-edit-point-targets");

        if (pane?.style) {
            pane.style.pointerEvents = this.pointEditingMode ? "auto" : "none";
        }

        if (this.pointEditingMode && !this.pointEditLayerGroup && this.source) {
            this.pointEditLayerGroup = this.#createPointEditGroup();
        }

        this.#setVisible(this.pointEditLayerGroup, this.pointEditingMode);
        this.#applyPointMode();
        this.#applyPointAddMode();
        if (this.pointEditingMode) this.#bindPointInteractions();
        this.#renderSelectedPoint();
    }

    #createPointEditGroup() {

        const group = L.layerGroup();

        this.editingGeometry
            .flatMap(segment => segment.vertices)
            .forEach(vertex => {
                    const identity = vertex.identity;
                    const marker = L.circleMarker(
                        this.#editingLatLng(vertex),
                        {
                            ...(this.pointMutationService.isAddedIdentity(identity)
                                ? ADDED_POINT_STYLE
                                : POINT_EDIT_TARGET_STYLE),
                            pane: "trailbook-edit-point-targets",
                            renderer: this.pointEditRenderer
                        }
                    ).addTo(group);

                    marker.on("mousedown", event => {
                        this.#startPointDrag(identity, event);
                    });
            });

        return group;
    }

    #applyPointAddMode() {

        const pane = this.map?.getPane?.("trailbook-edit-point-add");

        if (pane?.style) {
            pane.style.pointerEvents = "none";
        }
        if (this.pointAddMode && !this.pointAddLayerGroup && this.source) {
            this.pointAddLayerGroup = this.#createPointAddGroup();
        }
        this.#setVisible(this.pointAddLayerGroup, this.pointAddMode);
    }

    #createPointAddGroup() {

        const group = L.layerGroup();

        this.editingGeometry
            .filter(segment => segment.vertices.length >= 2)
            .forEach(segment => {
                const line = L.polyline(segment.latLngs, {
                    ...POINT_ADD_LINE_STYLE,
                    pane: "trailbook-edit-point-add"
                }).addTo(group);
            });

        return group;
    }

    #commitPointAdd(candidate) {

        if (!candidate) return false;
        const added = this.pointAddHandler?.(candidate);

        if (added) this.selectPoint(added);
        return Boolean(added);
    }

    #bindPointInteractions() {

        const map = this.#activeMap();
        const container = map?.getContainer?.() || null;

        if (
            !container ||
            (container === this.interactionContainer && map === this.interactionMap)
        ) return;

        this.#unbindPointInteractions();
        this.interactionMap = map;
        this.interactionContainer = container;
        container.addEventListener("click", this.#handleMapClick, true);
        container.addEventListener("pointermove", this.#handlePointerMove, true);
        container.addEventListener(
            "contextmenu",
            this.#handleContextMenu,
            true
        );
    }

    #unbindPointInteractions() {

        this.interactionContainer?.removeEventListener(
            "click",
            this.#handleMapClick,
            true
        );
        this.interactionContainer?.removeEventListener(
            "pointermove",
            this.#handlePointerMove,
            true
        );
        this.interactionContainer?.removeEventListener(
            "contextmenu",
            this.#handleContextMenu,
            true
        );
        this.#setPointAddCursor(false);
        this.interactionMap = null;
        this.interactionContainer = null;
    }

    #handlePointerMove = event => {

        if (!this.pointEditingMode) return;

        const map = this.#activeMap();
        const point = map.mouseEventToContainerPoint(event);
        const interaction = this.#hitTestEditingGeometry(point, map);
        const hoverEdge = this.pointAddMode && !interaction.pointIdentity &&
            interaction.edgeHit && this.#afterIsVisible();

        this.#setPointAddCursor(hoverEdge);
    };

    #handleMapClick = event => {

        if (!this.pointEditingMode) return;

        const map = this.#activeMap();
        const point = map.mouseEventToContainerPoint(event);
        const hit = this.#hitTestEditingGeometry(point, map);
        const identity = hit.pointIdentity;
        let action = "no-op";

        if (identity) action = "point-priority";
        else if (!this.pointAddMode) action = "add-mode-off";
        else if (!this.#afterIsVisible()) action = "after-hidden";
        else if (!hit.edgeHit) action = "edge-miss";
        else if (this.#commitPointAdd(hit.candidate)) action = "add-point";
        else action = "add-command-rejected";

        if (action !== "add-point") return;

        event.preventDefault?.();
        event.stopPropagation?.();
        this.#closeContextMenu();
    };

    #handleContextMenu = event => {

        if (!this.pointEditingMode || !this.#isDesktop()) return;

        const map = this.#activeMap();
        const containerPoint = map.mouseEventToContainerPoint(event);
        const hit = this.#hitTestEditingGeometry(containerPoint, map);
        const identity = hit.pointIdentity;

        if (identity) {
            event.preventDefault();
            event.stopPropagation();
            this.selectPoint(identity);
            this.#showPointContextMenu(event, identity);
            return;
        }

        if (!this.#afterIsVisible() || !hit.edgeHit) return;

        event.preventDefault();
        event.stopPropagation();
        this.#showAddContextMenu(event, hit.candidate);
    };

    #hitTestEditingGeometry(containerPoint, projectionMap = this.#activeMap()) {

        const screenGeometry = this.#projectEditingGeometryForHitTest(
            projectionMap
        );
        const pointIdentity = this.#findPointIdentity(
            containerPoint,
            screenGeometry
        );

        return Object.freeze({
            pointIdentity,
            ...this.#measureAddHit(containerPoint, screenGeometry)
        });
    }

    #measureAddHit(containerPoint, screenGeometry) {

        let nearest = null;

        screenGeometry
            .filter(segment => segment.vertices.length >= 2)
            .forEach(segment => {
                const candidate = this.pointMutationService.findInsertion(
                    containerPoint,
                    segment.vertices,
                    { maxDistancePixels: Number.POSITIVE_INFINITY }
                );

                if (
                    candidate &&
                    (!nearest || candidate.hitDistancePixels < nearest.hitDistancePixels)
                ) nearest = candidate;
            });

        return Object.freeze({
            nearest,
            candidate: nearest?.hitDistancePixels <= DEFAULT_ADD_HIT_TOLERANCE_PX
                ? nearest
                : null,
            edgeHit: Boolean(
                nearest?.hitDistancePixels <= DEFAULT_ADD_HIT_TOLERANCE_PX
            )
        });
    }

    #editingLatLng(vertex) {

        const { latitude, longitude } = vertex.coordinate;

        return L.latLng
            ? L.latLng(latitude, longitude)
            : { lat: latitude, lng: longitude };
    }

    #projectEditingGeometryForHitTest(projectionMap = this.#activeMap()) {

        // Container points belong to the current viewport. Project once for
        // this event and never retain them as editing geometry state.
        return this.editingGeometry.map(segment => ({
            trackIndex: segment.trackIndex,
            segmentIndex: segment.segmentIndex,
            vertices: segment.vertices.map(vertex => {
                const latLng = this.#editingLatLng(vertex);

                return {
                    identity: vertex.identity,
                    insertionPosition: vertex.insertionPosition,
                    rawCoordinate: vertex.coordinate,
                    latLng,
                    containerPoint: projectionMap.latLngToContainerPoint(latLng)
                };
            })
        }));
    }

    #groupMap(group) {

        if (group?._map) return group._map;
        const layers = group?.getLayers?.() || group?.layers || [];
        return layers.find(layer => layer?._map)?._map || null;
    }

    #activeMap() {

        return this.#groupMap(this.afterLayerGroup) ||
            this.#groupMap(this.pointEditLayerGroup) ||
            this.map;
    }

    #findPointIdentity(
        containerPoint,
        screenGeometry,
        maximumDistance = 12
    ) {

        let nearest = null;

        screenGeometry
            .flatMap(segment => segment.vertices)
            .forEach(vertex => {
                const point = vertex.containerPoint;

                if (!point) return;

                const distance = Math.hypot(
                    containerPoint.x - point.x,
                    containerPoint.y - point.y
                );

                if (
                    distance <= maximumDistance &&
                    (!nearest || distance < nearest.distance)
                ) nearest = { distance, identity: vertex.identity };
            });

        return nearest?.identity || null;
    }

    #showPointContextMenu(event, identity) {

        this.#getContextMenu()?.show({
            clientX: event.clientX,
            clientY: event.clientY,
            actions: [
                {
                    label: "ポイントを削除",
                    run: () => this.pointDeleteHandler?.(identity)
                },
                { label: "選択解除", run: () => this.clearPointSelection() }
            ]
        });
    }

    #showAddContextMenu(event, candidate) {

        this.#getContextMenu()?.show({
            clientX: event.clientX,
            clientY: event.clientY,
            actions: [{
                label: "ここにポイントを追加",
                run: () => this.#commitPointAdd(candidate)
            }]
        });
    }

    #getContextMenu() {

        this.contextMenu ||= new PointEditingContextMenu();
        return this.contextMenu;
    }

    #closeContextMenu = () => {

        this.contextMenu?.close();
    };

    #handleMapMovementStart = () => {

        this.#closeContextMenu();
        this.#setPointAddCursor(false);
    };

    #setPointAddCursor(enabled) {

        const container = this.interactionContainer ||
            this.map?.getContainer?.() || null;
        const next = Boolean(enabled);

        if (!container || next === this.pointAddCursorActive) return;

        if (next) {
            this.pointAddPreviousCursor = container.style.cursor;
            container.style.cursor = "crosshair";
            this.pointAddCursorActive = true;
            return;
        }

        container.style.cursor = this.pointAddPreviousCursor;
        this.pointAddPreviousCursor = "";
        this.pointAddCursorActive = false;
    }

    #afterIsVisible() {

        return this.mode === "after" || this.mode === "both";
    }

    #isDesktop() {

        return !globalThis.matchMedia ||
            globalThis.matchMedia("(min-width: 769px)").matches;
    }

    #displayCoordinate(identity, translation = this.translation) {

        if (this.pointMutationService.isAddedIdentity(identity)) {
            const added = this.pointMutationService.getAddedPoint(
                this.addedPoints,
                identity
            );

            if (!added) throw new TypeError("Added Track Point is unavailable");
            return this.translationService.translateCoordinate(
                added.latitude,
                added.longitude,
                translation
            );
        }

        return this.pointEditingService.getDisplayedCoordinate(
            this.source,
            this.pointEdits,
            identity,
            translation
        );
    }

    #renderSelectedPoint(coordinate = null) {

        this.#removeSelectedPointLayer();
        if (!this.pointEditingMode || !this.pointSelection || !this.source) return;

        const selectedKey = this.pointMutationService.key(this.pointSelection);
        const visible = this.editingGeometry.some(segment =>
            segment.trackIndex === this.pointSelection.trackIndex &&
            segment.segmentIndex === this.pointSelection.segmentIndex &&
            segment.vertices.some(vertex =>
                this.pointMutationService.key(vertex.identity) === selectedKey
            )
        );

        if (!visible) {
            this.pointSelection = null;
            this.pointSelectionHandler?.(null);
            return;
        }

        let displayed;

        try {
            displayed = coordinate || this.#displayCoordinate(
                this.pointSelection
            );
        } catch {
            this.pointSelection = null;
            this.pointSelectionHandler?.(null);
            return;
        }

        this.selectedPointLayer = L.circleMarker(
            [displayed.latitude, displayed.longitude],
            {
                ...SELECTED_POINT_STYLE,
                pane: "trailbook-edit-point-selected"
            }
        ).addTo(this.map);
    }

    #removeSelectedPointLayer() {

        this.selectedPointLayer?.remove();
        this.selectedPointLayer = null;
    }

    #setVisible(group, visible) {

        if (!group || !this.map) return;

        const displayed = this.map.hasLayer(group);

        if (visible && !displayed) group.addTo(this.map);
        if (!visible && displayed) group.remove();
    }

    #removeGroup(property) {

        this[property]?.remove();
        this[property] = null;
    }

    #ensurePanes() {

        this.#ensurePane("trailbook-edit-before", 620);
        this.#ensurePane("trailbook-edit-after", 630);
        this.#ensurePane("trailbook-edit-before-points", 640);
        this.#ensurePane("trailbook-edit-after-points", 650);
        this.#ensurePane("trailbook-edit-point-targets", 660);
        this.#ensurePane("trailbook-edit-point-add", 665);
        this.#ensurePane("trailbook-edit-point-selected", 670);
    }

    #ensurePane(name, zIndex) {

        const pane = this.map?.getPane?.(name) || this.map?.createPane?.(name);

        if (pane?.style) {
            pane.style.zIndex = String(zIndex);
            pane.style.pointerEvents = "none";
        }
    }

    #startDrag(event) {

        if (!this.translationMode || !event?.originalEvent) return;

        const originalEvent = event.originalEvent;

        originalEvent.preventDefault?.();
        originalEvent.stopPropagation?.();
        this.dragState = {
            startPoint: this.map.mouseEventToContainerPoint(originalEvent),
            base: this.translation
        };
        document.addEventListener("mousemove", this.#moveDrag);
        document.addEventListener("mouseup", this.#endDrag, { once: true });
    }

    #moveDrag = event => {

        if (!this.dragState) return;

        const endPoint = this.map.mouseEventToContainerPoint(event);
        const next = this.translationService.calculateFromDrag(
            this.map,
            this.dragState.startPoint,
            endPoint,
            this.dragState.base
        );

        this.translation = next;
        this.setCandidate(this.source, this.retainedPointMasks, next);
        this.translationHandler?.(next);
    };

    #endDrag = event => {

        event?.preventDefault?.();
        this.#finishDrag();
    };

    #finishDrag() {

        document.removeEventListener("mousemove", this.#moveDrag);
        document.removeEventListener("mouseup", this.#endDrag);
        this.dragState = null;
    }

    #startPointDrag(identity, event) {

        if (!this.pointEditingMode || !event?.originalEvent) return;

        const originalEvent = event.originalEvent;
        const normalizedIdentity = this.pointMutationService.normalizeIdentity(
            identity
        );
        const initialCoordinate = this.#displayCoordinate(normalizedIdentity);

        originalEvent.preventDefault?.();
        originalEvent.stopPropagation?.();
        this.pointSelection = normalizedIdentity;
        this.pointSelectionHandler?.(normalizedIdentity);
        this.#renderSelectedPoint(initialCoordinate);
        this.pointDragState = {
            identity: normalizedIdentity,
            startPoint: this.map.mouseEventToContainerPoint(originalEvent),
            initialCoordinate,
            coordinate: initialCoordinate,
            wasDraggingEnabled: Boolean(this.map?.dragging?.enabled?.())
        };
        this.map?.dragging?.disable?.();
        document.addEventListener("mousemove", this.#movePointDrag);
        document.addEventListener("mouseup", this.#endPointDrag, { once: true });
    }

    #movePointDrag = event => {

        const state = this.pointDragState;

        if (!state) return;

        const endPoint = this.map.mouseEventToContainerPoint(event);
        const coordinate = this.pointEditingService.calculateFromDrag(
            this.map,
            state.startPoint,
            endPoint,
            state.initialCoordinate
        );

        state.coordinate = coordinate;
        this.selectedPointLayer?.setLatLng?.([
            coordinate.latitude,
            coordinate.longitude
        ]);
        this.#updateDraggedSegment(state.identity, coordinate);
    };

    #endPointDrag = event => {

        event?.preventDefault?.();
        const state = this.pointDragState;

        this.#finishPointDrag();
        if (!state) return;

        if (this.pointEditingService.coordinatesEqual(
            state.initialCoordinate,
            state.coordinate
        )) {
            this.#renderSelectedPoint(state.initialCoordinate);
            return;
        }

        const accepted = this.pointEditHandler?.(
            state.identity,
            state.coordinate
        );

        if (accepted === false) {
            this.setCandidate(
                this.source,
                this.retainedPointMasks,
                this.translation,
                this.pointEdits
            );
        }
    };

    #finishPointDrag() {

        const state = this.pointDragState;

        document.removeEventListener("mousemove", this.#movePointDrag);
        document.removeEventListener("mouseup", this.#endPointDrag);
        this.pointDragState = null;
        if (state?.wasDraggingEnabled) this.map?.dragging?.enable?.();
    }

    #updateDraggedSegment(identity, coordinate) {

        const key = this.pointMutationService.key(identity);
        const target = this.afterPointLines.get(key);

        if (!target?.line?.setLatLngs) return;

        const latLngs = target.vertices.map(vertex => {
            const candidateIdentity = vertex.identity;
            const displayed = this.pointMutationService.key(candidateIdentity) === key
                ? coordinate
                : this.#displayCoordinate(candidateIdentity);

            return [displayed.latitude, displayed.longitude];
        });

        target.line.setLatLngs(latLngs);
    }

    #isValidPoint(point) {

        return Number.isFinite(point?.latitude) &&
            Number.isFinite(point?.longitude) &&
            point.latitude >= -90 && point.latitude <= 90 &&
            point.longitude >= -180 && point.longitude <= 180;
    }
}

export {
    AFTER_POINT_STYLE,
    AFTER_STYLE,
    BEFORE_POINT_STYLE,
    BEFORE_STYLE,
    POINT_EDIT_TARGET_STYLE,
    POINT_MODES,
    PREVIEW_MODES
};
