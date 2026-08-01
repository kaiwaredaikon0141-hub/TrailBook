import TreeMetadataBuilder from "./TreeMetadataBuilder.js";

const ROOT_PATH = "";

const NODE_SELECTOR = "[data-tree-path]";

/**
 * Displays a lazy, keyboard-navigable folder tree.
 */
export default class TreeView {

    constructor(eventBus) {

        this.eventBus = eventBus;
        this.metadataBuilder = new TreeMetadataBuilder();
        this.expandedPaths = new Set([ROOT_PATH]);
        this.focusedPath = ROOT_PATH;
        this.selectedFilePath = null;
        this.folderNodes = new Map();
        this.fileNodes = new Map();
        this.nodeMetadata = new Map();
        this.fileHandlesByPath = new Map();
        this.pathsByFileHandle = new Map();
        this.scrollTop = 0;
        this.currentRootHandle = null;
        this.currentLibrary = null;
        this.renderRequestId = 0;
        this.element = this.create();
    }

    create() {

        const aside = document.createElement("aside");

        aside.className = "sidebar";

        aside.innerHTML = `
            <h3>Library</h3>
            <ul class="tree-root" role="tree" aria-label="Library"></ul>
        `;

        const rootList = aside.querySelector(".tree-root");

        rootList.addEventListener("click", event => this.handleClick(event));
        rootList.addEventListener("change", event => this.handleChange(event));
        rootList.addEventListener("keydown", event => this.handleKeyDown(event));
        rootList.addEventListener("focusin", event => this.handleFocusIn(event));

        return aside;
    }

    /**
     * @param {import("../models/Library.js").default} library
     * @returns {Promise<void>}
     */
    async render(library) {

        const requestId = ++this.renderRequestId;
        const previousState = this.captureNavigationState();
        const previousCommittedState = this.captureCommittedState();

        try {

            const prepared = this.metadataBuilder.build(library);
            const sameLibrary = await this.isSameLibrary(prepared.rootHandle);

            if (requestId !== this.renderRequestId) {
                return;
            }

            const expandedPaths = sameLibrary
                ? this.metadataBuilder.filterExpandedPaths(
                    previousState.expandedPaths,
                    prepared.nodeMetadata
                )
                : new Set([ROOT_PATH]);

            expandedPaths.add(ROOT_PATH);

            const focusedPath = sameLibrary
                ? this.metadataBuilder.findRestorableFocus(
                    previousState.focusedPath,
                    expandedPaths,
                    prepared.nodeMetadata
                )
                : ROOT_PATH;

            this.commitPreparedLibrary(
                prepared,
                expandedPaths,
                focusedPath
            );

            const rootList = this.element.querySelector(".tree-root");

            const rootNode = this.createFolderNode(
                prepared.library.rootFolder,
                ROOT_PATH,
                true
            );

            rootList.replaceChildren(rootNode);

            this.applyFocusState();

            this.element.scrollTop = sameLibrary
                ? previousState.scrollTop
                : 0;

            this.scrollTop = this.element.scrollTop;

        } catch (error) {

            Object.assign(this, previousCommittedState);

            console.error("TreeView render failed.", error);
        }
    }

    commitPreparedLibrary(prepared, expandedPaths, focusedPath) {

        this.currentLibrary = prepared.library;
        this.currentRootHandle = prepared.rootHandle;
        this.expandedPaths = expandedPaths;
        this.focusedPath = focusedPath;
        this.selectedFilePath = null;
        this.folderNodes = new Map();
        this.fileNodes = new Map();
        this.nodeMetadata = prepared.nodeMetadata;
        this.fileHandlesByPath = prepared.fileHandlesByPath;
        this.pathsByFileHandle = prepared.pathsByFileHandle;
        this.scrollTop = 0;
    }

    captureNavigationState() {

        return {
            expandedPaths: new Set(this.expandedPaths),
            focusedPath: this.focusedPath,
            scrollTop: this.element.scrollTop
        };
    }

    captureCommittedState() {

        return {
            currentLibrary: this.currentLibrary,
            currentRootHandle: this.currentRootHandle,
            expandedPaths: this.expandedPaths,
            focusedPath: this.focusedPath,
            selectedFilePath: this.selectedFilePath,
            folderNodes: this.folderNodes,
            fileNodes: this.fileNodes,
            nodeMetadata: this.nodeMetadata,
            fileHandlesByPath: this.fileHandlesByPath,
            pathsByFileHandle: this.pathsByFileHandle,
            scrollTop: this.scrollTop
        };
    }

