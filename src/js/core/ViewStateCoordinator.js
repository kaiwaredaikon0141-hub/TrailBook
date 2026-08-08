import { createDefaultLibraryViewState } from "../utils/ViewStateSchema.js";

/**
 * Coordinates device-local view snapshots without replacing runtime state.
 */
export default class ViewStateCoordinator {

    constructor({
        eventBus,
        store,
        mapView,
        controls,
        debounceMs = 750,
        setTimer = globalThis.setTimeout.bind(globalThis),
        clearTimer = globalThis.clearTimeout.bind(globalThis)
    }) {

        this.eventBus = eventBus;
        this.store = store;
        this.mapView = mapView;
        this.controls = controls;
        this.debounceMs = debounceMs;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.activeLibraryId = null;
        this.activeLibraryGeneration = null;
        this.isCurrentLibrary = () => false;
        this.timerId = null;
        this.pendingSave = false;
        this.restoring = false;
        this.resetBlocked = false;
        this.#bindEvents();
    }

    flush() {

        this.#cancelTimer();

        if (!this.pendingSave || this.restoring || this.resetBlocked) {
            return false;
        }

        this.pendingSave = false;

        return this.#saveSnapshot();
    }

    restoreLibrary({ libraryId, libraryName, generation, isCurrent }) {

        if (!isCurrent()) {
            return false;
        }

        this.flush();
        this.#cancelTimer();
        this.pendingSave = false;
        this.activeLibraryId = libraryId;
        this.activeLibraryGeneration = generation;
        this.isCurrentLibrary = isCurrent;
        this.resetBlocked = false;

        this.restoring = true;
        const state = this.store.getLibraryState(libraryId);

        this.controls.setLibrary({
            name: libraryName,
            hasState: Boolean(state)
        });
        this.controls.setSidebarOpen(state?.sidebar.open ?? true, {
            notifyLayout: false
        });
        this.mapView.invalidateSize({ silent: true });

        if (state?.map && this.mapView.isValidViewState(state.map)) {
            this.mapView.setViewState(state.map, {
                animate: false,
                silent: true
            });
        }

        this.restoring = false;

        return this.#isCurrent(generation);
    }

    getStatus() {

        return {
            activeLibraryId: this.activeLibraryId,
            generation: this.activeLibraryGeneration,
            pendingSave: this.pendingSave,
            restoring: this.restoring,
            resetBlocked: this.resetBlocked
        };
    }

    #bindEvents() {

        this.eventBus.on("map:view-changed", ({ programmatic = false } = {}) => {
            if (!programmatic) {
                this.#scheduleSave();
            }
        });
        this.eventBus.on("view-state:sidebar-toggled", () => {
            this.#scheduleSave();
        });
        this.eventBus.on("view-state:sidebar-layout-changed", () => {
            this.mapView.invalidateSize({ silent: true });
        });
        this.eventBus.on("view-state:reset-requested", () => {
            this.#resetCurrentLibrary();
        });
    }

    #scheduleSave() {

        if (
            this.restoring ||
            !this.activeLibraryId
        ) {
            return;
        }

        this.resetBlocked = false;
        this.pendingSave = true;
        this.#cancelTimer();
        this.timerId = this.setTimer(() => {
            this.timerId = null;
            this.flush();
        }, this.debounceMs);
    }

    #saveSnapshot() {

        if (!this.activeLibraryId) {
            return false;
        }

        const existing = this.store.getLibraryState(this.activeLibraryId) ??
            createDefaultLibraryViewState();
        const saved = this.store.setLibraryState(this.activeLibraryId, {
            ...existing,
            map: this.mapView.getViewState(),
            sidebar: { open: this.controls.isSidebarOpen() }
        });

        if (saved) {
            this.controls.setStoredStateAvailable(true);
        }

        return saved;
    }

    #resetCurrentLibrary() {

        if (
            !this.activeLibraryId ||
            !this.store.hasLibraryState(this.activeLibraryId) ||
            !this.controls.confirmReset()
        ) {
            return false;
        }

        this.#cancelTimer();
        this.pendingSave = false;

        if (!this.store.removeLibraryState(this.activeLibraryId)) {
            return false;
        }

        this.resetBlocked = true;
        this.controls.setStoredStateAvailable(false);

        return true;
    }

    #cancelTimer() {

        if (this.timerId !== null) {
            this.clearTimer(this.timerId);
            this.timerId = null;
        }
    }

    #isCurrent(generation) {

        return generation === this.activeLibraryGeneration &&
            this.isCurrentLibrary();
    }
}
