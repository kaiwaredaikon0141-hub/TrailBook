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

/**
 * Owns Editor-only line and point layers outside the normal LayerManager.
 */
export default class EditingPreviewLayerManager {

    constructor(map, {
        translationService = new TrackTranslationService()
    } = {}) {

        this.map = map;
        this.source = null;
        this.retainedPointMasks = null;
        this.beforeLayerGroup = null;
        this.afterLayerGroup = null;
        this.beforePointLayerGroup = null;
        this.afterPointLayerGroup = null;
        this.mode = "both";
        this.pointMode = "off";
        this.translation = ZERO_TRACK_TRANSLATION;
        this.translationMode = false;
        this.translationHandler = null;
        this.dragState = null;
        this.translationService = translationService;
        this.wasDraggingEnabled = false;
        this.pointRenderer = L.canvas({
            padding: 0.5,
            pane: "trailbook-edit-after-points"
        });
        this.#ensurePanes();
    }

    setSource(source) {

        this.source = source;
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
        translation = this.translation
    ) {

        this.source = source;
        this.retainedPointMasks = retainedPointMasks;
        this.translation = this.translationService.normalize(translation);
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.afterLayerGroup = this.#createLineGroup(
            source,
            retainedPointMasks,
            AFTER_STYLE,
            "trailbook-edit-after",
            this.translation
        );
        this.#applyMode();
        this.#applyPointMode();
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

    setTranslation(value) {

        this.translation = this.translationService.normalize(value);
        if (!this.source) return;

        this.setCandidate(
            this.source,
            this.retainedPointMasks,
            this.translation
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
                this.translation
            );
        }
        return true;
    }

    clear() {

        this.setTranslationMode(false);
        this.#removeGroup("beforeLayerGroup");
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("beforePointLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.source = null;
        this.retainedPointMasks = null;
        this.translation = ZERO_TRACK_TRANSLATION;
    }

    #createLineGroup(source, masks, style, pane, translation = null) {

        const group = L.layerGroup();

        this.#segments(source, masks, translation).forEach(latLngs => {
            const line = L.polyline(latLngs, {
                ...style,
                pane,
                interactive: Boolean(translation && this.translationMode)
            }).addTo(group);

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
                        ? this.translationService.translateCoordinate(
                            point.latitude,
                            point.longitude,
                            this.translation
                        )
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

                segment.points.forEach((point, pointIndex) => {
                    if (mask && !mask[pointIndex]) return;

                    if (!this.#isValidPoint(point)) {
                        if (current.length > 0) segments.push(current);
                        current = [];
                        return;
                    }

                    const coordinate = translation
                        ? this.translationService.translateCoordinate(
                            point.latitude,
                            point.longitude,
                            translation
                        )
                        : { latitude: point.latitude, longitude: point.longitude };

                    current.push([coordinate.latitude, coordinate.longitude]);
                });

                if (current.length > 0) segments.push(current);
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
    POINT_MODES,
    PREVIEW_MODES
};
import TrackTranslationService, {
    ZERO_TRACK_TRANSLATION
} from "../services/TrackTranslationService.js";
