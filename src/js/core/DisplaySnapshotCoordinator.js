const DEFAULT_COLOR = "#e53935";
const RESTORE_STATES = new Set(["idle", "phaseA", "phaseB", "ready"]);

function now() {

    return globalThis.performance?.now?.() ?? Date.now();
}

function reportDevelopmentMetrics(metrics) {

    const hostname = globalThis.location?.hostname;

    if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
        console.info("[TrailBook Startup]", metrics);
    }
}

function createIdentityToken(identity, cacheNamespace) {

    if (!identity) return "none";

    let hash = 2166136261;

    for (const character of identity) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }

    const source = cacheNamespace?.startsWith("drive:") ? "drive" : "local";

    return `${source}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
        captureLibrarySnapshot = () => null,
        restoreLibrarySnapshot = async () => false,
        getLibraryRestoreDiagnostic = () => null,
        markLibraryReady = () => {},
        debounceMs = 750,
        setTimer = globalThis.setTimeout.bind(globalThis),
        clearTimer = globalThis.clearTimeout.bind(globalThis),
        documentTarget = globalThis.document,
        windowTarget = globalThis.window,
        diagnosticRoot = null,
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
            captureLibrarySnapshot,
            restoreLibrarySnapshot,
            getLibraryRestoreDiagnostic,
            markLibraryReady,
            debounceMs,
            setTimer,
            clearTimer,
            documentTarget,
            windowTarget,
            diagnosticRoot,
            reportMetrics
        });
        this.libraryIdentity = null;
        this.cacheNamespace = null;
        this.timerId = null;
        this.phaseARestored = false;
        this.restoreState = "idle";
        this.lastKnownGood = null;
        this.lastWriteReason = null;
        this.lastWriteStatus = "none";
        this.metricsReported = false;
        this.snapshotView = null;
        this.mapChangedDuringRestore = false;
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
        this.#attachDiagnostic();
    }

    async initialize() {

        const startedAt = this.startedAt;

        this.#setRestoreState("phaseA");
        this.metrics.appShellReady = 0;
        const snapshot = await this.store.load();
        this.metrics.snapshotLoaded = Math.max(0, now() - startedAt);

        if (!snapshot) {
            this.#updateDiagnostic({ snapshotStatus: "missing" });
            return false;
        }

        this.lastKnownGood = snapshot;
        this.libraryIdentity = snapshot.libraryIdentity;
        this.cacheNamespace = snapshot.cacheNamespace;
        this.snapshotView = snapshot.map;
        this.#updateDiagnostic({ snapshotStatus: "found" });
        if (this.mapView.isValidViewState(snapshot.map)) {
            this.mapView.setViewState(snapshot.map, {
                animate: false,
                silent: true
            });
            this.#updateDiagnostic({
                mapRestoreStatus:
                    `${snapshot.map.lat},${snapshot.map.lng} / z${snapshot.map.zoom}`
            });
        }
        this.#restoreSidebar(snapshot.sidebarState);

        let firstGeometryAt = null;
        const restored = [];
        const restoredTracks = [];

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
            restoredTracks.push({
                path: track.relativePath,
                result: cached.result,
                color
            });
        }

        this.metrics.restoredTrackCount = restored.length;
        this.metrics.geometryRestored = firstGeometryAt === null
            ? null
            : Math.max(0, firstGeometryAt - startedAt);
        this.phaseARestored = restored.length > 0;
        this.#updateDiagnostic({
            phaseAStatus: this.phaseARestored ? "success" : "cache-miss"
        });

        const selectedPath = snapshot.selectedTrack?.relativePath;

        if (selectedPath && restored.includes(selectedPath)) {
            const change = this.selectionState.select(selectedPath, "system");
            if (change) this.eventBus.emit("selection:changed", {
                path: selectedPath,
                previousPath: change.previousPath,
                reason: "display-snapshot-restore"
            });
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

        const treeRestored = await this.restoreLibrarySnapshot(
            snapshot.library,
            {
                cacheNamespace: snapshot.cacheNamespace,
                restoredTracks,
                selectedPath
            }
        );
        const libraryRestoreDiagnostic = this.getLibraryRestoreDiagnostic();
        this.#updateDiagnostic({
            treeSource: treeRestored ? "cached" : "none",
            treeEntryCount: snapshot.library?.entries?.length ?? 0,
            libraryAvailability: treeRestored ? "provisional" : "none",
            libraryRestoreDiagnostic
        });

        return this.phaseARestored;
    }

    beginPhaseB() {

        this.#cancelTimer();
        this.#setRestoreState("phaseB");
        this.#updateDiagnostic({ phaseBStatus: "started" });
    }

    async completePhaseB({ restored = false } = {}) {

        if (this.restoreState !== "phaseB" || !restored) {
            this.#updateDiagnostic({ phaseBStatus: "incomplete" });
            return false;
        }

        if (
            this.phaseARestored &&
            !this.mapChangedDuringRestore &&
            this.mapView.isValidViewState(this.snapshotView)
        ) {
            this.mapView.setViewState(this.snapshotView, {
                animate: false,
                silent: true
            });
        }
        const saved = await this.#save("phaseB-complete");

        if (!saved) return false;

        this.#setRestoreState("ready");
        this.markLibraryReady();
        this.phaseARestored = false;
        this.snapshotView = null;
        this.metrics.libraryReady ??= Math.max(0, now() - this.startedAt);
        this.#updateDiagnostic({
            phaseBStatus: "success",
            treeSource: "actual",
            libraryAvailability: "ready"
        });
        this.#reportMetrics();

        return true;
    }

    setLibraryContext({ libraryIdentity, cacheNamespace }) {

        this.libraryIdentity = libraryIdentity;
        this.cacheNamespace = cacheNamespace;
        this.#updateDiagnostic();
    }

    hasInstantRestore() {

        return this.phaseARestored;
    }

    flush(reason = "pagehide") {

        this.#cancelTimer();
        return this.#save(reason);
    }

    #bindEvents() {

        this.eventBus.on("map:view-changed", ({ programmatic = false } = {}) => {
            if (!programmatic && ["phaseA", "phaseB"].includes(
                this.restoreState
            )) {
                this.mapChangedDuringRestore = true;
            }
            this.#scheduleSave("map-change");
        });
        ["gpx:display-toggled", "folder:display-toggled"].forEach(name => {
            this.eventBus.on(name, () => this.#scheduleSave("visible-change"));
        });
        this.eventBus.on("map:clear-requested", () => {
            this.#scheduleSave("visible-change");
        });
        this.eventBus.on("selection:changed", () => {
            this.#scheduleSave("selection-change");
        });
        [
            "view-state:sidebar-toggled",
            "view-state:sidebar-width-changed",
            "view-state:track-info-height-changed"
        ].forEach(name => this.eventBus.on(
            name,
            () => this.#scheduleSave("sidebar-change")
        ));
        this.displayState.subscribe(() => {
            this.#scheduleSave("visible-change");
        });
        this.documentTarget?.addEventListener?.("visibilitychange", () => {
            if (this.documentTarget.visibilityState === "hidden") {
                void this.flush("visibility-hidden");
            }
        });
        this.windowTarget?.addEventListener?.("pagehide", () => {
            void this.flush("pagehide");
        });
    }

    #scheduleSave(reason) {

        if (
            this.restoreState !== "ready" ||
            !this.libraryIdentity ||
            !this.cacheNamespace
        ) {
            return;
        }

        this.#cancelTimer();
        this.timerId = this.setTimer(() => {
            this.timerId = null;
            void this.#save(reason);
        }, this.debounceMs);
    }

    async #save(reason) {

        this.lastWriteReason = reason;
        const phaseBCommit =
            this.restoreState === "phaseB" &&
            reason === "phaseB-complete";

        if (
            (this.restoreState !== "ready" && !phaseBCommit) ||
            !this.libraryIdentity ||
            !this.cacheNamespace
        ) {
            this.lastWriteStatus = "suppressed";
            this.#updateDiagnostic();
            return false;
        }

        const libraryIdentity = this.libraryIdentity;
        const cacheNamespace = this.cacheNamespace;
        const visibleTracks = [];
        const sameKnownLibrary =
            this.lastKnownGood?.libraryIdentity === libraryIdentity &&
            this.lastKnownGood?.cacheNamespace === cacheNamespace;

        for (const path of this.displayState.getCheckedPaths()) {
            const display = this.displayState.getDisplay(path);

            if (!display) continue;

            const cached = await this.repository.getDisplaySnapshot(
                cacheNamespace,
                path
            );

            if (!cached) {
                const previous = sameKnownLibrary
                    ? this.lastKnownGood.visibleTracks.find(
                        track => track.relativePath === path
                    )
                    : null;

                if (previous) {
                    visibleTracks.push({
                        ...previous,
                        displayStyle: { color: display.color }
                    });
                }
                continue;
            }

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
        const previousSelectedPath = sameKnownLibrary
            ? this.lastKnownGood.selectedTrack?.relativePath
            : null;
        const selectionIncomplete = Boolean(
            previousSelectedPath &&
            !selected &&
            visibleTracks.some(
                track => track.relativePath === previousSelectedPath
            )
        );

        if (
            libraryIdentity !== this.libraryIdentity ||
            cacheNamespace !== this.cacheNamespace
        ) {
            this.lastWriteStatus = "stale-context";
            this.#updateDiagnostic();
            return false;
        }

        if (
            visibleTracks.length === 0 &&
            this.lastKnownGood?.visibleTracks?.length > 0 &&
            sameKnownLibrary &&
            reason !== "visible-change"
        ) {
            this.lastWriteStatus = "preserved-last-known-good";
            this.#updateDiagnostic();
            return false;
        }

        if (selectionIncomplete && reason === "phaseB-complete") {
            this.lastWriteStatus = "preserved-last-known-good";
            this.#updateDiagnostic();
            return false;
        }

        const snapshot = {
            schemaVersion: this.store.config.schemaVersion,
            revision: (this.lastKnownGood?.revision ?? 0) + 1,
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
            },
            library: this.captureLibrarySnapshot({ libraryIdentity })
        };
        this.treeEntryCount = snapshot.library?.entries?.length ?? 0;
        const saved = await this.store.save(snapshot);

        if (saved) {
            this.lastKnownGood = snapshot;
        }
        this.lastWriteStatus = saved ? "committed" : "failed";
        this.#updateDiagnostic();
        return saved;
    }

    getStatus() {

        return {
            restoreState: this.restoreState,
            revision: this.lastKnownGood?.revision ?? null,
            libraryIdentity: this.libraryIdentity,
            visibleTrackCount: this.lastKnownGood?.visibleTracks?.length ?? 0,
            selectedTrack: this.lastKnownGood?.selectedTrack ?? null,
            lastWriteReason: this.lastWriteReason,
            lastWriteStatus: this.lastWriteStatus,
            libraryRestoreDiagnostic: this.libraryRestoreDiagnostic ?? null,
            ...this.metrics
        };
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

    #setRestoreState(state) {

        if (!RESTORE_STATES.has(state)) return;

        this.restoreState = state;
        this.#updateDiagnostic();
    }

    #attachDiagnostic() {

        if (
            !this.diagnosticRoot?.append ||
            !this.documentTarget?.createElement
        ) return;

        this.diagnosticElement = this.documentTarget.createElement("details");
        this.diagnosticElement.className = "fast-restore-diagnostic";
        this.diagnosticElement.innerHTML = `
            <summary>Fast Restore</summary>
            <pre></pre>
        `;
        this.diagnosticRoot.append(this.diagnosticElement);
        this.#updateDiagnostic();
    }

    #updateDiagnostic(overrides = {}) {

        Object.assign(this, overrides);
        const output = this.diagnosticElement?.querySelector("pre");

        if (!output) return;

        const identity = createIdentityToken(
            this.libraryIdentity,
            this.cacheNamespace
        );
        output.textContent = [
            `snapshot: ${this.snapshotStatus || "checking"}`,
            `revision: ${this.lastKnownGood?.revision ?? "-"}`,
            `library: ${identity}`,
            `visible: ${this.lastKnownGood?.visibleTracks?.length ?? 0}`,
            `cache refs: ${this.lastKnownGood?.visibleTracks?.length ?? 0}`,
            `selected: ${this.lastKnownGood?.selectedTrack ? "yes" : "no"}`,
            `cache hits: ${this.metrics.restoredTrackCount}`,
            `cache miss: ${this.metrics.cacheMissCount}`,
            `phaseA: ${this.phaseAStatus || this.restoreState}`,
            `phaseB: ${this.phaseBStatus || "pending"}`,
            `map restored: ${this.mapRestoreStatus || "no"}`,
            `tree source: ${this.treeSource || "none"}`,
            `tree entries: ${this.treeEntryCount ?? 0}`,
            `library: ${this.libraryAvailability || "none"}`,
            ...(this.libraryRestoreDiagnostic ? [
                `tree restore total: ${this.libraryRestoreDiagnostic.totalMs?.toFixed(1) ?? "-"} ms`,
                `tree render: ${this.libraryRestoreDiagnostic.treeRenderMs?.toFixed(1) ?? "-"} ms`,
                `display restore: ${this.libraryRestoreDiagnostic.displayRestoreMs?.toFixed(1) ?? "-"} ms`,
                `tree projection: ${this.libraryRestoreDiagnostic.treeProjectionMs?.toFixed(1) ?? "-"} ms`,
                `restore publications: ${this.libraryRestoreDiagnostic.displayPublicationCount ?? "-"}`,
                `tree row updates: ${this.libraryRestoreDiagnostic.treeRowUpdateCount ?? "-"}`,
                `folder aggregates: ${this.libraryRestoreDiagnostic.folderAggregateCount ?? "-"}`,
                `restore geometry loads: ${this.libraryRestoreDiagnostic.geometryLoadCount ?? "-"}`
            ] : []),
            `snapshot write: ${this.lastWriteStatus}`,
            `write reason: ${this.lastWriteReason || "-"}`
        ].join("\n");
    }

    #cancelTimer() {

        if (this.timerId !== null) {
            this.clearTimer(this.timerId);
            this.timerId = null;
        }
    }
}