    async isSameLibrary(nextRootHandle) {

        if (!this.currentRootHandle) {
            return false;
        }

        if (this.currentRootHandle === nextRootHandle) {
            return true;
        }

        if (
            typeof this.currentRootHandle.isSameEntry !== "function" ||
            typeof nextRootHandle?.isSameEntry !== "function"
        ) {
            return false;
        }

        try {
            return await this.currentRootHandle.isSameEntry(nextRootHandle);
        } catch (error) {
            return false;
        }
    }

    createFolderNode(folder, path, isRoot = false) {

        const item = document.createElement("li");
        const row = document.createElement("div");

        row.className = "tree-row folder-row";
        row.dataset.treePath = path;
        row.dataset.nodeKind = "folder";
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-expanded", "true");
        row.tabIndex = -1;
        row.title = folder.name;
        row.innerHTML = `
            <input
                class="folder-display-toggle"
                type="checkbox"
            >
            <span class="tree-icon" aria-hidden="true"></span>
            <span class="tree-label"></span>
        `;
        row.querySelector(".tree-label").textContent = folder.name;
        row.querySelector(".folder-display-toggle").setAttribute(
            "aria-label",
            `配下のGPXを地図に表示: ${folder.name}`
        );
        item.append(row);
        this.folderNodes.set(path, row);

        if (isRoot || this.expandedPaths.has(path)) {
            this.appendFolderChildren(item, folder, path);
        }

        this.updateFolderRow(row, isRoot || this.expandedPaths.has(path));
        this.refreshFolderRow(path);

        return item;
    }

    appendFolderChildren(item, folder, path) {

        const group = document.createElement("ul");

        group.className = "tree-group";
        group.setAttribute("role", "group");

        this.sortNodes(folder.folders).forEach(childFolder => {
            group.append(
                this.createFolderNode(
                    childFolder,
                    this.joinPath(path, childFolder.name)
                )
            );
        });

        this.sortNodes(folder.gpxFiles).forEach(fileHandle => {
            group.append(
                this.createFileNode(
                    fileHandle,
                    this.joinPath(path, fileHandle.name)
                )
            );
        });

        item.append(group);
    }

    createFileNode(fileHandle, path) {

        const item = document.createElement("li");
        const row = document.createElement("div");

        row.className = "tree-row gpx-file";
        row.dataset.treePath = path;
        row.dataset.nodeKind = "file";
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-selected", "false");
        row.tabIndex = -1;
        row.title = fileHandle.name;
        row.innerHTML = `
            <input
                class="gpx-display-toggle"
                type="checkbox"
            >
            <span class="tree-icon" aria-hidden="true">●</span>
            <span class="tree-color-indicator" aria-hidden="true"></span>
            <span class="tree-label"></span>
        `;
        row.querySelector(".tree-label").textContent = fileHandle.name;
        row.querySelector(".gpx-display-toggle").setAttribute(
            "aria-label",
            `地図に表示: ${fileHandle.name}`
        );
        item.append(row);
        this.fileNodes.set(path, row);
        this.refreshFileRow(path);

        return item;
    }

    sortNodes(nodes) {

        return [...nodes].sort((first, second) => {

            const result = first.name.localeCompare(
                second.name,
                undefined,
                { sensitivity: "base" }
            );

            return result || first.name.localeCompare(second.name);
        });
    }

    setFolderDisplay(path, checked) {

        const folder = this.nodeMetadata.get(path)?.model;

        if (!folder) {
            return;
        }

        const fileEntries = this.metadataBuilder.collectDescendantFiles(
            folder,
            path
        );

        fileEntries.forEach(entry => {
            this.setDisplayChecked(entry.path, checked);
        });

        this.refreshFolderAncestors(path);

        this.eventBus.emit("folder:display-toggled", {
            path,
            fileEntries,
            checked
        });
    }

    handleClick(event) {

        if (
            event.target.closest(".gpx-display-toggle") ||
            event.target.closest(".folder-display-toggle")
        ) {
            event.stopPropagation();
            return;
        }

        const row = event.target.closest(NODE_SELECTOR);

        if (!row || !this.element.querySelector(".tree-root").contains(row)) {
            return;
        }

        const path = row.dataset.treePath;

        this.focusPath(path, true);

        if (row.dataset.nodeKind === "folder") {
            if (path !== ROOT_PATH) {
                this.toggleFolder(path);
            }
            return;
        }

        this.selectFile(this.fileHandlesByPath.get(path));
    }

