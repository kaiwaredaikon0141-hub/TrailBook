import Folder from "../models/Folder.js";
import Library from "../models/Library.js";
import TrackDiscoveryEntry from "../models/TrackDiscoveryEntry.js";

function splitPath(path) {

    const parts = String(path || "").split("/").filter(Boolean);

    return {
        name: parts.at(-1) || "",
        parent: parts.slice(0, -1).join("/")
    };
}

function copyFilter(filter) {

    return filter && typeof filter === "object"
        ? JSON.parse(JSON.stringify(filter))
        : null;
}

function normalizeEntry(value) {

    if (!value || typeof value.relativePath !== "string" ||
        value.relativePath.length === 0) return null;

    const path = splitPath(value.relativePath);
    const summary = TrackDiscoveryEntry.fromRecord({
        relativePath: value.relativePath,
        folderPath: typeof value.folderPath === "string"
            ? value.folderPath
            : path.parent,
        originalFileName: value.originalFileName || path.name,
        displayName: value.displayName || path.name.replace(/\.gpx$/i, ""),
        trackNames: Array.isArray(value.trackNames) ? value.trackNames : [],
        resolvedDate: value.resolvedDate,
        dateSource: value.dateSource,
        pointCount: value.pointCount ?? 0,
        startTime: value.startTime,
        endTime: value.endTime,
        duration: value.duration,
        distance: value.distance ?? 0,
        elevationMin: value.elevationMin,
        elevationMax: value.elevationMax,
        fileSize: value.fileSize,
        lastModified: value.lastModified,
        status: value.status || "ready"
    });

    if (!summary) return null;

    return {
        ...summary.toRecord(),
        color: typeof value.color === "string" ? value.color : null
    };
}

export function normalizeLibrarySnapshot(value, libraryIdentity) {

    if (!value || value.identity !== libraryIdentity ||
        typeof value.rootName !== "string" || !value.rootName ||
        !Array.isArray(value.entries)) return null;

    const uniqueEntries = new Map();

    value.entries.forEach(candidate => {
        const entry = normalizeEntry(candidate);

        if (entry && !uniqueEntries.has(entry.relativePath)) {
            uniqueEntries.set(entry.relativePath, entry);
        }
    });

    const folders = Array.isArray(value.folders)
        ? [...new Set(value.folders.filter(path => typeof path === "string"))]
        : [];

    return {
        identity: libraryIdentity,
        rootName: value.rootName,
        folders,
        entries: [...uniqueEntries.values()],
        mode: value.mode === "date" ? "date" : "folder",
        filter: copyFilter(value.filter),
        expandedPaths: Array.isArray(value.expandedPaths)
            ? [...new Set(value.expandedPaths.filter(
                path => typeof path === "string"
            ))]
            : [""],
        expandedDateIds: Array.isArray(value.expandedDateIds)
            ? [...new Set(value.expandedDateIds.filter(
                id => typeof id === "string"
            ))]
            : []
    };
}

class CachedDirectoryHandle {

    constructor(name) {
        this.kind = "directory";
        this.name = name;
        this.provisional = true;
    }
}

class CachedFileHandle {

    constructor(entry) {
        this.kind = "file";
        this.name = entry.originalFileName;
        this.provisional = true;
        this.snapshotEntry = entry;
    }

    async getFile() {
        const ErrorType = globalThis.DOMException || Error;
        const error = new ErrorType(
            "The cached Library is read-only until access is restored.",
            "NotAllowedError"
        );
        if (error.name === "Error") error.name = "NotAllowedError";
        throw error;
    }
}

/** Builds and restores lightweight, viewer-only Library tree snapshots. */
export default class LibrarySnapshotService {

    constructor({
        treeView,
        discoveryCoordinator,
        displayState,
        searchView,
        accessPanel,
        eventBus,
        mapView,
        selectionState,
        getColor,
        trackCatalogCoordinator = null,
        getLastKnownFolderPresentations = () => new Map(),
        applyProvisionalFolderPresentations = () => {},
        statusBar = null,
        performanceNow = () => globalThis.performance?.now?.() ?? Date.now()
    }) {
        Object.assign(this, {
            treeView,
            discoveryCoordinator,
            displayState,
            searchView,
            accessPanel,
            eventBus,
            mapView,
            selectionState,
            getColor,
            trackCatalogCoordinator,
            getLastKnownFolderPresentations,
            applyProvisionalFolderPresentations,
            statusBar,
            performanceNow
        });
        this.provisional = false;
        this.cacheNamespace = null;
        this.provisionalPaths = new Set();
        this.lastRestoreDiagnostic = Object.freeze({ status: "idle" });
    }

