const FIT_PADDING = [20, 20];

/**
 * Manages independent Leaflet layers for displayed GPX files.
 */
export default class LayerManager {

    constructor(map, mapConfig) {

        this.map = map;
        this.mapConfig = mapConfig;
        this.layers = new Map();
    }

    displayGPX(path, result, style) {

        this.removeGPX(path);

        const layerGroup = L.layerGroup().addTo(this.map);
        const bounds = [];
        const trackStyle = style || this.mapConfig.trackStyle;

        result.tracks.forEach(track => {
            track.segments.forEach(segment => {
                const latLngs = segment.points.map(point => {
                    const latLng = [point.latitude, point.longitude];
                    bounds.push(latLng);
                    return latLng;
                });

                if (latLngs.length > 0) {
                    L.polyline(latLngs, trackStyle).addTo(layerGroup);
                }
            });
        });

        result.waypoints.forEach(waypoint => {
            L.marker([waypoint.latitude, waypoint.longitude])
                .addTo(layerGroup);
        });

        this.layers.set(path, {
            layerGroup,
            bounds,
            color: trackStyle.color || trackStyle.lineColor || null
        });
    }

    removeGPX(path) {

        const entry = this.layers.get(path);

        if (entry) {
            entry.layerGroup.remove();
            this.layers.delete(path);
        }
    }

    clear() {

        this.layers.forEach(entry => entry.layerGroup.remove());
        this.layers.clear();
    }

    refocus() {

        this.#fitBounds(this.#allBounds());
    }

    refocusGPX(path) {

        const bounds = this.layers.get(path)?.bounds || [];

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

    #allBounds() {

        return [...this.layers.values()].flatMap(entry => entry.bounds);
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
