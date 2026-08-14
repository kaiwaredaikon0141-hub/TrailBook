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

    constructor(map) {

        this.map = map;
        this.source = null;
        this.retainedPointMasks = null;
        this.beforeLayerGroup = null;
        this.afterLayerGroup = null;
        this.beforePointLayerGroup = null;
        this.afterPointLayerGroup = null;
        this.mode = "both";
        this.pointMode = "off";
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

    setCandidate(source, retainedPointMasks) {

        this.source = source;
        this.retainedPointMasks = retainedPointMasks;
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.afterLayerGroup = this.#createLineGroup(
            source,
            retainedPointMasks,
            AFTER_STYLE,
            "trailbook-edit-after"
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

    clear() {

        this.#removeGroup("beforeLayerGroup");
        this.#removeGroup("afterLayerGroup");
        this.#removeGroup("beforePointLayerGroup");
        this.#removeGroup("afterPointLayerGroup");
        this.source = null;
        this.retainedPointMasks = null;
    }

    #createLineGroup(source, masks, style, pane) {

        const group = L.layerGroup();

        this.#segments(source, masks).forEach(latLngs => {
            L.polyline(latLngs, { ...style, pane }).addTo(group);
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

                    L.circleMarker([point.latitude, point.longitude], {
                        ...style,
                        pane,
                        renderer: this.pointRenderer
                    }).addTo(group);
                });
            });
        });

        return group;
    }

    #segments(source, masks) {

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

                    current.push([point.latitude, point.longitude]);
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
