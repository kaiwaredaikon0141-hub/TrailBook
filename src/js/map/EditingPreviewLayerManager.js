import TrackPointEditingService from "../services/TrackPointEditingService.js";
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

/**
 * Owns Editor-only line and point layers outside the normal LayerManager.
 */
export default class EditingPreviewLayerManager {

    constructor(map, {
        translationService = new TrackTranslationService(),
        pointEditingService = new TrackPointEditingService({
            translationService
        })
    } = {}) {

        this.map = map;
        this.source = null;
        this.retainedPointMasks = null;
        this.beforeLayerGroup = null;
        this.afterLayerGroup = null;
        this.beforePointLayerGroup = null;
        this.afterPointLayerGroup = null;
        this.pointEditLayerGroup = null;
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
        this.pointEdits = [];
        this.pointEditingMode = false;
        this.pointSelection = null;
        this.pointSelectionHandler = null;
        this.pointEditHandler = null;
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
    }

    setSource(source) {

        this.source = source;
        this.clearPointSelection();
        this.#removeGroup("beforeLayerGroup");
        this.#removeGroup("beforePointLayerGroup");
        this.beforeLayerGroup = this.#createLineGroup(
            source,
            null,
            BEFORE_STYLE,
            "trailbook-edit-before"
        );
        this.#applyMode();
        this.#applyPointMode();
    }

    setCandidate(
        source,
        retainedPointMasks,
        translation = this.translation,
        pointEdits = this.pointEdits
    ) {

        this.source = source;
        this.retainedPointMasks = retainedPointMasks;
        this.translation = this.translationService.normalize(translation);
        this.pointEdits = this.pointEditingService.normalizeEdits(pointEdits);
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.#removeGroup("pointEditLayerGroup");
        this.#removeSelectedPointLayer();
        this.afterSegmentLayers.clear();
        this.afterPointLines.clear();
        this.afterLayerGroup = this.#createLineGroup(
            source,
            retainedPointMasks,
            AFTER_STYLE,
            "trailbook-edit-after",
            this.translation
        );
        this.#applyMode();
        this.#applyPointMode();
        this.#applyPointEditingMode();
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

    setPointEditingMode(enabled) {

        const next = Boolean(enabled);

        if (next === this.pointEditingMode) return true;
        if (next) this.setTranslationMode(false);
        this.#finishPointDrag();
        this.pointEditingMode = next;
        this.#applyPointEditingMode();
        return true;
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
            this.pointEdits
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
                this.pointEdits
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
        this.#removeSelectedPointLayer();
        this.source = null;
        this.retainedPointMasks = null;
        this.translation = ZERO_TRACK_TRANSLATION;
        this.pointEdits = [];
        this.pointSelection = null;
        this.afterSegmentLayers.clear();
        this.afterPointLines.clear();
    }

    #createLineGroup(source, masks, style, pane, translation = null) {

        const group = L.layerGroup();

        this.#segments(source, masks, translation).forEach(segment => {
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
                segment.pointIndices.forEach(pointIndex => {
                    this.afterPointLines.set(
                        `${segment.trackIndex}/${segment.segmentIndex}/${pointIndex}`,
                        { line, pointIndices: segment.pointIndices }
                    );
                });
            }

            if (translation && this.translationMode) {
                line.on("mousedown", event => this.#startDrag(event));
            }
        });

        return group;
    }

    #createPointGroup(source, masks, style, pane) {

        const group = L.layerGroup();

        source.tracks.forEach((track, trackIndex) => {
            track.segments.forEach((segment, segmentIndex) => {
                const mask = masks?.[trackIndex]?.[segmentIndex] || null;

                segment.points.forEach((point, pointIndex) => {
                    if (mask && !mask[pointIndex]) return;
                    if (!this.#isValidPoint(point)) return;

                    const coordinate = pane === "trailbook-edit-after-points"
                        ? this.#displayCoordinate({
                            trackIndex,
                            segmentIndex,
                            pointIndex
                        })
                        : { latitude: point.latitude, longitude: point.longitude };

                    L.circleMarker([coordinate.latitude, coordinate.longitude], {
                        ...style,
                        pane,
                        renderer: this.pointRenderer
                    }).addTo(group);
                });
            });
        });

        return group;
    }

    #segments(source, masks, translation = null) {

        const segments = [];

        source.tracks.forEach((track, trackIndex) => {
            track.segments.forEach((segment, segmentIndex) => {
                const mask = masks?.[trackIndex]?.[segmentIndex] || null;
                let current = [];
                let pointIndices = [];

                segment.points.forEach((point, pointIndex) => {
                    if (mask && !mask[pointIndex]) return;

                    if (!this.#isValidPoint(point)) {
                        if (current.length > 0) {
                            segments.push({
                                trackIndex,
                                segmentIndex,
                                latLngs: current,
                                pointIndices
                            });
                        }
                        current = [];
                        pointIndices = [];
                        return;
                    }

                    const coordinate = translation
                        ? this.#displayCoordinate({
                            trackIndex,
                            segmentIndex,
                            pointIndex
                        }, translation)
                        : { latitude: point.latitude, longitude: point.longitude };

                    current.push([coordinate.latitude, coordinate.longitude]);
                    pointIndices.push(pointIndex);
                });

                if (current.length > 0) {
                    segments.push({
                        trackIndex,
                        segmentIndex,
                        latLngs: current,
                        pointIndices
                    });
                }
            });
        });

        return segments;
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

        const before = this.pointMode === "before" || this.pointMode === "both";
        const after = this.pointMode === "after" || this.pointMode === "both";

        if (before && !this.beforePointLayerGroup && this.source) {
            this.beforePointLayerGroup = this.#createPointGroup(
                this.source,
                null,
                BEFORE_POINT_STYLE,
                "trailbook-edit-before-points"
            );
        }
        if (after && !this.afterPointLayerGroup && this.source) {
            this.afterPointLayerGroup = this.#createPointGroup(
                this.source,
                this.retainedPointMasks,
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
        this.#renderSelectedPoint();
    }

    #createPointEditGroup() {

        const group = L.layerGroup();

        this.source.tracks.forEach((track, trackIndex) => {
            track.segments.forEach((segment, segmentIndex) => {
                const mask = this.retainedPointMasks?.[trackIndex]
                    ?.[segmentIndex] || null;

                segment.points.forEach((point, pointIndex) => {
                    if (mask && !mask[pointIndex]) return;
                    if (!this.#isValidPoint(point)) return;

                    const identity = { trackIndex, segmentIndex, pointIndex };
                    const coordinate = this.#displayCoordinate(identity);
                    const marker = L.circleMarker(
                        [coordinate.latitude, coordinate.longitude],
                        {
                            ...POINT_EDIT_TARGET_STYLE,
                            pane: "trailbook-edit-point-targets",
                            renderer: this.pointEditRenderer
                        }
                    ).addTo(group);

                    marker.on("mousedown", event => {
                        this.#startPointDrag(identity, event);
                    });
                });
            });
        });

        return group;
    }

    #displayCoordinate(identity, translation = this.translation) {

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

        const displayed = coordinate || this.#displayCoordinate(
            this.pointSelection
        );

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
        const normalizedIdentity = this.pointEditingService.normalizeIdentity(
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

        const key = this.pointEditingService.key(identity);
        const target = this.afterPointLines.get(key);

        if (!target?.line?.setLatLngs) return;

        const latLngs = target.pointIndices.map(pointIndex => {
            const candidateIdentity = {
                trackIndex: identity.trackIndex,
                segmentIndex: identity.segmentIndex,
                pointIndex
            };
            const displayed = pointIndex === identity.pointIndex
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
