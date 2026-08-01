const ROOT_PATH = "";

const NODE_SELECTOR = "[data-tree-path]";

/**
 * Displays a lazy, keyboard-navigable folder tree.
 */
export default class TreeView {

    constructor(eventBus) {

        this.eventBus = eventBus;
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

            const prepared = this.prepareLibrary(library);
            const sameLibrary = await this.isSameLibrary(prepared.rootHandle);

            if (requestId !== this.renderRequestId) {
                return;
            }

            const expandedPaths = sameLibrary
                ? this.filterExpandedPaths(
                    previousState.expandedPaths,
                    prepared.nodeMetadata
                )
                : new Set([ROOT_PATH]);

            expandedPaths.add(ROOT_PATH);

            const focusedPath = sameLibrary
                ? this.findRestorableFocus(
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

    prepareLibrary(library) {

        const nodeMetadata = new Map();
        const fileHandlesByPath = new Map();
        const pathsByFileHandle = new Map();

        const visitFolder = (folder, path) => {

            nodeMetadata.set(path, {
                kind: "folder",
                path,
                parentPath: this.parentPath(path),
                name: folder.name,
                model: folder
            });

            folder.folders.forEach(childFolder => {
                visitFolder(childFolder, this.joinPath(path, childFolder.name));
            });

            folder.gpxFiles.forEach(fileHandle => {

                const filePath = this.joinPath(path, fileHandle.name);

                nodeMetadata.set(filePath, {
                    kind: "file",
                    path: filePath,
                    parentPath: path,
                    name: fileHandle.name,
                    model: fileHandle,
                    state: "idle"
                });

                fileHandlesByPath.set(filePath, fileHandle);
                pathsByFileHandle.set(fileHandle, filePath);
            });
        };

        visitFolder(library.rootFolder, ROOT_PATH);

        return {
            library,
            rootHandle: library.rootFolder.handle,
            nodeMetadata,
            fileHandlesByPath,
            pathsByFileHandle
        };
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

    filterExpandedPaths(paths, nodeMetadata) {

        return new Set(
            [...paths].filter(path => nodeMetadata.get(path)?.kind === "folder")
        );
    }

    findRestorableFocus(path, expandedPaths, nodeMetadata) {

        let candidate = path;

        while (candidate && !nodeMetadata.has(candidate)) {
            candidate = this.parentPath(candidate);
        }

        while (candidate && !expandedPaths.has(candidate)) {
            candidate = this.parentPath(candidate);
        }

        return candidate || ROOT_PATH;
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
            <span class="tree-icon" aria-hidden="true"></span>
            <span class="tree-label"></span>
        `;
        row.querySelector(".tree-label").textContent = folder.name;
        item.append(row);
        this.folderNodes.set(path, row);

        if (isRoot || this.expandedPaths.has(path)) {
            this.appendFolderChildren(item, folder, path);
        }

        this.updateFolderRow(row, isRoot || this.expandedPaths.has(path));

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
            <span class="tree-icon" aria-hidden="true">●</span>
            <span class="tree-label"></span>
        `;
        row.querySelector(".tree-label").textContent = fileHandle.name;
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

    handleClick(event) {

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

        this.activateFile(this.fileHandlesByPath.get(path));
    }

    handleKeyDown(event) {

        const row = event.target.closest(NODE_SELECTOR);

        if (!row) {
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
                if (path !== ROOT_PATH) {
                    this.toggleFolder(path);
                }
                return;
            }

            this.activateFile(this.fileHandlesByPath.get(path));
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

    activateFile(fileHandle) {

        const path = this.pathsByFileHandle.get(fileHandle);

        if (!path) {
            return;
        }

        const metadata = this.nodeMetadata.get(path);

        if (metadata?.state === "loading") {
            return;
        }

        this.selectedFilePath = path;
        this.refreshAllFileRows();
        this.eventBus.emit("gpx:parse-requested", { fileHandle });
    }

    setLoading(fileHandle) {

        const path = this.pathsByFileHandle.get(fileHandle);

        if (!path) {
            return;
        }

        this.clearTransientStates();
        this.selectedFilePath = path;
        this.nodeMetadata.get(path).state = "loading";
        this.refreshAllFileRows();
    }

    setLoaded(fileHandle) {

        const path = this.pathsByFileHandle.get(fileHandle);

        if (!path) {
            return;
        }

        this.clearTransientStates();
        this.nodeMetadata.get(path).state = "loaded";
        this.refreshAllFileRows();
    }

    setError(fileHandle) {

        const path = this.pathsByFileHandle.get(fileHandle);

        if (!path) {
            return;
        }

        this.clearTransientStates();
        this.selectedFilePath = path;
        this.nodeMetadata.get(path).state = "error";
        this.refreshAllFileRows();
    }

    clearSelection() {

        this.selectedFilePath = null;

        this.nodeMetadata.forEach(metadata => {
            if (metadata.kind === "file") {
                metadata.state = "idle";
            }
        });

        this.refreshAllFileRows();
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

    refreshFileRow(path) {

        const row = this.fileNodes.get(path);
        const metadata = this.nodeMetadata.get(path);

        if (!row || !metadata) {
            return;
        }

        const isSelected = this.selectedFilePath === path;

        row.classList.toggle("is-selected", isSelected);
        row.classList.toggle("is-loading", metadata.state === "loading");
        row.classList.toggle("is-error", metadata.state === "error");
        row.setAttribute("aria-selected", String(isSelected));
    }

    findRenderedRow(path) {

        return this.folderNodes.get(path) || this.fileNodes.get(path) || null;
    }

    parentPath(path) {

        if (!path) {
            return ROOT_PATH;
        }

        const separator = path.lastIndexOf("/");

        return separator < 0 ? ROOT_PATH : path.slice(0, separator);
    }

    joinPath(parentPath, name) {

        return parentPath ? `${parentPath}/${name}` : name;
    }

    isDescendant(path, parentPath) {

        return path.startsWith(`${parentPath}/`);
    }
}