    handleChange(event) {

        const checkbox = event.target.closest(
            ".gpx-display-toggle, .folder-display-toggle"
        );

        if (!checkbox) {
            return;
        }

        const row = checkbox.closest(NODE_SELECTOR);

        if (!row) {
            return;
        }

        event.stopPropagation();

        const path = row.dataset.treePath;
        const checked = checkbox.checked;

        if (row.dataset.nodeKind === "folder") {
            this.setFolderDisplay(path, checked);

            return;
        }

        this.setDisplayChecked(path, checked);

        this.eventBus.emit("gpx:display-toggled", {
            path,
            fileHandle: this.fileHandlesByPath.get(path),
            checked
        });
    }

    handleKeyDown(event) {

        const row = event.target.closest(NODE_SELECTOR);

        if (!row) {
            return;
        }

        if (event.target.matches(
            ".gpx-display-toggle, .folder-display-toggle"
        )) {
            return;
        }

        const path = row.dataset.treePath;

        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            this.moveFocus(path, event.key === "ArrowDown" ? 1 : -1);
            return;
        }

        if (event.key === "Home" || event.key === "End") {

            event.preventDefault();

            const visiblePaths = this.getVisiblePaths();

            this.focusPath(
                event.key === "Home"
                    ? visiblePaths[0]
                    : visiblePaths[visiblePaths.length - 1],
                true
            );

            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            this.handleArrowRight(path, row.dataset.nodeKind);
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            this.handleArrowLeft(path, row.dataset.nodeKind);
            return;
        }

