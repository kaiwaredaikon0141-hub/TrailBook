import TreeMetadataBuilder from "../ui/TreeMetadataBuilder.js";
import TrackSummaryBuilder from "../services/TrackSummaryBuilder.js";
import TrackDiscoveryEntry from "../models/TrackDiscoveryEntry.js";
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
            getLibrary, setLibrary, getColor, removePath, reloadVisiblePath,
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
            addedCount: null, removedCount: null, modifiedCount: null,
            reason: "none", result: "idle", performance: null
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
    }

    bind() {
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

        this.#updateRefreshPerformance({
            mode: "incremental",
            enumerationMs,
            directoryEntryCount: scanDiagnostic?.directoryEntryCount ??
                library.folderCount + library.gpxFileCount,
            gpxCandidateCount: scanDiagnostic?.gpxCandidateCount ??
                library.gpxFileCount,
            scannedCount: scanned
        });

        if (currentLibrary !== this.getLibrary()) return false;
        const result = await this.#reconcile(library, currentLibrary);

        this.#publishRefreshState({
            scannedCount: scanned,
            addedCount: result?.added ?? null,
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
        const addedPaths = new Set(added.map(({ path }) =>
            normalizeRelativePath(path)
        ));
        const previousDisplays = new Map(
            [...this.displayState.getDisplays().values()].map(display => [
                normalizeRelativePath(display.path),
                {
                    checked: display.checked,
                    color: display.color
                }
            ])
        );
        const resolveAddedColor = path => {
            const folderPath = normalizedFolderPath(path);
            const sibling = [...previousDisplays.entries()].find(
                ([candidatePath, display]) =>
                    !addedPaths.has(candidatePath) &&
                    normalizedFolderPath(candidatePath) === folderPath &&
                    typeof display.color === "string" && display.color
            );

            return sibling?.[1].color ?? this.getColor(path);
        };
        const diffMs = this.performanceNow() - diffStartedAt;
        const validationStartedAt = this.performanceNow();
        const metadata = await this.#readMetadata(fileEntries, oldPaths);
        const checked = new Set(this.displayState.getCheckedPaths());
        const checkedPaths = new Set([...checked].map(normalizeRelativePath));
        const namespace = this.getNamespace();
        const previousIdentities = await this.#readPreviousIdentities(
            checked,
            oldEntries,
            namespace
        );
        const validationMs = this.performanceNow() - validationStartedAt;
        if (this.getLibrary() !== expectedLibrary) return false;
        const changed = fileEntries.filter(({ path }) => {
            const key = normalizeRelativePath(path);
            const previous = previousIdentities.get(key);
            const current = metadata.get(path);

            return oldPaths.has(key) && !addedPaths.has(key) &&
                current && previous && (
                previous.size !== current.size ||
                previous.lastModified !== current.lastModified
            );
        });
        const changedPaths = new Set(changed.map(({ path }) =>
            normalizeRelativePath(path)
        ));
        const unchangedCount = fileEntries.filter(({ path }) =>
            oldPaths.has(normalizeRelativePath(path)) &&
            !addedPaths.has(normalizeRelativePath(path)) &&
            !changedPaths.has(normalizeRelativePath(path))
        ).length;
        const selectedPath = this.selectionState.getSelectedPath();

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
        fileEntries.forEach(({ path, fileHandle }) => {
            const key = normalizeRelativePath(path);
            const previous = previousDisplays.get(key);

            this.displayState.registerFile(
                path,
                fileHandle,
                addedPaths.has(key)
                    ? resolveAddedColor(path)
                    : previous?.color ?? this.getColor(path)
            );
            if (addedPaths.has(key)) {
                this.displayState.setChecked(path, false);
            } else if (previous) {
                this.displayState.setChecked(path, previous.checked);
            }
        });
        for (const { path } of changed) {
            await this.repository.invalidate(namespace, path);
            this.displayState.invalidateCachedResult(path);
            this.displayState.setIdle(path);
        }
        removed.forEach(path => this.displayState.unregisterFile(path));
        let modifiedProcessingMs = this.performanceNow() - modifiedStartedAt;

        const reconcileStartedAt = this.performanceNow();
        const affectedPaths = [
            ...added.map(({ path }) => path),
            ...removed
        ];

        await this.treeReconciler.reconcile(
            this.treeView,
            library,
            { affectedPaths }
        );
        this.setLibrary(library);

        let metadataExtractionCount = 0;
        const addedProcessingStartedAt = this.performanceNow();
        const discoveryEntries = fileEntries.map(({ path, fileHandle }) => {
            const key = normalizeRelativePath(path);
            const previous = oldEntries.get(key);
            const file = metadata.get(path);

            if (previous && !changedPaths.has(key)) return previous;
            if (previous && file) return TrackDiscoveryEntry.fromRecord({
                ...previous.toRecord(),
                fileSize: file.size,
                lastModified: file.lastModified
            });
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

        this.#restoreTreePresentation(reconciledSelectedPath);
        added.forEach(({ path }) => {
            this.displayState.setChecked(path, false);
            this.treeView.setDisplayChecked(path, false);
        });

        let delegatedVisibleReloadCount = 0;
        for (const { path, fileHandle } of changed) {
            if (checkedPaths.has(normalizeRelativePath(path))) {
                const reloadStartedAt = this.performanceNow();

                delegatedVisibleReloadCount += 1;
                await this.reloadVisiblePath({ path, fileHandle });
                modifiedProcessingMs += this.performanceNow() - reloadStartedAt;
            }
        }
        const snapshotStartedAt = this.performanceNow();
        const performanceRunStartedAt = this.refreshPerformance?.startedAt;
        const snapshotUpdate = this.onLibraryUpdated(library, {
            preserveExistingPresentation: true
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
            added: added.length,
            removed: removed.length,
            modified: changed.length,
            snapshotCommitted
        });
        return this.lastResult;
    }

    async #readMetadata(entries, existingPaths) {

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
                    if (existingPaths.has(normalizeRelativePath(entry.path))) {
                        existingGetFileCount += 1;
                    } else {
                        addedGetFileCount += 1;
                    }
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
