import { createDefaultLibraryViewState } from "../utils/ViewStateSchema.js";
import drivePerformance from "../services/DrivePerformanceMonitor.js";

/**
 * Coordinates device-local view snapshots without replacing runtime state.
 */
export default class ViewStateCoordinator {

    constructor({
        eventBus,
        store,
        mapView,
        controls,
        displayState,
        displayQueue,
        selectionState,
        resetPresentation = () => {},
        debounceMs = 750,
        setTimer = globalThis.setTimeout.bind(globalThis),
        clearTimer = globalThis.clearTimeout.bind(globalThis),
        documentTarget = globalThis.document,
        windowTarget = globalThis.window
    }) {

        this.eventBus = eventBus;
        this.store = store;
        this.mapView = mapView;
        this.controls = controls;
        this.displayState = displayState;
        this.displayQueue = displayQueue;
        this.selectionState = selectionState;
        this.resetPresentation = resetPresentation;
        this.debounceMs = debounceMs;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.documentTarget = documentTarget;
        this.windowTarget = windowTarget;
        this.activeLibraryId = null;
        this.activeLibraryGeneration = null;
        this.isCurrentLibrary = () => false;
        this.timerId = null;
        this.pendingSave = false;
        this.restoring = false;
        this.resetBlocked = false;
        this.restoreRequestId = 0;
        this.mapChangedDuringRestore = false;
        this.selectionChangedDuringRestore = false;
        this.saveAfterRestore = false;
        this.#bindEvents();
        this.#bindLifecycle();
        this.mapView.setBaseMap?.(this.store.getBaseMap?.() ?? "osm");
    }

    flush() {

        this.#cancelTimer();

        if (!this.pendingSave || this.restoring || this.resetBlocked) {
            return false;
        }

        this.pendingSave = false;

        return this.#saveSnapshot();
    }

    async restoreLibrary({
        libraryId,
        libraryName,
        generation,
        isCurrent,
        persistent = true
    }) {

        if (!isCurrent()) {
            return false;
        }

        const endDriveRestore = drivePerformance.begin("restoreLifecycleMs");

        drivePerformance.recordComponentCall("ViewStateCoordinator.restoreLibrary");
        drivePerformance.markRestoreProducerStarted(isCurrent);
        drivePerformance.setRestoreGeneration(generation);

        this.flush();
        this.#cancelTimer();
        this.pendingSave = false;
        this.activeLibraryId = persistent ? libraryId : null;
        this.activeLibraryGeneration = generation;
        this.isCurrentLibrary = isCurrent;
        this.resetBlocked = false;
        const restoreRequestId = ++this.restoreRequestId;

        this.restoring = true;
        this.mapChangedDuringRestore = false;
        this.selectionChangedDuringRestore = false;
        this.saveAfterRestore = false;
        const state = persistent ? this.store.getLibraryState(libraryId) : null;

        this.controls.setLibrary({
            name: libraryName,
            hasState: Boolean(state)
        });
        this.controls.setSidebarWidth(
            state?.sidebar?.width ?? this.controls.getDefaultSidebarWidth(),
            {
                emit: false,
                notifyLayout: false
            }
        );
        this.controls.setTrackInfoHeight(
            state?.sidebar?.trackInfoHeight ??
                this.controls.getDefaultTrackInfoHeight(),
            { emit: false }
        );
        this.controls.setSidebarOpen(state?.sidebar?.open ?? true, {
            notifyLayout: false
        });
        this.mapView.invalidateSize({ silent: true });

        const displayChanges = state
            ? this.#resolveDisplayChanges(state.visibleTracks)
            : [];
        const displayGeneration = this.displayState.getLibraryGeneration();
        const expectedEnqueueCount = displayChanges.filter(
            change => change.checked
        ).length;
        drivePerformance.setRestoreGeneration(
            displayGeneration,
            expectedEnqueueCount
        );
        const restoreEnqueuesComplete = this.displayQueue.whenEnqueued?.({
            generation: displayGeneration,
            count: expectedEnqueueCount
        }) ?? Promise.resolve();
        displayChanges.forEach(({ display, checked }) => {
            this.eventBus.emit("gpx:display-toggled", {
                path: display.path,
                fileHandle: display.fileHandle,
                checked,
                preserveMapView: true,
                preserveSelection: true,
                source: "view-state-restore"
            });
        });

        await restoreEnqueuesComplete;
        drivePerformance.markRestoreProducerCompleted(isCurrent);
        await this.displayQueue.whenIdle({ generation: displayGeneration });
        drivePerformance.markDisplayQueueIdle(isCurrent);

        if (
            restoreRequestId !== this.restoreRequestId ||
            !this.#isCurrent(generation)
        ) {
            if (restoreRequestId === this.restoreRequestId) {
                this.restoring = false;
            }
            endDriveRestore();
            return false;
        }

        if (
            !this.mapChangedDuringRestore &&
            state?.map &&
            this.mapView.isValidViewState(state.map)
        ) {
            this.mapView.setViewState(state.map, {
                animate: false,
                silent: true
            });
        }

        if (state) this.#restoreSelection(state);

        this.restoring = false;

        if (this.saveAfterRestore) {
            this.#scheduleSave();
        }

        endDriveRestore();
        return true;
    }