        if (event.key === "Enter" || event.key === " ") {

            event.preventDefault();

            if (row.dataset.nodeKind === "folder") {
                if (event.key === " ") {
                    const checkbox = row.querySelector(
                        ".folder-display-toggle"
                    );
                    const checked = checkbox?.indeterminate
                        ? true
                        : !checkbox?.checked;

                    this.setFolderDisplay(path, checked);
                    return;
                }

                if (path !== ROOT_PATH) {
                    this.toggleFolder(path);
                }
                return;
            }

            if (event.key === " ") {
                const checked = !this.isDisplayChecked(path);

                this.setDisplayChecked(path, checked);

                this.eventBus.emit("gpx:display-toggled", {
                    path,
                    fileHandle: this.fileHandlesByPath.get(path),
                    checked
                });

                return;
            }

            this.selectFile(this.fileHandlesByPath.get(path));
        }
    }

    handleFocusIn(event) {

        const row = event.target.closest(NODE_SELECTOR);

        if (row) {
            this.focusedPath = row.dataset.treePath;
        }
    }

    handleArrowRight(path, kind) {

        if (kind !== "folder") {
            return;
        }

        if (!this.expandedPaths.has(path)) {
            this.toggleFolder(path);
            return;
        }

        const firstChild = this.getVisiblePaths().find(
            candidate => this.parentPath(candidate) === path
        );

        if (firstChild) {
            this.focusPath(firstChild, true);
        }
    }

    handleArrowLeft(path, kind) {

        if (path === ROOT_PATH) {
            return;
        }

        if (kind === "folder" && this.expandedPaths.has(path)) {
            this.toggleFolder(path);
            return;
        }

        this.focusPath(this.parentPath(path), true);
    }

    moveFocus(path, direction) {

        const visiblePaths = this.getVisiblePaths();
        const currentIndex = visiblePaths.indexOf(path);
        const nextIndex = Math.max(
            0,
            Math.min(visiblePaths.length - 1, currentIndex + direction)
        );

        this.focusPath(visiblePaths[nextIndex], true);
    }

    getVisiblePaths() {

        return [...this.element.querySelectorAll(
            ".tree-root [role=treeitem]"
        )].map(row => row.dataset.treePath);
    }

    focusPath(path, moveFocus) {

        const row = this.findRenderedRow(path);

        if (!row) {
            return;
        }

        this.focusedPath = path;
        this.applyFocusState();

        if (moveFocus) {
            row.focus();
            row.scrollIntoView({ block: "nearest" });
        }
    }

    applyFocusState() {

        this.element.querySelectorAll(NODE_SELECTOR).forEach(row => {
            row.tabIndex = row.dataset.treePath === this.focusedPath ? 0 : -1;
        });
    }

    toggleFolder(path) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata || metadata.kind !== "folder") {
            return;
        }

        if (this.expandedPaths.has(path)) {
            this.collapseFolder(path);
        } else {
            this.expandFolder(path);
        }
    }

    expandFolder(path) {

        const row = this.folderNodes.get(path);
        const item = row?.parentElement;
        const folder = this.nodeMetadata.get(path)?.model;

        if (!row || !item || !folder) {
            return;
        }

        this.expandedPaths.add(path);
        this.appendFolderChildren(item, folder, path);
        this.updateFolderRow(row, true);
        this.refreshFolderRow(path);
        this.applyFocusState();
    }

    collapseFolder(path) {

        const row = this.folderNodes.get(path);
        const item = row?.parentElement;

        if (!row || !item) {
            return;
        }

        if (this.focusedPath !== path && this.isDescendant(this.focusedPath, path)) {
            this.focusedPath = path;
        }

        item.querySelector(":scope > .tree-group")?.remove();
        this.removeRenderedDescendants(path);
        this.expandedPaths.delete(path);
        this.updateFolderRow(row, false);
        this.refreshFolderRow(path);
        this.applyFocusState();

        if (this.focusedPath === path) {
            row.focus();
        }
    }

    removeRenderedDescendants(path) {

        for (const candidate of this.folderNodes.keys()) {
            if (this.isDescendant(candidate, path)) {
                this.folderNodes.delete(candidate);
            }
        }

        for (const candidate of this.fileNodes.keys()) {
            if (this.isDescendant(candidate, path)) {
                this.fileNodes.delete(candidate);
            }
        }
    }

    updateFolderRow(row, expanded) {

        row.setAttribute("aria-expanded", String(expanded));
        row.classList.toggle("is-expanded", expanded);
        row.classList.toggle("is-collapsed", !expanded);
    }

    selectFile(fileHandle, source = "tree") {

        const path = this.pathsByFileHandle.get(fileHandle);

        if (!path) {
            return;
        }

        this.eventBus.emit("gpx:selection-requested", {
            path,
            source,
            refocus: source !== "map"
        });
    }

    setDisplayLoading(path) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata || metadata.kind !== "file") {
            return;
        }

        metadata.state = "loading";
        this.refreshAllFileRows();
    }

    setDisplayLoaded(path, color) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata || metadata.kind !== "file") {
            return;
        }

        metadata.state = "loaded";
        metadata.error = null;
        metadata.color = color;
        this.refreshAllFileRows();
    }

    setDisplayError(path) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata || metadata.kind !== "file") {
            return;
        }

        metadata.state = "error";
        metadata.checked = false;
        this.refreshAllFileRows();
    }

    setDisplayChecked(path, checked) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata || metadata.kind !== "file") {
            return;
        }

        metadata.checked = checked;
        this.refreshFileRow(path);
        this.refreshFolderAncestors(metadata.parentPath);
    }

    setDisplayIdle(path) {

        const metadata = this.nodeMetadata.get(path);

        if (metadata?.kind === "file") {
            metadata.state = "idle";
            this.refreshFileRow(path);
        }
    }

    isDisplayChecked(path) {

        return Boolean(this.nodeMetadata.get(path)?.checked);
    }

    getFileEntries() {

        return this.metadataBuilder.getFileEntries(this.nodeMetadata);
    }

    /**
     * Returns metadata fields used by Release 0.9 Search.
     *
     * @returns {Array<{kind: string, path: string, name: string}>}
     */
    getSearchSourceEntries() {

        return this.metadataBuilder.getSearchSourceEntries(this.nodeMetadata);
    }

    /**
     * Returns current display presentation for a Search result.
     *
     * @param {string} path
     * @returns {{checked: boolean, state: string, color: string|null}}
     */
    getSearchResultState(path) {

        const metadata = this.nodeMetadata.get(path);

        return {
            checked: Boolean(metadata?.checked),
            state: metadata?.state || "idle",
            color: metadata?.color || null
        };
    }

    /**
     * Reveals and activates a Search result through existing Tree behavior.
     *
     * @param {string} path
     * @returns {boolean}
     */
    activateSearchResult(path) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata) {
            return false;
        }

        this.#expandAncestors(path);

        if (
            metadata.kind === "folder" &&
            !this.expandedPaths.has(path)
        ) {
            this.expandFolder(path);
        }

        this.focusPath(path, true);

        if (metadata.kind === "file") {
            this.selectFile(metadata.model, "search");
        }

        return true;
    }

    /**
     * Connects a Search checkbox to the existing GPX display flow.
     *
     * @param {string} path
     * @param {boolean} checked
     * @returns {boolean}
     */
    toggleSearchResultDisplay(path, checked) {

        const metadata = this.nodeMetadata.get(path);

        if (!metadata || metadata.kind !== "file") {
            return false;
        }

        this.setDisplayChecked(path, checked);
        this.eventBus.emit("gpx:display-toggled", {
            path,
            fileHandle: metadata.model,
            checked
        });

        return true;
    }

    #expandAncestors(path) {

        const ancestors = [];
        let currentPath = this.parentPath(path);

        while (currentPath) {
            ancestors.unshift(currentPath);
            currentPath = this.parentPath(currentPath);
        }

        ancestors.forEach(ancestorPath => {
            if (!this.expandedPaths.has(ancestorPath)) {
                this.expandFolder(ancestorPath);
            }
        });
    }

    clearSelection() {

        this.setSelectedPath(null);
    }

    setSelectedPath(path, options = {}) {

        if (path !== null && !this.hasFile(path)) {
            return false;
        }

        if (path && options.reveal) {
            this.#expandAncestors(path);
        }

        this.selectedFilePath = path;

        this.refreshAllFileRows();

        const row = path ? this.fileNodes.get(path) : null;

        if (row && options.moveFocus) {
            this.focusPath(path, true);
        } else if (row && options.scroll) {
            row.scrollIntoView({ block: "nearest" });
        }

        return true;
    }

    hasFile(path) {

        return this.nodeMetadata.get(path)?.kind === "file";
    }

    clearDisplayStates() {

        this.nodeMetadata.forEach(metadata => {
            if (metadata.kind === "file") {
                metadata.state = "idle";
                metadata.checked = false;
                metadata.color = null;
                metadata.error = null;
            }
        });

        this.refreshAllFileRows();
        this.refreshAllFolderRows();
    }

    clearTransientStates() {

        this.nodeMetadata.forEach(metadata => {
            if (
                metadata.kind === "file" &&
                (metadata.state === "loading" || metadata.state === "error")
            ) {
                metadata.state = "idle";
            }
        });
    }

    refreshAllFileRows() {
        this.fileNodes.forEach((row, path) => this.refreshFileRow(path));
    }

    refreshAllFolderRows() {
        this.folderNodes.forEach((row, path) => this.refreshFolderRow(path));
    }

    refreshFolderAncestors(path) {

        let currentPath = path;

        while (true) {
            this.refreshFolderRow(currentPath);

            if (!currentPath) {
                break;
            }

            currentPath = this.parentPath(currentPath);
        }
    }

    refreshFolderRow(path) {

        const row = this.folderNodes.get(path);

        if (!row) {
            return;
        }

        const files = [...this.nodeMetadata.values()].filter(metadata => {
            return metadata.kind === "file" &&
                (path === ROOT_PATH ||
                    metadata.path.startsWith(`${path}/`));
        });

        const checkedCount = files.filter(metadata => metadata.checked).length;
        const checkbox = row.querySelector(".folder-display-toggle");

        if (!checkbox) {
            return;
        }

        checkbox.disabled = files.length === 0;
        checkbox.checked = files.length > 0 && checkedCount === files.length;
        checkbox.indeterminate = checkedCount > 0 &&
            checkedCount < files.length;
    }

    refreshFileRow(path) {

        const row = this.fileNodes.get(path);
        const metadata = this.nodeMetadata.get(path);

        if (!row || !metadata) {
            return;
        }

        const isSelected = this.selectedFilePath === path;

        row.classList.toggle("is-selected", isSelected);
        row.classList.toggle("is-displayed", metadata.checked);
        row.classList.toggle("is-loading", metadata.state === "loading");
        row.classList.toggle("is-loaded", metadata.state === "loaded");
        row.classList.toggle("is-error", metadata.state === "error");
        row.setAttribute("aria-selected", String(isSelected));

        const checkbox = row.querySelector(".gpx-display-toggle");
        const colorIndicator = row.querySelector(".tree-color-indicator");

        if (checkbox) {
            checkbox.checked = Boolean(metadata.checked);
        }

        if (colorIndicator) {
            colorIndicator.style.backgroundColor = metadata.color || "";
        }

        this.refreshFolderAncestors(metadata.parentPath);
    }

    findRenderedRow(path) {

        return this.folderNodes.get(path) || this.fileNodes.get(path) || null;
    }

    parentPath(path) {

        return this.metadataBuilder.parentPath(path);
    }

    joinPath(parentPath, name) {

        return this.metadataBuilder.joinPath(parentPath, name);
    }

    isDescendant(path, parentPath) {

        return this.metadataBuilder.isDescendant(path, parentPath);
    }
}
