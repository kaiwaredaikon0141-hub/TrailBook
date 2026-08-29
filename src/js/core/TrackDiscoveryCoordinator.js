import LibraryDiscoveryIndexService from "../services/LibraryDiscoveryIndexService.js";
import DateTreeBuilder from "../services/DateTreeBuilder.js";
import DiscoveryFilterService from "../services/DiscoveryFilterService.js";
import DateTreeView from "../ui/DateTreeView.js";
import FolderTreeFilterProjection from "../ui/FolderTreeFilterProjection.js";
import TrackInfoCoordinator from "./TrackInfoCoordinator.js";

/**
 * Coordinates lazy Discovery Index construction and Folder / Date projection.
 */
export default class TrackDiscoveryCoordinator {

    constructor({ eventBus, loader, displayState, modeStore }) {

        this.eventBus = eventBus;
        this.displayState = displayState;
        this.modeStore = modeStore;
        this.index = new LibraryDiscoveryIndexService({ loader, concurrency: 2 });
        this.builder = new DateTreeBuilder();
        this.filterService = new DiscoveryFilterService();
        this.dateTree = new DateTreeView(eventBus);
        this.trackInfo = new TrackInfoCoordinator({ index: this.index });
        this.mode = modeStore.getMode();
        this.available = false;
        this.generation = 0;
        this.isCurrent = () => false;
        this.fileHandles = new Map();
        this.pendingDisplayPaths = new Set();
        this.displaySyncScheduled = false;
        this.folderTree = null;
        this.folderFilter = null;
        this.searchView = null;
        this.activeFilter = this.filterService.normalize();
        this.filteredEntries = [];
        this.sidebarShell = null;
        this.controls = this.#createControls();
        this.#updateControls();
        this.displayState.subscribe(({ path }) => this.#scheduleDisplaySync(path));
    }

    attach({ folderTree, searchView = null }) {

        this.folderTree = folderTree;
        this.searchView = searchView;
        this.folderFilter = new FolderTreeFilterProjection(folderTree);
        const sidebar = folderTree.closest(".sidebar") || folderTree.parentElement;
        const shell = document.createElement("div");
        const fixed = document.createElement("div");

        shell.className = "sidebar-shell";
        fixed.className = "sidebar-fixed-controls";
        sidebar.classList.add("sidebar");
        sidebar.parentNode?.insertBefore(shell, sidebar);
        [...sidebar.children]
            .filter(child => child !== folderTree)
            .forEach(child => fixed.append(child));
        fixed.append(this.controls);
        sidebar.append(folderTree, this.dateTree.element);
        shell.append(fixed, sidebar, this.trackInfo.element);
        this.sidebarShell = shell;
        this.#applyMode();

        return shell;
    }

    bindEvents() {

        this.eventBus.on("selection:changed", ({ path }) => {
            this.dateTree.setSelectedPath(path, {
                reveal: this.mode === "date"
            });
            void this.trackInfo.setSelectedPath(path);
        });
        this.eventBus.on("discovery:index-cancel-requested", () => {
            this.index.cancel();
            this.dateTree.showCancelled();
        });
        this.eventBus.on("search:filter-changed", ({ filter }) => {
            void this.#setFilter(filter, { persist: true });
        });
        this.eventBus.on("search:results-refresh-requested", () => {
            this.#showFilterResults();
        });
    }

    setLibrary({ namespace, libraryId, fileEntries, generation, isCurrent }) {

        this.available = true;
        this.generation = generation;
        this.isCurrent = isCurrent;
        this.fileHandles = new Map(
            fileEntries.map(({ path, fileHandle }) => [path, fileHandle])
        );
        this.index.setLibrary({
            namespace,
            fileEntries,
            generation
        });
        this.trackInfo.setLibrary({ generation, isCurrent });
        this.activeFilter = this.filterService.normalize(
            this.modeStore.setActiveLibrary(libraryId)
        );
        this.searchView?.setFilter(this.activeFilter);
        this.dateTree.setAvailable(true);
        this.#updateControls();
        this.#applyMode();

        if (this.mode === "date" || this.filterService.isActive(this.activeFilter)) {
            void this.#buildIndex();
        }
    }

    setProvisionalLibrary({
        namespace,
        libraryId,
        fileEntries,
        entries,
        mode,
        filter,
        expandedDateIds = []
    }) {

        this.available = true;
        this.generation += 1;
        this.isCurrent = () => true;
        this.fileHandles = new Map(
            fileEntries.map(({ path, fileHandle }) => [path, fileHandle])
        );
        this.index.setLibrary({
            namespace,
            fileEntries,
            cachedEntries: entries,
            generation: this.generation
        });
        this.trackInfo.setLibrary({
            generation: this.generation,
            isCurrent: this.isCurrent
        });
        this.mode = mode === "date" ? "date" : "folder";
        this.modeStore.setMode(this.mode);
        this.activeFilter = this.filterService.normalize(filter);
        this.modeStore.setActiveLibrary(libraryId);
        this.searchView?.setFilter(this.activeFilter);
        this.dateTree.expandedIds = new Set(expandedDateIds);
        this.dateTree.setAvailable(true);
        this.#updateControls();
        this.#applyMode();
        this.#applyFilter(entries);
    }

    getSnapshotState() {

        return {
            entries: this.index.getEntries(),
            mode: this.mode,
            filter: this.activeFilter,
            expandedDateIds: [...this.dateTree.expandedIds]
        };
    }

    reconcileLibrary({ namespace, fileEntries, entries }) {

        if (!this.available) return false;
        this.fileHandles = new Map(
            fileEntries.map(({ path, fileHandle }) => [path, fileHandle])
        );
        this.index.setLibrary({
            namespace,
            fileEntries,
            cachedEntries: entries,
            generation: this.generation
        });
        this.trackInfo.setLibrary({
            generation: this.generation,
            isCurrent: this.isCurrent
        });
        this.#applyFilter(entries);
        return true;
    }

    clearLibrary() {

        this.available = false;
        this.generation += 1;
        this.isCurrent = () => false;
        this.fileHandles.clear();
        this.index.cancel();
        this.folderFilter?.clear();
        this.filteredEntries = [];
        this.activeFilter = this.filterService.normalize();
        this.modeStore.setActiveLibrary(null);
        this.searchView?.setFilter(this.activeFilter);
        this.trackInfo.clearLibrary();
        this.dateTree.setAvailable(false);
        this.#updateControls();
        this.#applyMode();
    }

    async addFileEntry({ path, fileHandle } = {}) {

        if (
            !this.available || !path || !fileHandle ||
            this.fileHandles.has(path) ||
            !this.index.addFileEntry({ relativePath: path, fileHandle })
        ) {
            return false;
        }

        this.fileHandles.set(path, fileHandle);

        if (this.index.getStatus() === "ready") {
            await this.index.loadEntry(path, {
                isCurrent: generation =>
                    generation === this.generation && this.isCurrent()
            });

            if (!this.isCurrent()) return false;
            this.#applyFilter();
        }

        return true;
    }

    async refreshFileEntry({ path, fileHandle } = {}) {

        const hadLoadedEntry = Boolean(this.index.getEntry(path));

        if (
            !this.available || !path || !fileHandle ||
            !this.fileHandles.has(path) ||
            !this.index.replaceFileEntry({ relativePath: path, fileHandle })
        ) {
            return false;
        }

        this.fileHandles.set(path, fileHandle);
        const status = this.index.getStatus();

        if (hadLoadedEntry || status === "ready" || status === "building") {
            const entry = await this.index.loadEntry(path, {
                isCurrent: generation =>
                    generation === this.generation && this.isCurrent()
            });

            if (!entry || !this.isCurrent()) return false;
            if (this.index.getStatus() === "ready") this.#applyFilter();
            await this.trackInfo.setSelectedPath(this.trackInfo.selectedPath);
        }

        return true;
    }

    async renameFileEntry({ sourcePath, targetPath, fileHandle } = {}) {

        if (
            !this.available || !sourcePath || !targetPath || !fileHandle ||
            !this.fileHandles.has(sourcePath) || this.fileHandles.has(targetPath)
        ) return false;

        const shouldReload = this.index.renameFileEntry({
            sourcePath,
            targetPath,
            fileHandle
        });

        this.fileHandles.delete(sourcePath);
        this.fileHandles.set(targetPath, fileHandle);

        if (shouldReload || this.index.getStatus() === "ready") {
            const entry = await this.index.loadEntry(targetPath, {
                isCurrent: generation =>
                    generation === this.generation && this.isCurrent()
            });

            if (!entry || !this.isCurrent()) return false;
            if (this.index.getStatus() === "ready") this.#applyFilter();
        }

        return true;
    }

    getMode() {

        return this.mode;
    }

    setMode(mode) {

        if (!this.available || (mode !== "folder" && mode !== "date")) {
            return false;
        }

        this.mode = mode;
        this.modeStore.setMode(mode);
        this.#updateControls();
        this.#applyMode();

        if (mode === "date") {
            this.dateTree.revealSelectedPath();
            void this.#buildIndex();
        }

        return true;
    }

    async #buildIndex() {

        if (
            !this.available ||
            (this.mode !== "date" && !this.filterService.isActive(this.activeFilter))
        ) {
            return;
        }

        if (this.index.getStatus() === "ready") {
            this.#applyFilter();
            return;
        }

        const generation = this.generation;

        this.dateTree.showBuilding({
            completed: 0,
            total: this.fileHandles.size
        });
        this.searchView?.showFilterBuilding(this.activeFilter, {
            completed: 0,
            total: this.fileHandles.size
        });

        try {
            const entries = await this.index.build({
                isCurrent: candidate => (
                    candidate === generation && this.isCurrent()
                ),
                onProgress: progress => {
                    if (generation === this.generation && this.isCurrent()) {
                        this.dateTree.showBuilding(progress);
                        this.searchView?.showFilterBuilding(
                            this.activeFilter,
                            progress
                        );
                    }
                }
            });

            if (
                generation !== this.generation ||
                !this.isCurrent() ||
                this.index.getStatus() !== "ready"
            ) {
                return;
            }

            this.#applyFilter(entries);
        } catch {
            if (generation === this.generation && this.isCurrent()) {
                this.dateTree.showError();
            }
        }
    }

