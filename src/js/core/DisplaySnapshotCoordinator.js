const DEFAULT_COLOR = "#e53935";

function now() {

    return globalThis.performance?.now?.() ?? Date.now();
}

function reportDevelopmentMetrics(metrics) {

    const hostname = globalThis.location?.hostname;

    if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
        console.info("[TrailBook Startup]", metrics);
    }
}

/**
 * Restores cached drawing geometry before Library discovery, then records the
 * last successfully displayed state for the next process start.
 */
export default class DisplaySnapshotCoordinator {

    constructor({
        eventBus,
        store,
        repository,
        mapView,
        controls,
        displayState,
        selectionState,
        getTrackStyle,
        getSelectionStyles,
        debounceMs = 750,
        setTimer = globalThis.setTimeout.bind(globalThis),
        clearTimer = globalThis.clearTimeout.bind(globalThis),
        documentTarget = globalThis.document,
        windowTarget = globalThis.window,
        reportMetrics = reportDevelopmentMetrics
    }) {

        Object.assign(this, {
            eventBus,
            store,
            repository,
            mapView,
            controls,
            displayState,
            selectionState,
            getTrackStyle,
            getSelectionStyles,
            debounceMs,
            setTimer,
            clearTimer,
            documentTarget,
            windowTarget,
            reportMetrics
        });
        this.libraryIdentity = null;
        this.cacheNamespace = null;
        this.timerId = null;
        this.phaseARestored = false;
        this.metricsReported = false;
        this.startedAt = now();
        this.metrics = {
            appShellReady: 0,
            snapshotLoaded: null,
            geometryRestored: null,
            libraryReady: null,
            restoredTrackCount: 0,
            cacheMissCount: 0
        };
        this.#bindEvents();
    }

    async initialize() {

        const startedAt = this.startedAt;

        this.metrics.appShellReady = 0;
        const snapshot = await this.store.load();
        this.metrics.snapshotLoaded = Math.max(0, now() - startedAt);

        if (!snapshot) {
            return false;
        }

        this.libraryIdentity = snapshot.libraryIdentity;
        this.cacheNamespace = snapshot.cacheNamespace;
        if (this.mapView.isValidViewState(snapshot.map)) {
            this.mapView.setViewState(snapshot.map, {
                animate: false,
                silent: true
            });
        }
        this.#restoreSidebar(snapshot.sidebarState);

        let firstGeometryAt = null;
        const restored = [];

        for (const track of snapshot.visibleTracks) {
            const cached = await this.repository.getDisplaySnapshot(
                track.geometryCacheKey.namespace,
                track.geometryCacheKey.relativePath
            );

            if (!cached) {
                this.metrics.cacheMissCount += 1;
                continue;
            }

            const color = track.displayStyle?.color || DEFAULT_COLOR;

            this.mapView.displayGPX(
                track.relativePath,
                cached.result,
                this.getTrackStyle(color),
                { showWaypoints: false }
            );
            firstGeometryAt ??= now();
            restored.push(track.relativePath);
        }

        this.metrics.restoredTrackCount = restored.length;
        this.metrics.geometryRestored = firstGeometryAt === null
            ? null
            : Math.max(0, firstGeometryAt - startedAt);
        this.phaseARestored = restored.length > 0;

        const selectedPath = snapshot.selectedTrack?.relativePath;

        if (selectedPath && restored.includes(selectedPath)) {
            this.selectionState.select(selectedPath, "system");
            const color = snapshot.visibleTracks.find(
                track => track.relativePath === selectedPath
            )?.displayStyle?.color || DEFAULT_COLOR;
            const styles = this.getSelectionStyles(color);

            this.mapView.setSelectedPath(
                selectedPath,
                styles.selectedMainStyle,
                styles.selectedOutlineStyle
            );
        }

        return this.phaseARestored;
    }

    setLibraryContext({ libraryIdentity, cacheNamespace }) {

        this.libraryIdentity = libraryIdentity;
        this.cacheNamespace = cacheNamespace;
        this.phaseARestored = false;
        this.#scheduleSave();
    }

    markLibraryReady() {

        this.metrics.libraryReady ??= Math.max(0, now() - this.startedAt);
        this.#reportMetrics();
    }

    hasInstantRestore() {

        return this.phaseARestored;
    }

    flush() {

        this.#cancelTimer();
        return this.#save();
    }

    #bindEvents() {

        [
            "map:view-changed",
            "gpx:display-toggled",
            "folder:display-toggled",
            "map:clear-requested",
            "selection:changed",
            "view-state:sidebar-toggled",
            "view-state:sidebar-width-changed",
            "view-state:track-info-height-changed"
        ].forEach(name => this.eventBus.on(name, () => this.#scheduleSave()));
        this.displayState.subscribe(() => this.#scheduleSave());
        this.documentTarget?.addEventListener?.("visibilitychange", () => {
            if (this.documentTarget.visibilityState === "hidden") {
                void this.flush();
            }
        });
        this.windowTarget?.addEventListener?.("pagehide", () => {
            void this.flush();
        });
    }

    #scheduleSave() {

        if (!this.libraryIdentity || !this.cacheNamespace) return;

        this.#cancelTimer();
        this.timerId = this.setTimer(() => {
            this.timerId = null;
            void this.#save();
        }, this.debounceMs);
    }

    async #save() {

        if (!this.libraryIdentity || !this.cacheNamespace) return false;

        const libraryIdentity = this.libraryIdentity;
        const cacheNamespace = this.cacheNamespace;
        const visibleTracks = [];

        for (const path of this.displayState.getCheckedPaths()) {
            const display = this.displayState.getDisplay(path);
            const cached = await this.repository.getDisplaySnapshot(
                cacheNamespace,
                path
            );

            if (!display || !cached) continue;

            visibleTracks.push({
                relativePath: path,
                trackIdentity: cached.summary?.trackNames?.[0] ?? null,
                geometryCacheKey: {
                    namespace: cacheNamespace,
                    relativePath: path
                },
                displayStyle: { color: display.color }
            });
        }

        const selectedPath = this.selectionState.getSelectedPath();
        const selected = visibleTracks.find(
            track => track.relativePath === selectedPath
        );

        if (
            libraryIdentity !== this.libraryIdentity ||
            cacheNamespace !== this.cacheNamespace
        ) {
            return false;
        }

        return this.store.save({
            schemaVersion: this.store.config.schemaVersion,
            libraryIdentity,
            cacheNamespace,
            savedAt: Date.now(),
            map: this.mapView.getViewState(),
            visibleTracks,
            selectedTrack: selected ? {
                relativePath: selected.relativePath,
                trackIdentity: selected.trackIdentity
            } : null,
            sidebarState: {
                open: this.controls.isSidebarOpen(),
                width: this.controls.getSidebarWidth(),
                trackInfoHeight: this.controls.getTrackInfoHeight()
            }
        });
    }

    #restoreSidebar(state) {

        if (!state) return;

        this.controls.setSidebarOpen(state.open ?? true, {
            notifyLayout: false
        });
        this.controls.setSidebarWidth(state.width, {
            emit: false,
            notifyLayout: false
        });
        this.controls.setTrackInfoHeight(state.trackInfoHeight, {
            emit: false
        });
        this.mapView.invalidateSize({ silent: true });
    }

    #reportMetrics() {

        if (this.metricsReported) return;

        this.metricsReported = true;
        const values = { ...this.metrics };

        this.reportMetrics(values);
    }

    #cancelTimer() {

        if (this.timerId !== null) {
            this.clearTimer(this.timerId);
            this.timerId = null;
        }
    }
}
