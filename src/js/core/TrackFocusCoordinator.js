/** Keeps temporary map emphasis tied to the current selected, displayed Track. */
export default class TrackFocusCoordinator {

    constructor({ eventBus, mapView, selectionState, displayState, view }) {
        Object.assign(this, {
            eventBus, mapView, selectionState, displayState, view
        });
        view.setFocusToggleHandler(() => this.toggle());
        eventBus.on("map:track-focus-toggle-requested", () => this.toggle());
        eventBus.on("map:track-focus-changed", () => this.refresh());
        eventBus.on("selection:changed", () => this.clear());
        eventBus.on("library:source-changed", () => this.clear());
        displayState.subscribe(() => this.refresh());
        this.refresh();
    }

    toggle() {
        const path = this.selectionState.getSelectedPath();
        if (!this.#available(path)) return false;
        return this.mapView.setFocusedPath(
            this.mapView.getFocusedPath() === path ? null : path
        );
    }

    clear() {
        this.mapView.setFocusedPath(null);
        this.refresh();
    }

    refresh() {
        const path = this.selectionState.getSelectedPath();
        const available = this.#available(path);
        if (!available && this.mapView.getFocusedPath()) {
            this.mapView.setFocusedPath(null);
            return;
        }
        const active = available && this.mapView.getFocusedPath() === path;
        this.view.setFocusPresentation(available, active);
        this.mapView.setTrackFocusControlPresentation(available, active);
    }

    #available(path) {
        const display = path && this.displayState.getDisplay(path);
        return Boolean(display?.checked && display.state === "loaded" &&
            this.mapView.hasDisplay(path));
    }
}