    #showEntries(entries) {

        this.dateTree.showTree(this.builder.build(entries), {
            fileHandles: this.fileHandles,
            getDisplay: path => this.displayState.getDisplay(path)
        });
    }

    async #setFilter(filter, { persist = false } = {}) {

        this.activeFilter = this.filterService.normalize(filter);
        if (persist) this.modeStore.setFilter(this.activeFilter);

        if (!this.filterService.isActive(this.activeFilter)) {
            this.folderFilter?.clear();
            this.filteredEntries = [];
            this.searchView?.showFilterResults(
                { totalCount: 0, results: [] },
                this.activeFilter
            );
            if (this.index.getStatus() === "ready") {
                this.#showEntries(this.index.getEntries());
            }
            return;
        }

        await this.#buildIndex();
    }

    #applyFilter(entries = this.index.getEntries()) {

        const active = this.filterService.isActive(this.activeFilter);
        const result = active
            ? this.filterService.filter(entries, this.activeFilter)
            : { entries, totalCount: entries.length, results: [] };

        this.filteredEntries = result.entries;
        this.folderFilter?.setMatchingPaths(
            active ? result.entries.map(entry => entry.relativePath) : null
        );
        this.#showEntries(result.entries);
        this.#showFilterResults(result);
    }

    #showFilterResults(result = null) {

        if (!this.searchView || !this.filterService.isActive(this.activeFilter)) {
            return;
        }

        const filtered = result || this.filterService.filter(
            this.index.getEntries(),
            this.activeFilter
        );
        const results = filtered.results.map(entry => {
            const display = this.displayState.getDisplay(entry.relativePath);

            return {
                kind: "file",
                path: entry.relativePath,
                name: entry.displayName,
                checked: Boolean(display?.checked),
                state: display?.state || "idle",
                color: display?.color || null
            };
        });

        this.searchView.showFilterResults({
            totalCount: filtered.totalCount,
            results
        }, this.activeFilter);
    }

    #scheduleDisplaySync(path) {

        if (path === null) {
            this.pendingDisplayPaths.clear();
            this.pendingDisplayPaths.add(null);
        } else if (!this.pendingDisplayPaths.has(null)) {
            this.pendingDisplayPaths.add(path);
        }

        if (this.displaySyncScheduled) return;

        this.displaySyncScheduled = true;
        queueMicrotask(() => {
            const paths = [...this.pendingDisplayPaths];

            this.pendingDisplayPaths.clear();
            this.displaySyncScheduled = false;
            paths.forEach(candidate => this.dateTree.syncDisplay(candidate));
            this.#showFilterResults();
        });
    }

    #createControls() {

        const group = document.createElement("div");

        group.className = "discovery-mode-switch";
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", "Library表示");
        group.innerHTML = `
            <button type="button" data-discovery-mode="folder">Folder</button>
            <button type="button" data-discovery-mode="date">Date</button>
        `;
        group.addEventListener("click", event => {
            const button = event.target.closest("[data-discovery-mode]");

            if (button) {
                this.setMode(button.dataset.discoveryMode);
            }
        });

        return group;
    }

    #updateControls() {

        this.controls.querySelectorAll("[data-discovery-mode]").forEach(button => {
            const selected = button.dataset.discoveryMode === this.mode;

            button.disabled = !this.available;
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    #applyMode() {

        if (!this.folderTree) {
            return;
        }

        const showDate = this.available && this.mode === "date";

        this.folderTree.hidden = showDate;
        this.dateTree.element.hidden = !showDate;
    }
}
