const FIT_PADDING = [20, 20];

/**
 * Manages independent Track and Waypoint layers for displayed GPX files.
 */
export default class LayerManager {

    constructor(map, mapConfig) {

        this.map = map;
        this.mapConfig = mapConfig;
        this.layers = new Map();
    }

    displayGPX(path, result, style, options = {}) {

        this.removeGPX(path);

        const trackLayerGroup = L.layerGroup().addTo(this.map);
        const trackBounds = [];
        const trackStyle = style || this.mapConfig.trackStyle;

        result.tracks.forEach(track => {
            track.segments.forEach(segment => {
                const latLngs = segment.points.map(point => {
                    const latLng = [point.latitude, point.longitude];
                    trackBounds.push(latLng);
                    return latLng;
                });

                if (latLngs.length > 0) {
                    L.polyline(latLngs, trackStyle).addTo(trackLayerGroup);
                }
            });
        });

        this.layers.set(path, {
            trackLayerGroup,
            waypointLayerGroup: null,
            trackBounds,
            color: trackStyle.color || trackStyle.lineColor || null,
            waypointCount: result.waypoints.length
        });

        if (options.showWaypoints) {
            this.addWaypoints(path, result);
        }
    }

    addWaypoints(path, result) {

        const entry = this.layers.get(path);

        if (!entry || entry.waypointLayerGroup || result.waypoints.length === 0) {
            return;
        }

        const waypointLayerGroup = L.layerGroup().addTo(this.map);

        result.waypoints.forEach(waypoint => {
            L.marker([waypoint.latitude, waypoint.longitude])
                .addTo(waypointLayerGroup);
        });

        entry.waypointLayerGroup = waypointLayerGroup;
    }

    removeWaypoints(path) {

        const entry = this.layers.get(path);

        if (!entry?.waypointLayerGroup) {
            return;
        }

        entry.waypointLayerGroup.remove();
        entry.waypointLayerGroup = null;
    }

    removeGPX(path) {

        const entry = this.layers.get(path);

        if (!entry) {
            return;
        }

        entry.trackLayerGroup.remove();
        entry.waypointLayerGroup?.remove();
        this.layers.delete(path);
    }

    clear() {

        this.layers.forEach(entry => {
            entry.trackLayerGroup.remove();
            entry.waypointLayerGroup?.remove();
        });

        this.layers.clear();
    }

    refocus() {

        this.#fitBounds(this.#allBounds());
    }

    refocusGPX(path) {

        const bounds = this.layers.get(path)?.trackBounds || [];

        if (bounds.length === 0) {
            return;
        }

        this.#fitBounds(bounds);
    }

    hasDisplay(path) {

        if (path !== undefined) {
            return this.layers.has(path);
        }

        return this.layers.size > 0;
    }

    getDisplayedPaths() {

        return [...this.layers.keys()];
    }

    updateTrackWeights(weight) {

        if (!Number.isFinite(weight) || weight <= 0) {
            return 0;
        }

        let updatedCount = 0;

        this.layers.forEach(entry => {
            entry.trackLayerGroup.eachLayer(layer => {
                if (typeof layer?.setStyle !== "function") {
                    return;
                }

                layer.setStyle({ weight });
                updatedCount += 1;
            });
        });

        return updatedCount;
    }

    #allBounds() {

        return [...this.layers.values()].flatMap(entry => entry.trackBounds);
    }

    #fitBounds(bounds) {

        if (bounds.length >= 2) {
            this.map.fitBounds(bounds, { padding: FIT_PADDING });
            return;
        }

        if (bounds.length === 1) {
            this.map.setView(bounds[0], this.mapConfig.singlePointZoom);
            return;
        }

        this.map.setView(
            [
                this.mapConfig.center.latitude,
                this.mapConfig.center.longitude
            ],
            this.mapConfig.initialZoom
        );
    }
}