    capture({ libraryIdentity, rootName }) {

        if (!libraryIdentity || !rootName) return null;

        const discovery = this.discoveryCoordinator.getSnapshotState();
        const summaries = new Map(discovery.entries.map(entry => [
            entry.relativePath,
            entry.toRecord()
        ]));
        const treeEntries = this.treeView.getSearchSourceEntries();

        return normalizeLibrarySnapshot({
            identity: libraryIdentity,
            rootName,
            folders: treeEntries
                .filter(entry => entry.kind === "folder")
                .map(entry => entry.path),
            entries: treeEntries
                .filter(entry => entry.kind === "file")
                .map(entry => ({
                    ...(summaries.get(entry.path) || {
                        relativePath: entry.path,
                        folderPath: splitPath(entry.path).parent,
                        originalFileName: entry.name,
                        displayName: entry.name.replace(/\.gpx$/i, ""),
                        trackNames: [],
                        pointCount: 0,
                        distance: 0,
                        status: "ready"
                    }),
                    color: this.getColor(entry.path)
                })),
            mode: discovery.mode,
            filter: discovery.filter,
            expandedPaths: [...this.treeView.expandedPaths],
            expandedDateIds: discovery.expandedDateIds
        }, libraryIdentity);
    }

    async restore(snapshot, {
        cacheNamespace,
        restoredTracks = [],
        selectedPath = null
    } = {}) {

        const startedAt = this.performanceNow();

        const state = normalizeLibrarySnapshot(snapshot, snapshot?.identity);

        if (!state || state.entries.length === 0) {
            this.lastRestoreDiagnostic = Object.freeze({ status: "skipped" });
            return false;
        }

        const model = this.#createLibrary(state);
        const modelReadyAt = this.performanceNow();

        this.treeView.expandedPaths = new Set(state.expandedPaths);
        this.treeView.focusedPath = "";
        await this.treeView.render(model.library, { preserveNavigation: true });
        const folderPresentations = this.getLastKnownFolderPresentations(
            state.identity
        );

        const folderPresentationUpdateCount =
            this.applyProvisionalFolderPresentations(folderPresentations) || 0;
        const treeReadyAt = this.performanceNow();
        this.trackCatalogCoordinator?.replaceProvisional(
            cacheNamespace,
            state.entries
        );
        const catalogReadyAt = this.performanceNow();
        const entriesByPath = new Map(
            state.entries.map(entry => [entry.relativePath, entry])
        );
        this.displayState.restoreSnapshotLibrary(
            model.library.rootFolder.handle,
            model.fileEntries.map(({ path, fileHandle }) => ({
                path,
                fileHandle,
                color: entriesByPath.get(path)?.color || this.getColor(path)
            })),
            restoredTracks
        );
        const displayReadyAt = this.performanceNow();
        const restoredTreeCount = this.#restoreTreeDisplayStates(restoredTracks);
        const treeDisplayReadyAt = this.performanceNow();
        this.treeView.setSelectedPath(selectedPath, { reveal: false });
        const selectionReadyAt = this.performanceNow();
        this.discoveryCoordinator.setProvisionalLibrary({
            namespace: cacheNamespace,
            libraryId: state.identity,
            fileEntries: model.fileEntries,
            entries: model.discoveryEntries,
            mode: state.mode,
            filter: state.filter,
            expandedDateIds: state.expandedDateIds
        });
        const discoveryReadyAt = this.performanceNow();
        this.searchView.setAvailable(true);
        this.accessPanel.setProvisionalLibrary(true);
        this.statusBar?.showLibraryLoaded(model.library);
        this.provisional = true;
        this.cacheNamespace = cacheNamespace;
        this.provisionalPaths = new Set(
            model.fileEntries.map(entry => entry.path)
        );
        this.eventBus?.emit("library:provisional-state-changed", {
            provisional: true
        });
        const completedAt = this.performanceNow();

        this.lastRestoreDiagnostic = Object.freeze({
            status: "completed",
            totalEntryCount: state.entries.length,
            restoredTrackCount: restoredTracks.length,
            displayPublicationCount: 1,
            treeRowUpdateCount: restoredTreeCount,
            folderAggregateCount: this.treeView.folderNodes.size,
            cachedFolderPresentationCount: folderPresentations.size,
            cachedFolderPresentationUpdateCount: folderPresentationUpdateCount,
            geometryLoadCount: 0,
            modelMs: modelReadyAt - startedAt,
            treeRenderMs: treeReadyAt - modelReadyAt,
            catalogSyncMs: catalogReadyAt - treeReadyAt,
            displayRestoreMs: displayReadyAt - catalogReadyAt,
            treeProjectionMs: treeDisplayReadyAt - displayReadyAt,
            selectionMs: selectionReadyAt - treeDisplayReadyAt,
            discoveryMs: discoveryReadyAt - selectionReadyAt,
            finalizationMs: completedAt - discoveryReadyAt,
            totalMs: completedAt - startedAt
        });
        return true;
    }

