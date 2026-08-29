import TreeMetadataBuilder from "../ui/TreeMetadataBuilder.js";
import TrackSummaryBuilder from "../services/TrackSummaryBuilder.js";
import TrackDiscoveryEntry from "../models/TrackDiscoveryEntry.js";

const METADATA_CONCURRENCY = 8;

/** Refreshes an already-present local Library without clearing Viewer state. */
export default class LibraryRefreshCoordinator {

    constructor({
        eventBus, scanner, previousLibraryCoordinator, librarySnapshotService,
        treeView, discoveryCoordinator, displayState, selectionState, accessPanel,
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
            displayState, selectionState, accessPanel, repository, getNamespace,
            getLibrary, setLibrary, getColor, removePath, reloadVisiblePath,
            onLibraryUpdated, canRefresh, now, minimumIntervalMs,
            metadataBuilder, summaryBuilder
        });
        this.activeRefresh = null;
        this.lastResult = null;
        this.lastCompletedAt = -Infinity;
        this.diagnostic = {
            permission: "unknown", handle: false, cached: 0, scanned: 0,
            added: 0, removed: 0, modified: 0,
            reason: "none", result: "idle"
        };
        this.#attachDiagnostic();
        this.accessPanel?.setLibraryRefreshAction?.(
            () => void this.refresh({ reason: "refresh-action", reconnect: true })
        );
    }

    bind() {
        this.eventBus.on(
            "library:sidebar-opened",
            () => void this.refresh({ reason: "sidebar-open" })
        );
    }

    getDiagnostic() {
        return { ...this.diagnostic };
    }

    refresh({ reason = "manual", reconnect = false } = {}) {
        if (this.activeRefresh) return this.activeRefresh;
        if (!this.canRefresh() || this.previousLibraryCoordinator.isLoading() ||
            (!reconnect &&
                this.now() - this.lastCompletedAt < this.minimumIntervalMs)) {
            this.#updateDiagnostic({ reason, result: "suppressed" });
            return Promise.resolve(false);
        }
        this.#updateDiagnostic({ reason, result: "checking" });
        this.activeRefresh = (reconnect ? this.#reconnect() : this.#refresh())
            .finally(() => {
                this.lastCompletedAt = this.now();
                this.activeRefresh = null;
            });
        return this.activeRefresh;
    }

    async #reconnect() {

        const cached = this.treeView.getFileEntries?.().length ?? 0;
        const handle = this.previousLibraryCoordinator.getRefreshHandle();

        this.#updateDiagnostic({ handle: Boolean(handle), cached });
        if (!handle) {
            this.accessPanel?.showLibraryRefreshAction?.(false);
            this.#updateDiagnostic({ result: "no-handle" });
            return false;
        }
        const opened = await this.previousLibraryCoordinator.openPrevious();
        const scanned = this.treeView.getFileEntries?.().length ?? cached;

        this.accessPanel?.showLibraryRefreshAction?.(!opened);
        this.#updateDiagnostic({
            permission: opened ? "granted" : "denied",
            scanned,
            added: opened ? Math.max(0, scanned - cached) : 0,
            result: opened ? "refreshed" : "permission-denied"
        });
        return opened;
    }

    async #refresh() {

        const currentLibrary = this.getLibrary();
        const handle = currentLibrary?.rootFolder?.handle ||
            this.previousLibraryCoordinator.getRefreshHandle();
        const cached = this.treeView.getFileEntries?.().length ?? 0;

        this.#updateDiagnostic({ handle: Boolean(handle), cached });
        if (!handle) {
            this.accessPanel?.showLibraryRefreshAction?.(false);
            this.#updateDiagnostic({ result: "no-handle" });
            return false;
        }
        const permission = await this.previousLibraryCoordinator
            .queryRefreshPermission(handle);

        this.#updateDiagnostic({ permission });
        if (permission === "prompt") {
            this.accessPanel?.showLibraryRefreshAction?.(true);
            this.#updateDiagnostic({ result: "permission-required" });
            return false;
        }
        if (permission !== "granted") {
            this.accessPanel?.showLibraryRefreshAction?.(false);
            this.#updateDiagnostic({ result: "permission-denied" });
            return false;
        }
        if (!currentLibrary) {
            const opened = this.librarySnapshotService.isProvisional()
                ? this.previousLibraryCoordinator.refreshPreviousIfGranted()
                : false;

            const result = await opened;
            const scanned = this.treeView.getFileEntries?.().length ?? cached;

            this.accessPanel?.showLibraryRefreshAction?.(!result);
            this.#updateDiagnostic({
                scanned,
                added: result ? Math.max(0, scanned - cached) : 0,
                result: result ? "refreshed" : "not-ready"
            });
            return result;
        }

        const library = await this.scanner.scan(handle);
        const scanned = library.gpxFileCount;

        if (currentLibrary !== this.getLibrary()) return false;
        const result = await this.#reconcile(library, currentLibrary);

        this.accessPanel?.showLibraryRefreshAction?.(false);
        this.#updateDiagnostic({
            scanned,
            ...(result || {}),
            result: result ? "refreshed" : "stale-context"
        });
        return result;
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

    #attachDiagnostic() {

        if (!this.accessPanel?.element || !globalThis.document?.createElement) return;
        this.diagnosticElement = document.createElement("details");
        this.diagnosticElement.className =
            "fast-restore-diagnostic library-refresh-diagnostic";
        this.diagnosticElement.innerHTML =
            "<summary>Library Refresh</summary><pre></pre>";
        this.accessPanel.element.append(this.diagnosticElement);
        this.#updateDiagnostic();
    }

    #updateDiagnostic(values = {}) {

        Object.assign(this.diagnostic, values);
        const output = this.diagnosticElement?.querySelector("pre");

        if (!output) return;
        output.textContent = [
            `permission: ${this.diagnostic.permission}`,
            `handle: ${this.diagnostic.handle ? "yes" : "no"}`,
            `cached: ${this.diagnostic.cached}`,
            `scanned: ${this.diagnostic.scanned}`,
            `added: ${this.diagnostic.added}`,
            `removed: ${this.diagnostic.removed}`,
            `modified: ${this.diagnostic.modified}`,
            `last reason: ${this.diagnostic.reason}`,
            `result: ${this.diagnostic.result}`
        ].join("\n");
    }
}
