import TreeMetadataBuilder from "../ui/TreeMetadataBuilder.js";
import TrackSummaryBuilder from "../services/TrackSummaryBuilder.js";
import { RUNTIME_BUILD_ID } from "../runtime/RuntimeBuild.js";
import TreeIncrementalReconciler from "../ui/TreeIncrementalReconciler.js";

const METADATA_CONCURRENCY = 8;

function normalizeRelativePath(path) {

    return typeof path === "string" ? path.replaceAll("\\", "/") : "";
}

function normalizedFolderPath(path) {

    const normalized = normalizeRelativePath(path);
    const separator = normalized.lastIndexOf("/");

    return separator < 0 ? "" : normalized.slice(0, separator);
}

function normalizeDiagnosticColor(value) {

    if (typeof value !== "string" || !value.trim()) return null;
    const color = value.trim();
    const shortHex = color.match(/^#([0-9a-f]{3})$/i);

    if (shortHex) {
        return `#${[...shortHex[1]].map(part => part.repeat(2)).join("")}`
            .toUpperCase();
    }
    const hex = color.match(/^#([0-9a-f]{6})$/i);

    if (hex) return `#${hex[1].toUpperCase()}`;
    const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);

    if (!rgb) return color;
    return `#${rgb.slice(1, 4).map(component =>
        Math.max(0, Math.min(255, Number(component)))
            .toString(16).padStart(2, "0")
    ).join("").toUpperCase()}`;
}

function emptyRefreshPerformance(reason, startedAt) {

    return Object.freeze({
        status: "running", reason, mode: "unknown", startedAt,
        totalMs: null, enumerationMs: null, diffMs: null,
        validationMs: null, addedProcessingMs: null,
        modifiedProcessingMs: null, reconcileMs: null,
        snapshotUpdateMs: null,
        directoryEntryCount: null, gpxCandidateCount: null,
        cachedPathLookupCount: 0, scannedCount: null,
        unchangedCount: null, addedCount: null,
        removedCount: null, modifiedCount: null,
        getFileCount: 0, bodyReadCount: 0, parseCount: 0,
        metadataExtractionCount: 0, cacheLookupCount: 0,
        geometryGenerationCount: 0, delegatedVisibleReloadCount: 0,
        existingGetFileCount: 0, addedGetFileCount: 0,
        existingMetadataValidationCount: 0,
        addedMetadataValidationCount: 0
    });
}

/** Refreshes an already-present local Library without clearing Viewer state. */
export default class LibraryRefreshCoordinator {

    constructor({
        eventBus, scanner, previousLibraryCoordinator, librarySnapshotService,
        treeView, discoveryCoordinator, displayState, selectionState, accessPanel,
        repository, getNamespace, getLibrary, setLibrary, getColor,
        getFolderColor = () => null,
        getEntryPresentationDiagnostic = () => ({}),
        removePath, reloadVisiblePath, onLibraryUpdated,
        canRefresh = () => true,
        now = () => Date.now(),
        performanceNow = () => globalThis.performance?.now?.() ?? Date.now(),
        minimumIntervalMs = 2000,
        metadataBuilder = new TreeMetadataBuilder(),
        summaryBuilder = new TrackSummaryBuilder(),
        treeReconciler = new TreeIncrementalReconciler()
    }) {
        Object.assign(this, {
            eventBus, scanner, previousLibraryCoordinator,
            librarySnapshotService, treeView, discoveryCoordinator,
            displayState, selectionState, accessPanel, repository, getNamespace,
            getLibrary, setLibrary, getColor, getFolderColor,
            getEntryPresentationDiagnostic,
            removePath, reloadVisiblePath,
            onLibraryUpdated, canRefresh, now, performanceNow, minimumIntervalMs,
            metadataBuilder, summaryBuilder, treeReconciler
        });
        this.activeRefresh = null;
        this.lastResult = null;
        this.lastCompletedAt = -Infinity;
        this.refreshState = Object.freeze({
            runtimeBuildId: RUNTIME_BUILD_ID,
            runtimeMarkerSource: "loaded",
            permission: "unknown", hasHandle: false, libraryState: "none",
            canManualRefresh: false,
            cachedCount: null, scannedCount: null,
            addedCount: null, recoveredCount: null,
            removedCount: null, modifiedCount: null,
            reason: "none", result: "idle", performance: null,
            entryTrace: null, enumerationDiagnostic: null
        });
        this.refreshPerformance = null;
        this.refreshPerformanceActive = false;
        this.lastPublishedState = null;
        this.hydrateCallCount = 0;
        this.hydrationDiagnostic = null;
        this.refreshActionConnected =
            typeof this.accessPanel?.setLibraryRefreshAction === "function";
        if (this.refreshActionConnected) {
            this.accessPanel.setLibraryRefreshAction(
                () => void this.refresh({ reason: "manual-refresh", reconnect: true })
            );
        }
        this.previousLibraryCoordinator.setRefreshPerformanceObserver?.(
            metrics => this.#observePreviousRefreshPerformance(metrics)
        );
        this.accessPanel?.setLibraryRefreshState?.(this.refreshState);
        this.lastPublishedState = this.refreshState;
        this.#hydrateCurrentState("constructor");
        this.previousLibraryCoordinator.setPersistenceStatusListener?.(
            state => this.#handlePersistenceState(state)
        );
        this.displayState.subscribe?.(({ path, display }) => {
            if (!path || path !== this.refreshState.entryTrace?.path) return;
            this.#publishRefreshState({
                entryTrace: Object.freeze({
                    ...this.refreshState.entryTrace,
                    ...this.#capturePresentationDiagnostic(path),
                    checked: Boolean(display?.checked),
                    visibility: Boolean(display?.checked),
                    displayState: display?.state || null,
                    errorName: display?.error?.name || null,
                    errorMessage: display?.error?.message || null,
                    fileHandleProvisional: Boolean(
                        display?.fileHandle?.provisional
                    ),
                    fileHandleActual: Boolean(
                        display?.fileHandle &&
                        display.fileHandle.provisional !== true
                    ),
                    fileHandleKind: display?.fileHandle?.kind || null,
                    permissionState: this.refreshState.permission
                })
            });
        });
    }

    bind() {
        this.eventBus.on(
            "library-refresh:entry-diagnostic",
            data => {
                try {
                    this.#handleEntryDiagnostic(data);
                } catch {
                    // Runtime diagnostics never affect Viewer behavior.
                }
            }
        );
        this.eventBus.on(
            "gpx:display-toggled",
            data => {
                try {
                    this.#handleDisplayToggleDiagnostic(data);
                } catch {
                    // Runtime diagnostics never affect checkbox handling.
                }
            }
        );
        this.eventBus.on(
            "library:sidebar-opened",
            () => {
                this.#hydrateCurrentState("sidebar-open");
                void this.refresh({ reason: "sidebar-open" });
            }
        );
        this.eventBus.on("library:provisional-state-changed", () => {
            this.#hydrateCurrentState("provisional-state-notification");
        });
        this.#hydrateCurrentState("bind");
    }

    getDiagnostic() {
        return { ...this.refreshState };
    }

    refresh({ reason = "manual", reconnect = false } = {}) {
        if (this.activeRefresh) return this.activeRefresh;
        if (!this.canRefresh() || this.previousLibraryCoordinator.isLoading() ||
            (!reconnect &&
                this.now() - this.lastCompletedAt < this.minimumIntervalMs)) {
            this.#publishRefreshState({ reason, result: "suppressed" });
            return Promise.resolve(false);
        }
        const performanceStartedAt = this.performanceNow();

        this.refreshPerformance = emptyRefreshPerformance(
            reason,
            performanceStartedAt
        );
        this.refreshPerformanceActive = true;
        this.#publishRefreshState({ performance: this.refreshPerformance });
        this.#publishRefreshState({ reason, result: "checking" });
        this.activeRefresh = (reconnect ? this.#reconnect() : this.#refresh())
            .catch(error => {
                console.error("Library refresh failed.", error);
                this.#publishRefreshState({ result: "failure" });
                return false;
            })
            .finally(() => {
                this.#updateRefreshPerformance({
                    status: "complete",
                    totalMs: this.performanceNow() - performanceStartedAt
                });
                this.lastCompletedAt = this.now();
                this.activeRefresh = null;
                this.refreshPerformanceActive = false;
            });
        return this.activeRefresh;
    }

    async #reconnect() {

        const cached = this.treeView.getFileEntries?.().length ?? 0;
        const handle = this.previousLibraryCoordinator.getRefreshHandle();

        this.#publishRefreshState({
            hasHandle: Boolean(handle), cachedCount: cached
        });
        if (!handle) {
            this.#publishRefreshState({ result: "no-handle" });
            return false;
        }
        const permission = await this.previousLibraryCoordinator
            .requestRefreshPermission(handle);

        this.#publishRefreshState({ permission });
        if (permission !== "granted") {
            this.#publishRefreshState({ result: "permission-denied" });
            return false;
        }
        const currentLibrary = this.getLibrary();

        if (!currentLibrary && !this.librarySnapshotService.isProvisional()) {
            this.#publishRefreshState({ result: "not-ready" });
            return false;
        }
        return this.#scanAndReconcile(handle, currentLibrary);
    }

    async #refresh() {

        const currentLibrary = this.getLibrary();
        const handle = currentLibrary?.rootFolder?.handle ||
            this.previousLibraryCoordinator.getRefreshHandle();
        const cached = this.treeView.getFileEntries?.().length ?? 0;

        this.#publishRefreshState({
            hasHandle: Boolean(handle), cachedCount: cached
        });
        if (!handle) {
            this.#publishRefreshState({ result: "no-handle" });
            return false;
        }
        const permission = await this.previousLibraryCoordinator
            .queryRefreshPermission(handle);

        this.#publishRefreshState({ permission });
        if (permission === "prompt") {
            this.#publishRefreshState({
                reason: "waiting-permission",
                result: "waiting"
            });
            return false;
        }
        if (permission !== "granted") {
            this.#publishRefreshState({ result: "permission-denied" });
            return false;
        }
        if (!currentLibrary) {
            const opened = this.librarySnapshotService.isProvisional()
                ? this.previousLibraryCoordinator.refreshPreviousIfGranted()
                : false;

            const result = await opened;
            const scanned = this.treeView.getFileEntries?.().length ?? cached;

            this.#publishRefreshState({
                scannedCount: scanned,
                addedCount: result ? Math.max(0, scanned - cached) : 0,
                result: result ? "refreshed" : "not-ready"
            });
            return result;
        }

        return this.#scanAndReconcile(handle, currentLibrary);
    }

    async #scanAndReconcile(handle, currentLibrary) {

        const enumerationStartedAt = this.performanceNow();
        const library = await this.scanner.scan(handle);
        const enumerationMs = this.performanceNow() - enumerationStartedAt;
        const scanned = library.gpxFileCount;
        const scanDiagnostic = this.scanner.getLastScanDiagnostic?.();
        const previousContext = this.previousLibraryCoordinator
            .getRefreshContext?.() || {};
        const savedHandle = previousContext.handle ||
            this.previousLibraryCoordinator.getRefreshHandle?.() || null;
        const currentHandle = currentLibrary?.rootFolder?.handle || null;
        const enumerationDiagnostic = Object.freeze({
            rootHandleName: scanDiagnostic?.rootHandleName ??
                handle?.name ?? null,
            rootHandleKind: scanDiagnostic?.rootHandleKind ??
                handle?.kind ?? null,
            permission: this.refreshState.permission,
            enumerationStartedAt: scanDiagnostic?.enumerationStartedAt ?? null,
            enumerationFinishedAt: scanDiagnostic?.enumerationFinishedAt ?? null,
            gpxCount: scanDiagnostic?.gpxCandidateCount ?? scanned,
            totalFileCount: scanDiagnostic?.totalFileCount ?? null,
            totalDirectoryCount: scanDiagnostic?.totalDirectoryCount ?? null,
            gpxTailPaths: Object.freeze([
                ...(scanDiagnostic?.gpxTailPaths || [])
            ].slice(-10)),
            candidatePaths: Object.freeze([]),
            actualPathCount: scanned,
            knownPathCount: null,
            treePathCount: null,
            snapshotPathCount: null,
            handleSource: handle?.constructor?.name ===
                "CachedDirectoryHandle"
                ? "cached"
                : handle?.provisional === true
                    ? "provisional"
                    : "actual",
            handleOrigin: handle === currentHandle
                ? "current-library"
                : handle === savedHandle
                    ? "saved-handle"
                    : "other",
            sameAsSavedHandle: Boolean(savedHandle && handle === savedHandle)
        });

        this.#updateRefreshPerformance({
            mode: "incremental",
            enumerationMs,
            directoryEntryCount: scanDiagnostic?.directoryEntryCount ??
                library.folderCount + library.gpxFileCount,
            gpxCandidateCount: scanDiagnostic?.gpxCandidateCount ??
                library.gpxFileCount,
            scannedCount: scanned
        });
        this.#publishRefreshState({ enumerationDiagnostic });

        if (currentLibrary !== this.getLibrary()) return false;
        const result = await this.#reconcile(library, currentLibrary);

        this.#publishRefreshState({
            scannedCount: scanned,
            addedCount: result?.added ?? null,
            recoveredCount: result?.recovered ?? null,
            removedCount: result?.removed ?? null,
            modifiedCount: result?.modified ?? null,
            result: result
                ? result.snapshotCommitted === false
                    ? "snapshot-pending"
                    : "success"
                : "stale-context"
        });
        return result;
    }

    async #reconcile(library, expectedLibrary) {

        const diffStartedAt = this.performanceNow();
        const prepared = this.metadataBuilder.build(library);
        const fileEntries = this.metadataBuilder.getFileEntries(
            prepared.nodeMetadata
        );
        const oldEntries = new Map(
            this.discoveryCoordinator.getSnapshotState().entries.map(entry => [
                normalizeRelativePath(entry.relativePath),
                entry
            ])
        );
        const oldFileEntries = this.treeView.getFileEntries();
        const oldPaths = new Set(oldFileEntries.map(({ path }) =>
            normalizeRelativePath(path)
        ));
        const newPaths = new Set(fileEntries.map(({ path }) =>
            normalizeRelativePath(path)
        ));
        const snapshotContext = this.librarySnapshotService
            .getRefreshContext?.() || {};
        const snapshotHasPath = path =>
            typeof this.librarySnapshotService.hasProvisionalPath ===
                "function" &&
            this.librarySnapshotService.hasProvisionalPath(path);
        const candidatePaths = [...newPaths].filter(path =>
            !oldEntries.has(path) || !oldPaths.has(path) ||
            (snapshotContext.provisional === true && !snapshotHasPath(path))
        ).slice(-10).map(path => Object.freeze({
            path,
            known: oldEntries.has(path),
            tree: oldPaths.has(path),
            snapshot: snapshotContext.provisional === true
                ? snapshotHasPath(path)
                : null
        }));

        this.#publishRefreshState({
            enumerationDiagnostic: Object.freeze({
                ...(this.refreshState.enumerationDiagnostic || {}),
                actualPathCount: newPaths.size,
                knownPathCount: oldEntries.size,
                treePathCount: oldPaths.size,
                snapshotPathCount: snapshotContext.cachedCount ?? null,
                candidatePaths: Object.freeze(candidatePaths)
            })
        });
        const removed = oldFileEntries
            .filter(({ path }) => !newPaths.has(normalizeRelativePath(path)))
            .map(({ path }) => path);
        const provisional = this.librarySnapshotService.isProvisional();
        const added = fileEntries.filter(({ path }) => {
            const key = normalizeRelativePath(path);
            const missingTreeEntry = !oldPaths.has(key);
            const missingSnapshotEntry = provisional &&
                typeof this.librarySnapshotService.hasProvisionalPath ===
                    "function" &&
                !this.librarySnapshotService.hasProvisionalPath(key);

            return missingTreeEntry || missingSnapshotEntry;
        });
        const recoveredPaths = new Set(added
            .filter(({ path }) => oldEntries.has(normalizeRelativePath(path)))
            .map(({ path }) => normalizeRelativePath(path)));
        const addedPaths = new Set(added.map(({ path }) =>
            normalizeRelativePath(path)
        ));
        const previousDisplays = new Map(
            [...this.displayState.getDisplays().values()].map(display => [
                normalizeRelativePath(display.path),
                {
                    checked: display.checked,
                    color: display.color,
                    state: display.state,
                    error: display.error,
                    fileHandle: display.fileHandle
                }
            ])
        );
        const reboundErrorPaths = new Set(fileEntries
            .map(({ path }) => normalizeRelativePath(path))
            .filter(path => {
                const previous = previousDisplays.get(path);

                return previous?.fileHandle?.provisional === true &&
                    previous.state === "error";
            }));
        const normalizedPaths = new Set([...addedPaths, ...reboundErrorPaths]);
        const folderColors = new Map();
        const resolveAddedColor = path => {
            const folderPath = normalizedFolderPath(path);

            if (!folderColors.has(folderPath)) {
                folderColors.set(
                    folderPath,
                    this.getFolderColor(folderPath) || this.getColor(path)
                );
            }
            return folderColors.get(folderPath);
        };
        const diffMs = this.performanceNow() - diffStartedAt;
        const namespace = this.getNamespace();

        // The normal refresh is path-discovery-first. Existing file identity
        // validation is reserved for a separate complete/background refresh.
        const validationMs = 0;
        if (this.getLibrary() !== expectedLibrary) return false;
        const changed = [];
        const unchangedCount = fileEntries.length - added.length;
        const selectedPath = this.selectionState.getSelectedPath();
        const noOpDiff = added.length === 0 && removed.length === 0 &&
            changed.length === 0;

        this.#updateRefreshPerformance({
            diffMs,
            validationMs,
            cachedPathLookupCount: oldPaths.size,
            unchangedCount,
            addedCount: added.length,
            removedCount: removed.length,
            modifiedCount: changed.length
        });

        const modifiedStartedAt = this.performanceNow();
        removed.forEach(path => this.removePath(path));
        if (noOpDiff) {
            fileEntries.forEach(({ path, fileHandle }) => {
                this.displayState.rebindFileHandle?.(path, fileHandle);
            });
        } else {
            fileEntries.forEach(({ path, fileHandle }) => {
                const key = normalizeRelativePath(path);
                const previous = previousDisplays.get(key);

                this.displayState.registerFile(
                    path,
                    fileHandle,
                    normalizedPaths.has(key)
                        ? resolveAddedColor(path)
                        : previous?.color ?? this.getColor(path)
                );
                if (addedPaths.has(key)) {
                    this.displayState.setChecked(path, false);
                } else if (previous) {
                    this.displayState.setChecked(path, previous.checked);
                }
                if (normalizedPaths.has(key)) {
                    this.displayState.setChecked(path, false);
                    this.displayState.setIdle(path);
                }
            });
        }
        removed.forEach(path => this.displayState.unregisterFile(path));
        const modifiedProcessingMs = this.performanceNow() - modifiedStartedAt;

        const reconcileStartedAt = this.performanceNow();
        const affectedPaths = [
            ...added.map(({ path }) => path),
            ...removed
        ];

        const treeResult = await this.treeReconciler.reconcile(
            this.treeView,
            library,
            { affectedPaths }
        );
        this.setLibrary(library);

        let metadataExtractionCount = 0;
        const addedProcessingStartedAt = this.performanceNow();
        const metadata = await this.#readMetadata(added);
        const discoveryEntries = fileEntries.map(({ path, fileHandle }) => {
            const key = normalizeRelativePath(path);
            const previous = oldEntries.get(key);
            const file = metadata.get(path);

            if (previous) return previous;
            metadataExtractionCount += 1;
            return this.summaryBuilder.build(path, file || {
                name: fileHandle.name
            }, null);
        }).filter(Boolean);
        const addedProcessingMs = this.performanceNow() -
            addedProcessingStartedAt;

        this.discoveryCoordinator.reconcileLibrary({
            namespace,
            fileEntries,
            entries: discoveryEntries
        });
        const selectedKey = normalizeRelativePath(selectedPath);
        const reconciledSelectedPath = fileEntries.find(({ path }) =>
            normalizeRelativePath(path) === selectedKey
        )?.path || selectedPath;

        if (!noOpDiff) {
            this.#restoreTreePresentation(reconciledSelectedPath);
        }
        added.forEach(({ path }) => {
            this.displayState.setChecked(path, false);
            this.treeView.setDisplayChecked(path, false);
        });

        const delegatedVisibleReloadCount = 0;
        const snapshotStartedAt = this.performanceNow();
        const performanceRunStartedAt = this.refreshPerformance?.startedAt;
        const snapshotUpdate = this.onLibraryUpdated(library, {
            preserveExistingPresentation: true,
            presentationUnchanged: noOpDiff
        });
        const reconcileMs = this.performanceNow() - reconcileStartedAt;

        this.#updateRefreshPerformance({
            addedProcessingMs,
            metadataExtractionCount,
            modifiedProcessingMs,
            delegatedVisibleReloadCount,
            reconcileMs
        });
        let snapshotCommitted = true;

        try {
            const saved = await Promise.resolve(snapshotUpdate);

            snapshotCommitted = saved !== false;
        } catch {
            snapshotCommitted = false;
        }
        if (this.refreshPerformance?.startedAt === performanceRunStartedAt) {
            this.#updateRefreshPerformance({
                snapshotUpdateMs: this.performanceNow() - snapshotStartedAt
            });
        }
        this.lastResult = Object.freeze({
            added: added.length - recoveredPaths.size,
            recovered: recoveredPaths.size,
            removed: removed.length,
            modified: changed.length,
            snapshotCommitted
        });
        const tracedEntry = added[0] || fileEntries.find(({ path }) =>
            reboundErrorPaths.has(normalizeRelativePath(path))
        );

        if (tracedEntry) {
            const tracePath = normalizeRelativePath(tracedEntry.path);

            this.#publishRefreshState({
                recoveredCount: recoveredPaths.size,
                entryTrace: Object.freeze({
                    path: tracePath,
                    classification: recoveredPaths.has(tracePath)
                        ? "recovered"
                        : addedPaths.has(tracePath)
                            ? "new"
                            : "rebound-error",
                    scanned: newPaths.has(tracePath),
                    reconcileInput: affectedPaths.some(path =>
                        normalizeRelativePath(path) === tracePath
                    ),
                    runtimeLibrary: fileEntries.some(({ path }) =>
                        normalizeRelativePath(path) === tracePath
                    ),
                    treeMetadata: treeResult?.metadataPaths?.some(path =>
                        normalizeRelativePath(path) === tracePath
                    ) ?? this.treeView.hasFile(tracePath),
                    renderedDom: treeResult?.renderedPaths?.some(path =>
                        normalizeRelativePath(path) === tracePath
                    ) ?? false,
                    folderResolvedColor: folderColors.get(
                        normalizedFolderPath(tracePath)
                    ) || null,
                    displayColor: this.displayState.getDisplay(tracePath)?.color ||
                        null,
                    treeColor: this.treeView.nodeMetadata.get(tracePath)?.color ||
                        null,
                    displayState: this.displayState.getDisplay(tracePath)?.state ||
                        null,
                    checked: Boolean(
                        this.displayState.getDisplay(tracePath)?.checked
                    ),
                    errorName: this.displayState.getDisplay(tracePath)?.error
                        ?.name || null,
                    errorMessage: this.displayState.getDisplay(tracePath)?.error
                        ?.message || null,
                    discoveryStatus: discoveryEntries.find(entry =>
                        normalizeRelativePath(entry.relativePath) === tracePath
                    )?.status || null,
                    fileHandleProvisional: Boolean(
                        this.displayState.getDisplay(tracePath)?.fileHandle
                            ?.provisional
                    ),
                    fileHandleActual: Boolean(
                        this.displayState.getDisplay(tracePath)?.fileHandle &&
                        this.displayState.getDisplay(tracePath)?.fileHandle
                            ?.provisional !== true
                    ),
                    fileHandleKind: this.displayState.getDisplay(tracePath)
                        ?.fileHandle?.kind || null,
                    permissionState: this.refreshState.permission,
                    visibility: Boolean(
                        this.displayState.getDisplay(tracePath)?.checked
                    ),
                    resolverResult: "not-run",
                    getFileResult: "not-run",
                    getFileErrorName: null,
                    getFileErrorMessage: null,
                    checkboxStage: "not-clicked",
                    checkboxTrace: Object.freeze([]),
                    ...this.#capturePresentationDiagnostic(tracePath)
                })
            });
        } else {
            this.#publishRefreshState({
                recoveredCount: 0,
                entryTrace: null
            });
        }
        return this.lastResult;
    }

    async #readMetadata(entries) {

        const result = new Map();
        let nextIndex = 0;
        let getFileCount = 0;
        let existingGetFileCount = 0;
        let addedGetFileCount = 0;
        const worker = async () => {
            while (nextIndex < entries.length) {
                const entry = entries[nextIndex++];
                try {
                    getFileCount += 1;
                    addedGetFileCount += 1;
                    result.set(entry.path, await entry.fileHandle.getFile());
                } catch {
                    // An unreadable entry stays in the Tree and is loaded on demand.
                }
            }
        };

        await Promise.all(Array.from(
            { length: Math.min(METADATA_CONCURRENCY, Math.max(entries.length, 1)) },
            () => worker()
        ));
        this.#updateRefreshPerformance({
            getFileCount,
            existingGetFileCount,
            addedGetFileCount,
            existingMetadataValidationCount: existingGetFileCount,
            addedMetadataValidationCount: addedGetFileCount
        });
        return result;
    }

    async #readPreviousIdentities(checkedPaths, entries, namespace) {

        const identities = new Map();
        let cacheLookupCount = 0;

        entries.forEach((entry, path) => {
            if (Number.isFinite(entry.fileSize) &&
                Number.isFinite(entry.lastModified)) {
                identities.set(normalizeRelativePath(path), {
                    size: entry.fileSize,
                    lastModified: entry.lastModified
                });
            }
        });
        await Promise.all([...checkedPaths].map(async path => {
            const key = normalizeRelativePath(path);

            if (identities.has(key)) return;
            cacheLookupCount += 1;
            const cached = await this.repository.getDisplaySnapshot?.(
                namespace,
                path
            );

            if (cached?.fileIdentity) identities.set(key, cached.fileIdentity);
        }));
        this.#updateRefreshPerformance({ cacheLookupCount });
        return identities;
    }

    #observePreviousRefreshPerformance(metrics) {

        if (!this.refreshPerformanceActive || !this.refreshPerformance) return;
        this.#updateRefreshPerformance({
            mode: "full-reopen",
            enumerationMs: metrics.enumerationMs,
            reconcileMs: metrics.applyLibraryMs,
            directoryEntryCount: metrics.directoryEntryCount,
            gpxCandidateCount: metrics.gpxCandidateCount,
            scannedCount: metrics.gpxCandidateCount
        });
    }

    #updateRefreshPerformance(values) {

        if (!this.refreshPerformance) return;
        this.refreshPerformance = Object.freeze({
            ...this.refreshPerformance,
            ...values
        });
        this.#publishRefreshState({ performance: this.refreshPerformance });
    }

    #restoreTreePresentation(selectedPath) {

        this.displayState.getDisplays().forEach(display => {
            const metadata = this.treeView.nodeMetadata.get(display.path);

            if (!metadata) return;
            Object.assign(metadata, {
                checked: display.checked,
                state: display.state,
                error: display.error,
                color: display.color
            });
        });
        this.treeView.refreshAllFileRows();
        this.treeView.refreshAllFolderRows();
        this.treeView.setSelectedPath(
            this.treeView.hasFile(selectedPath) ? selectedPath : null,
            { reveal: false, scroll: false, moveFocus: false }
        );
    }

    #capturePresentationDiagnostic(path) {

        const display = this.displayState.getDisplay(path);
        const metadata = this.treeView.nodeMetadata.get(path);
        let presentation = {};

        try {
            presentation = this.getEntryPresentationDiagnostic(path) || {};
        } catch {
            // Diagnostic collection must never alter Library behavior.
        }
        return {
            trackColor: normalizeDiagnosticColor(
                display?.color || presentation.displayColor
            ),
            folderResolvedColor: normalizeDiagnosticColor(
                presentation.folderResolvedColor
            ),
            treeColor: normalizeDiagnosticColor(
                metadata?.color || presentation.treeColor
            ),
            folderDomColor: normalizeDiagnosticColor(
                presentation.folderDomColor
            ),
            trackDomColor: normalizeDiagnosticColor(
                presentation.trackDomColor
            )
        };
    }

    #handleEntryDiagnostic(data = {}) {

        const trace = this.refreshState.entryTrace;
        const path = normalizeRelativePath(data.path);

        if (!trace || !path || path !== normalizeRelativePath(trace.path)) return;
        const display = this.displayState.getDisplay(path);
        const stage = typeof data.stage === "string" ? data.stage : "observed";
        const status = typeof data.status === "string" ? data.status : null;
        const step = status ? `${stage}: ${status}` : stage;
        const checkboxTrace = [...(trace.checkboxTrace || []), step].slice(-10);
        const resolverResult = stage === "resolver"
            ? status || data.resolverResult || "unknown"
            : trace.resolverResult;
        const getFileResult = stage === "getFile"
            ? status || "unknown"
            : trace.getFileResult;

        this.#publishRefreshState({
            entryTrace: Object.freeze({
                ...trace,
                ...this.#capturePresentationDiagnostic(path),
                displayState: display?.state || null,
                errorName: display?.error?.name || data.errorName || null,
                errorMessage: display?.error?.message ||
                    data.errorMessage || null,
                checked: Boolean(display?.checked),
                visibility: Boolean(display?.checked),
                fileHandleKind: data.fileHandleKind ||
                    display?.fileHandle?.kind || trace.fileHandleKind,
                fileHandleProvisional: data.fileHandleProvisional ?? Boolean(
                    display?.fileHandle?.provisional
                ),
                fileHandleActual: data.fileHandleActual ?? Boolean(
                    display?.fileHandle && display.fileHandle.provisional !== true
                ),
                permissionState: this.refreshState.permission,
                resolverResult,
                getFileResult,
                getFileErrorName: stage === "getFile" && status === "failure"
                    ? data.errorName || "Error"
                    : trace.getFileErrorName,
                getFileErrorMessage: stage === "getFile" && status === "failure"
                    ? data.errorMessage || "-"
                    : trace.getFileErrorMessage,
                checkboxStage: step,
                checkboxTrace: Object.freeze(checkboxTrace)
            })
        });
    }

    #handleDisplayToggleDiagnostic(data = {}) {

        const path = normalizeRelativePath(data.path);
        const trace = this.refreshState.entryTrace;

        if (!trace || path !== normalizeRelativePath(trace.path)) return;
        this.#handleEntryDiagnostic({
            path,
            stage: "click",
            status: data.checked ? "received-on" : "received-off",
            fileHandleKind: data.fileHandle?.kind || null,
            fileHandleProvisional: Boolean(data.fileHandle?.provisional),
            fileHandleActual: Boolean(
                data.fileHandle && data.fileHandle.provisional !== true
            )
        });
        this.#handleEntryDiagnostic({
            path,
            stage: "resolver",
            status: !data.fileHandle
                ? "missing"
                : data.fileHandle.provisional === true
                    ? "provisional"
                    : "actual",
            fileHandleKind: data.fileHandle?.kind || null,
            fileHandleProvisional: Boolean(data.fileHandle?.provisional),
            fileHandleActual: Boolean(
                data.fileHandle && data.fileHandle.provisional !== true
            )
        });
        const display = this.displayState.getDisplay(path);

        this.#handleEntryDiagnostic({
            path,
            stage: "DisplayState",
            status: display?.state || (data.checked ? "checked" : "unchecked")
        });
    }

    #handlePersistenceState(state) {

        this.#hydrateCurrentState("previous-state-notification", state);
    }

    #hydrateCurrentState(reason, previousFallback = {}) {

        this.hydrateCallCount += 1;
        const previousGetterCalled = typeof this.previousLibraryCoordinator
            .getRefreshContext === "function";
        const snapshotGetterCalled = typeof this.librarySnapshotService
            .getRefreshContext === "function";
        const previous = previousGetterCalled
            ? this.previousLibraryCoordinator.getRefreshContext()
            : previousFallback;
        const snapshot = snapshotGetterCalled
            ? this.librarySnapshotService.getRefreshContext()
            : {};

        this.#publishRefreshState({
            ...(typeof previous.permission === "string"
                ? { permission: previous.permission }
                : {}),
            ...(typeof previous.hasHandle === "boolean"
                ? { hasHandle: previous.hasHandle }
                : {}),
            ...(Object.hasOwn(snapshot, "cachedCount")
                ? { cachedCount: snapshot.cachedCount }
                : {}),
            ...(previous.permission === "prompt" ? {
                reason: "waiting-permission",
                result: "waiting"
            } : {})
        });
        this.hydrationDiagnostic = Object.freeze({
            previous: Object.freeze({
                getterCalled: previousGetterCalled,
                initialized: previous.initialized ?? null,
                initializationStage: previous.initializationStage ?? null,
                hasHandle: previous.hasHandle ?? null,
                permission: previous.permission ?? null,
                handleType: previous.handleType ?? null,
                status: previous.status ?? null
            }),
            snapshot: Object.freeze({
                getterCalled: snapshotGetterCalled,
                provisional: snapshot.provisional ?? null,
                cachedCount: snapshot.cachedCount ?? null,
                libraryIdentity: snapshot.libraryIdentity ?? null
            }),
            coordinator: Object.freeze({
                runtimeBuildId: RUNTIME_BUILD_ID,
                hydrateCallCount: this.hydrateCallCount,
                reason,
                permission: this.refreshState.permission,
                hasHandle: this.refreshState.hasHandle,
                libraryState: this.refreshState.libraryState,
                cachedCount: this.refreshState.cachedCount
            })
        });
        this.accessPanel?.setLibraryRefreshHydrationDiagnostic?.(
            this.hydrationDiagnostic
        );
    }

    #publishRefreshState(values = {}) {

        const snapshot = this.librarySnapshotService.getRefreshContext?.();
        const libraryState = snapshot?.libraryState === "provisional" ||
            this.librarySnapshotService.isProvisional()
            ? "provisional"
            : this.getLibrary()
                ? "ready"
                : "none";
        const next = { ...this.refreshState, ...values, libraryState };
        const canManualRefresh = next.permission === "prompt" &&
            next.hasHandle === true && libraryState === "provisional" &&
            this.refreshActionConnected;

        const state = {
            ...next,
            canManualRefresh
        };

        if (this.lastPublishedState && Object.keys(state).every(
            key => this.lastPublishedState[key] === state[key]
        )) return;

        this.refreshState = Object.freeze(state);
        this.lastPublishedState = this.refreshState;
        this.accessPanel?.setLibraryRefreshState?.(this.refreshState);
    }
}
