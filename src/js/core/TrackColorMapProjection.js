/** Projects DisplayState color changes onto existing Map layers. */
export default class TrackColorMapProjection {

    constructor({ displayState, mapView, getStyles } = {}) {

        if (!displayState?.subscribe || !mapView ||
            typeof getStyles !== "function") {
            throw new TypeError("Track color Map projection dependencies are required.");
        }
        this.mapView = mapView;
        this.getStyles = getStyles;
        this.unsubscribe = displayState.subscribe(change =>
            this.#project(change)
        );
    }

    destroy() {

        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    #project({ path, display, change } = {}) {

        if (change !== "color" || !path || !display?.color ||
            !this.mapView.hasDisplay(path)) return 0;

        return this.mapView.updateTrackColor(
            path,
            this.getStyles(display.color)
        );
    }
}
