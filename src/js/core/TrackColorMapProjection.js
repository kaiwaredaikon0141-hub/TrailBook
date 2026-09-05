/** Projects DisplayState color changes onto existing Map layers. */
export default class TrackColorMapProjection {

    constructor({ displayState, mapView, getStyles } = {}) {

        if (!displayState?.subscribe || !mapView ||
            typeof getStyles !== "function") {
            throw new TypeError("Track color Map projection dependencies are required.");
        }
        this.mapView = mapView;
        this.displayState = displayState;
        this.getStyles = getStyles;
        this.unsubscribe = displayState.subscribe(change =>
            this.#project(change)
        );
    }

    destroy() {

        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    converge(resolveColor) {

        if (typeof resolveColor !== "function") {
            throw new TypeError("A current Track color resolver is required.");
        }
        let changed = 0;

        this.displayState.getDisplays().forEach(display => {
            if (this.displayState.setColor(
                display.path,
                resolveColor(display.path)
            )) changed += 1;
        });
        return changed;
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
