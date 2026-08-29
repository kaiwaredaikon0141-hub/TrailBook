import TreeMetadataBuilder from "../ui/TreeMetadataBuilder.js";
import TrackSummaryBuilder from "../services/TrackSummaryBuilder.js";
import TrackDiscoveryEntry from "../models/TrackDiscoveryEntry.js";

const METADATA_CONCURRENCY = 8;

/** Refreshes an already-present local Library without clearing Viewer state. */
export default class LibraryRefreshCoordinator {

    constructor({
        eventBus, scanner, previousLibraryCoordinator, librarySnapshotService,
        treeView, discoveryCoordinator, displayState, selectionState,
        repository, getNamespace, getLibrary, setLibrary, getColor,
        removePath, reloadVisiblePath, onLibraryUpdated,
        canRefresh = () => true,
        now = () => Date.now(),
        minimumIntervalMs = 2000,
        metadataBuilder = new TreeMetadataBuilder(),
        summaryBuilder = new TrackSummaryBuilder()
    }) {
        Object.assign(this, {
            eventBus, scanner, previousLibraryCoordinator,
            librarySnapshotService, treeView, discoveryCoordinator,
            displayState, selectionState, repository, getNamespace,
            getLibrary, setLibrary, getColor, removePath, reloadVisiblePath,
            onLibraryUpdated, canRefresh, now, minimumIntervalMs,
            metadataBuilder, summaryBuilder
        });
        this.activeRefresh = null;
        this.lastResult = null;
        this.lastCompletedAt = -Infinity;
    }

    bind() {
        this.eventBus.on("library:sidebar-opened", () => void this.refresh());
    }

    refresh() {
        if (this.activeRefresh) return this.activeRefresh;
        if (!this.canRefresh() || this.previousLibraryCoordinator.isLoading() ||
            this.now() - this.lastCompletedAt < this.minimumIntervalMs) {
            return Promise.resolve(false);
        }
        this.activeRefresh = this.#refresh().finally(() => {
            this.lastCompletedAt = this.now();
            this.activeRefresh = null;
        });
        return this.activeRefresh;
    }

    async #refresh() {

        const currentLibrary = this.getLibrary();
        const handle = currentLibrary?.rootFolder?.handle ||
            this.previousLibraryCoordinator.getRefreshHandle();
        const permission = await this.previousLibraryCoordinator
            .queryRefreshPermission(handle);

        if (!handle || permission !== "granted") return false;
        if (!currentLibrary) {
            return this.librarySnapshotService.isProvisional()
                ? this.previousLibraryCoordinator.refreshPreviousIfGranted()
                : false;
        }

        const library = await this.scanner.scan(handle);

        if (currentLibrary !== this.getLibrary()) return false;
        return this.#reconcile(library, currentLibrary);
    }

    async #reconcile(library, expectedLibrary) {

        const prepared = this.metadataBuilder.build(library);
        const fileEntries = this.metadataBuilder.getFileEntries(
            prepared.nodeMetadata
        );
        const oldEntries = new Map(
            this.discoveryCoordinator.getSnapshotState().entries.map(entry => [
                entry.relativePath,
                entry
            ])
        );
        const oldPaths = new Set(this.treeView.getFileEntries().map(({ path }) => path));
        const newPaths = new Set(fileEntries.map(({ path }) => path));
        const removed = [...oldPaths].filter(path => !newPaths.has(path));
        const added = fileEntries.filter(({ path }) => !oldPaths.has(path));
        const metadata = await this.#readMetadata(fileEntries);
        const checked = new Set(this.displayState.getCheckedPaths());
        const namespace = this.getNamespace();
        const previousIdentities = await this.#readPreviousIdentities(
            checked,
            oldEntries,
            namespace
        );
        if (this.getLibrary() !== expectedLibrary) return false;
        const changed = fileEntries.filter(({ path }) => {
            const previous = previousIdentities.get(path);
            const current = metadata.get(path);

            return oldPaths.has(path) && current && previous && (
                previous.size !== current.size ||
                previous.lastModified !== current.lastModified
            );
        });
        const changedPaths = new Set(changed.map(({ path }) => path));
        const selectedPath = this.selectionState.getSelectedPath();

        removed.forEach(path => this.removePath(path));
        fileEntries.forEach(({ path, fileHandle }) => {
            this.displayState.registerFile(path, fileHandle, this.getColor(path));
        });
        for (const { path } of changed) {
            await this.repository.invalidate(namespace, path);
            this.displayState.invalidateCachedResult(path);
            this.displayState.setIdle(path);
        }
        removed.forEach(path => this.displayState.unregisterFile(path));

        await this.treeView.render(library, { preserveNavigation: true });
        this.setLibrary(library);

        const discoveryEntries = fileEntries.map(({ path, fileHandle }) => {
            const previous = oldEntries.get(path);
            const file = metadata.get(path);

            if (previous && !changedPaths.has(path)) return previous;
            if (previous && file) return TrackDiscoveryEntry.fromRecord({
                ...previous.toRecord(),
                fileSize: file.size,
                lastModified: file.lastModified
            });
            return this.summaryBuilder.build(path, file || {
                name: fileHandle.name
            }, null);
        }).filter(Boolean);

        this.discoveryCoordinator.reconcileLibrary({
            namespace,
            fileEntries,
            entries: discoveryEntries
        });
        this.#restoreTreePresentation(selectedPath);

        for (const { path, fileHandle } of changed) {
            if (checked.has(path)) await this.reloadVisiblePath({ path, fileHandle });
        }
        this.onLibraryUpdated(library);
        this.lastResult = Object.freeze({
            added: added.length,
            removed: removed.length,
            modified: changed.length
        });
        return this.lastResult;
    }

    async #readMetadata(entries) {

        const result = new Map();
        let nextIndex = 0;
        const worker = async () => {
            while (nextIndex < entries.length) {
                const entry = entries[nextIndex++];
                try {
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
        return result;
    }

    async #readPreviousIdentities(checkedPaths, entries, namespace) {

        const identities = new Map();

        entries.forEach((entry, path) => {
            if (Number.isFinite(entry.fileSize) &&
                Number.isFinite(entry.lastModified)) {
                identities.set(path, {
                    size: entry.fileSize,
                    lastModified: entry.lastModified
                });
            }
        });
        await Promise.all([...checkedPaths].map(async path => {
            if (identities.has(path)) return;
            const cached = await this.repository.getDisplaySnapshot?.(
                namespace,
                path
            );

            if (cached?.fileIdentity) identities.set(path, cached.fileIdentity);
        }));
        return identities;
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
}