    getLastRestoreDiagnostic() {

        return this.lastRestoreDiagnostic;
    }

    #restoreTreeDisplayStates(entries) {

        const restoredPaths = [];

        entries.forEach(({ path, color }) => {
            const metadata = this.treeView.nodeMetadata.get(path);

            if (metadata?.kind !== "file") return;
            metadata.state = "loaded";
            metadata.error = null;
            metadata.checked = true;
            metadata.color = color;
            restoredPaths.push(path);
        });
        restoredPaths.forEach(path => this.treeView.refreshFileRow(path, false));

        const folderCounts = new Map(
            [...this.treeView.folderNodes.keys()].map(path => [path, {
                total: 0,
                checked: 0
            }])
        );

        this.treeView.nodeMetadata.forEach(metadata => {
            if (metadata.kind !== "file") return;
            let folderPath = metadata.parentPath;

            while (true) {
                const count = folderCounts.get(folderPath);

                if (count) {
                    count.total += 1;
                    if (metadata.checked) count.checked += 1;
                }
                if (!folderPath) break;
                folderPath = this.treeView.parentPath(folderPath);
            }
        });
        folderCounts.forEach(({ total, checked }, path) => {
            const checkbox = this.treeView.folderNodes.get(path)
                ?.querySelector(".folder-display-toggle");

            if (!checkbox) return;
            checkbox.disabled = total === 0;
            checkbox.checked = total > 0 && checked === total;
            checkbox.indeterminate = checked > 0 && checked < total;
        });

        return restoredPaths.length;
    }

    isProvisional() {
        return this.provisional;
    }

    isProvisionalFor(cacheNamespace) {
        return this.provisional && this.cacheNamespace === cacheNamespace;
    }

    hasProvisionalPath(relativePath) {

        return this.provisional && this.provisionalPaths.has(relativePath);
    }

    getRefreshContext() {

        return Object.freeze({
            provisional: this.provisional,
            libraryState: this.provisional ? "provisional" : "none",
            cachedCount: this.provisional
                ? this.provisionalPaths.size
                : null,
            libraryIdentity: this.cacheNamespace
        });
    }

    reconcileActual() {
        if (!this.provisional) return;

        const actualPaths = new Set(
            this.treeView.getFileEntries().map(entry => entry.path)
        );
        const checkedPaths = new Set(this.displayState.getCheckedPaths());

        this.provisionalPaths.forEach(path => {
            if (!actualPaths.has(path) || !checkedPaths.has(path)) {
                this.mapView.removeGPX(path);
            }
        });
        const selectedPath = this.selectionState.getSelectedPath();

        if (selectedPath && (
            !actualPaths.has(selectedPath) || !checkedPaths.has(selectedPath)
        )) {
            const change = this.selectionState.clear("system");
            if (change) this.eventBus?.emit("selection:changed", {
                path: null,
                previousPath: change.previousPath,
                reason: "library-reconciliation"
            });
        }
        this.markReady();
    }

    markReady() {
        if (!this.provisional) return false;

        this.provisional = false;
        this.cacheNamespace = null;
        this.provisionalPaths = new Set();
        this.accessPanel.setProvisionalLibrary(false);
        this.eventBus?.emit("library:provisional-state-changed", {
            provisional: false
        });
        return true;
    }

    #createLibrary(state) {

        const rootHandle = new CachedDirectoryHandle(state.rootName);
        const root = new Folder(state.rootName, rootHandle);
        const folders = new Map([["", root]]);

        const ensureFolder = path => {
            if (folders.has(path)) return folders.get(path);
            const parts = splitPath(path);
            const parent = ensureFolder(parts.parent);
            const folder = new Folder(
                parts.name,
                new CachedDirectoryHandle(parts.name)
            );

            parent.folders.push(folder);
            folders.set(path, folder);
            return folder;
        };

        state.folders.filter(Boolean).forEach(ensureFolder);
        const fileEntries = state.entries.map(entry => {
            const fileHandle = new CachedFileHandle(entry);

            ensureFolder(entry.folderPath).gpxFiles.push(fileHandle);
            return { path: entry.relativePath, fileHandle };
        });
        const discoveryEntries = state.entries
            .map(entry => TrackDiscoveryEntry.fromRecord(entry))
            .filter(Boolean);

        return {
            library: new Library(
                state.rootName,
                root,
                folders.size,
                fileEntries.length
            ),
            fileEntries,
            discoveryEntries
        };
    }
}