    isRestoring() {

        return this.restoring;
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

    getLibraryMapState(libraryId) {

        return this.store.getLibraryState(libraryId)?.map ?? null;
    }

    detachLibrary() {

        this.#cancelTimer();
        this.restoreRequestId += 1;
        this.pendingSave = false;
        this.restoring = false;
        this.activeLibraryId = null;
        this.activeLibraryGeneration = null;
        this.isCurrentLibrary = () => false;
    }

    #bindEvents() {

        this.eventBus.on("map:view-changed", ({ programmatic = false } = {}) => {
            if (programmatic) {
                return;
            }

            if (this.restoring) {
                this.mapChangedDuringRestore = true;
                this.saveAfterRestore = true;
                return;
            }

            this.#scheduleSave();
        });
        this.eventBus.on("map:base-map-changed", ({ baseMap } = {}) => {
            this.mapView.setBaseMap?.(baseMap);
            this.store.setBaseMap?.(this.mapView.getBaseMap?.());
        });
        this.eventBus.on("view-state:sidebar-toggled", () => {
            this.#handleRuntimeChange();
        });
        this.eventBus.on("view-state:sidebar-width-changed", () => {
            this.#handleRuntimeChange();
        });
        this.eventBus.on("view-state:track-info-height-changed", () => {
            this.#handleRuntimeChange();
        });
        this.eventBus.on("gpx:display-toggled", data => {
            if (data?.source !== "view-state-restore") {
                this.#handleRuntimeChange();
            }
        });
        this.eventBus.on("folder:display-toggled", () => {
            this.#handleRuntimeChange();
        });
        this.eventBus.on("map:clear-requested", () => {
            this.#handleRuntimeChange();
        });
        this.eventBus.on("selection:changed", ({ reason } = {}) => {
            if (
                reason === "view-state-restore" ||
                reason === "library-switch"
            ) {
                return;
            }

            if (this.restoring) {
                this.selectionChangedDuringRestore = true;
            }
            this.#handleRuntimeChange();
        });
        this.eventBus.on("view-state:sidebar-layout-changed", () => {
            this.mapView.invalidateSize({ silent: true });
        });
        this.eventBus.on("view-state:reset-requested", () => {
            this.#resetCurrentLibrary();
        });
    }

    #bindLifecycle() {

        this.documentTarget?.addEventListener?.("visibilitychange", () => {
            if (this.documentTarget.visibilityState === "hidden") {
                this.flush();
            }
        });
        this.windowTarget?.addEventListener?.("pagehide", () => this.flush());
    }

    #handleRuntimeChange() {

        if (this.restoring) {
            this.saveAfterRestore = true;
            return;
        }

        this.#scheduleSave();
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
            visibleTracks: this.displayState.getCheckedPaths(),
            selectedTrack: this.selectionState.getSelectedPath(),
            sidebar: {
                open: this.controls.isSidebarOpen(),
                width: this.controls.getSidebarWidth(),
                trackInfoHeight: this.controls.getTrackInfoHeight()
            }
        });

        if (saved) {
            this.controls.setStoredStateAvailable(true);
        }

        return saved;
    }

    #resolveDisplayChanges(paths) {

        const desiredPaths = new Set(paths);
        const displayedPaths = new Set(
            this.mapView.getDisplayedPaths?.() ?? []
        );
        const changes = [];

        this.displayState.getDisplays().forEach(display => {
            const desired = desiredPaths.has(display.path);
            const displayed = displayedPaths.has(display.path);

            if (desired !== display.checked || (!desired && displayed)) {
                changes.push({ display, checked: desired });
            }
        });

        return changes.sort((first, second) =>
            Number(first.checked) - Number(second.checked));
    }

    #restoreSelection(state) {

        const path = state?.selectedTrack;
        const previousPath = this.selectionState.getSelectedPath();

        if (
            this.selectionChangedDuringRestore ||
            !path ||
            !state.visibleTracks.includes(path)
        ) {
            if (!this.selectionChangedDuringRestore && previousPath) {
                const change = this.selectionState.clear("system");
                if (change) this.eventBus.emit("selection:changed", {
                    path: null,
                    previousPath: change.previousPath,
                    reason: "view-state-restore"
                });
            }
            return false;
        }

        const display = this.displayState.getDisplay(path);

        if (
            !display?.checked ||
            display.state !== "loaded" ||
            !this.mapView.hasDisplay(path)
        ) {
            return false;
        }

        const change = this.selectionState.select(path, "system");

        if (!change) {
            return false;
        }

        this.eventBus.emit("selection:changed", {
            path: change.selectedPath,
            previousPath: change.previousPath,
            reason: "view-state-restore"
        });

        return true;
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
        this.resetPresentation();
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
