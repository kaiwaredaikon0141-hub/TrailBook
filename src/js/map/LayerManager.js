const FIT_PADDING = [20, 20];

/**
 * Manages Leaflet layers created from a parsed GPX result.
 */
export default class LayerManager {

    /**
     * Creates a Leaflet layer manager.
        *
        * @param {object} map
        * @param {object} mapConfig
     */
    constructor(map, mapConfig) {

        this.map = map;

        this.mapConfig = mapConfig;

        this.layerGroup = null;

        this.bounds = [];
    }

    /**
     * Displays all tracks and waypoints in a parsed result.
     *
     * @param {object} result
     * @returns {void}
     */
    display(result) {

        this.clear();

        this.layerGroup = L.layerGroup().addTo(this.map);

        result.tracks.forEach(track => {

            track.segments.forEach(segment => {

                const latLngs = segment.points.map(point => {

                    const latLng = [point.latitude, point.longitude];

                    this.bounds.push(latLng);

                    return latLng;
                });

                if (latLngs.length > 0) {

                    L.polyline(latLngs, this.mapConfig.trackStyle)
                        .addTo(this.layerGroup);
                }
            });
        });

        result.waypoints.forEach(waypoint => {

            L.marker([waypoint.latitude, waypoint.longitude])
                .addTo(this.layerGroup);
        });

        this.#fitBounds();
    }

    /**
     * Removes the currently displayed layers and bounds.
     *
     * @returns {void}
     */
    clear() {

        if (this.layerGroup) {

            this.layerGroup.remove();
        }

        this.layerGroup = null;

        this.bounds = [];
    }

    /**
     * Refocuses the map on the current Track bounds.
     *
     * @returns {void}
     */
    refocus() {

        this.#fitBounds();
    }

    /**
     * Reports whether a GPX layer is currently displayed.
     *
     * @returns {boolean}
     */
    hasDisplay() {

        return Boolean(this.layerGroup);
    }

    #fitBounds() {

        if (this.bounds.length >= 2) {

            this.map.fitBounds(this.bounds, {
                padding: FIT_PADDING
            });

            return;
        }

        if (this.bounds.length === 1) {

            this.map.setView(
                this.bounds[0],
                this.mapConfig.singlePointZoom
            );
        }
    }

}