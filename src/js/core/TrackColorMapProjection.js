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
        this.lastConvergenceDiagnostic = Object.freeze({
            totalTrackCount: 0,
            staleTrackCount: 0,
            displayMutationCount: 0,
            notificationCount: 0,
            mapStyleUpdateCount: 0,
            geometryLoadCount: 0,
            resolutionMs: 0,
            propagationMs: 0,
            totalMs: 0
        });
        this.pendingMapStyleUpdateCount = 0;
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
        const startedAt = performance.now();
        const colors = new Map();

        this.displayState.getDisplays().forEach(display => {
            colors.set(display.path, resolveColor(display.path));
        });
        const resolvedAt = performance.now();

        this.pendingMapStyleUpdateCount = 0;
        const changedPaths = this.displayState.setColors(colors);
        const completedAt = performance.now();

        this.lastConvergenceDiagnostic = Object.freeze({
            totalTrackCount: colors.size,
            staleTrackCount: changedPaths.length,
            displayMutationCount: changedPaths.length,
            notificationCount: changedPaths.length > 0 ? 1 : 0,
            mapStyleUpdateCount: this.pendingMapStyleUpdateCount,
            geometryLoadCount: 0,
            resolutionMs: resolvedAt - startedAt,
            propagationMs: completedAt - resolvedAt,
            totalMs: completedAt - startedAt
        });
        return changedPaths.length;
    }

    getLastConvergenceDiagnostic() {

        return this.lastConvergenceDiagnostic;
    }

    #project({ path, display, change, paths = [] } = {}) {

        if (change === "colors") {
            const updated = paths.reduce((count, candidate) => {
                const candidateDisplay = this.displayState.getDisplay(candidate);

                if (!candidateDisplay?.color ||
                    !this.mapView.hasDisplay(candidate)) return count;
                const layerUpdates = this.mapView.updateTrackColor(
                    candidate,
                    this.getStyles(candidateDisplay.color)
                );

                return count + (layerUpdates > 0 ? 1 : 0);
            }, 0);

            this.pendingMapStyleUpdateCount += updated;
            return updated;
        }

        if (change !== "color" || !path || !display?.color ||
            !this.mapView.hasDisplay(path)) return 0;

        const updated = this.mapView.updateTrackColor(
            path,
            this.getStyles(display.color)
        );

        this.pendingMapStyleUpdateCount += updated > 0 ? 1 : 0;
        return updated;
    }
}
