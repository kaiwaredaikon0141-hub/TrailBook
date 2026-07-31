export default class TreeView {

    /**
     * Creates an empty library tree view.
     */
    constructor(eventBus) {

        this.eventBus = eventBus;

        this.fileNodes = new Map();

        this.fileStates = new Map();

        this.selectedElement = null;

        this.element = this.create();

    }

    /**
     * Creates the tree view container.
     *
     * @returns {HTMLElement}
     */
    create() {

        const aside = document.createElement("aside");

        aside.className = "sidebar";

        aside.innerHTML = `
            <h3>Library</h3>
            <ul class="tree-root"></ul>
        `;

        return aside;

    }

    /**
     * Renders a library without changing its model order.
     *
     * @param {import("../models/Library.js").default} library
     * @returns {void}
     */
    render(library) {

        const rootList = this.element.querySelector(".tree-root");

        this.fileNodes.clear();

        this.fileStates.clear();

        this.selectedElement = null;

        rootList.replaceChildren(this.createFolderItem(library.rootFolder));
    }

    /**
     * Creates a tree item for a folder and its children.
     *
     * @param {import("../models/Folder.js").default} folder
     * @returns {HTMLLIElement}
     */
    createFolderItem(folder) {

        const item = document.createElement("li");

        item.textContent = folder.name;

        const children = document.createElement("ul");

        const folders = [...folder.folders].sort(
            (first, second) => first.name.localeCompare(second.name)
        );

        folders.forEach(childFolder => {

            children.append(this.createFolderItem(childFolder));
        });

        const gpxFiles = [...folder.gpxFiles].sort(
            (first, second) => first.name.localeCompare(second.name)
        );

        gpxFiles.forEach(fileHandle => {

            const fileItem = document.createElement("li");

            fileItem.className = "gpx-file";

            fileItem.setAttribute("role", "treeitem");

            fileItem.setAttribute("aria-selected", "false");

            fileItem.tabIndex = 0;

            fileItem.textContent = fileHandle.name;

            this.fileNodes.set(fileHandle, fileItem);

            this.fileStates.set(fileHandle, "idle");

            fileItem.addEventListener(
                "click",
                () => this.activateFile(fileHandle)
            );

            fileItem.addEventListener(
                "keydown",
                event => {

                    if (event.key !== "Enter" && event.key !== " ") {
                        return;
                    }

                    event.preventDefault();

                    this.activateFile(fileHandle);
                }
            );

            children.append(fileItem);
        });

        if (children.childElementCount > 0) {

            item.append(children);
        }

        return item;
    }

    /**
     * Activates a GPX file without serializing its handle into the DOM.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @returns {void}
     */
    activateFile(fileHandle) {

        const state = this.fileStates.get(fileHandle);

        if (state === "loading") {
            return;
        }

        this.selectFile(fileHandle);

        this.eventBus.emit("gpx:parse-requested", { fileHandle });
    }

    /**
     * Marks a file as loading and selected.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @returns {void}
     */
    setLoading(fileHandle) {

        this.clearTransientStates();

        this.selectFile(fileHandle);

        this.fileStates.set(fileHandle, "loading");

        this.fileNodes.get(fileHandle)?.classList.add("is-loading");
    }

    /**
     * Marks a file as successfully loaded.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @returns {void}
     */
    setLoaded(fileHandle) {

        this.clearTransientStates();

        this.fileStates.set(fileHandle, "loaded");
    }

    /**
     * Marks a file as failed while keeping it selected.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @returns {void}
     */
    setError(fileHandle) {

        this.clearTransientStates();

        this.selectFile(fileHandle);

        this.fileStates.set(fileHandle, "error");

        this.fileNodes.get(fileHandle)?.classList.add("is-error");
    }

    /**
     * Clears selection and transient file states.
     *
     * @returns {void}
     */
    clearSelection() {

        this.fileStates.forEach((state, fileHandle) => {

            this.fileStates.set(fileHandle, "idle");
        });

        this.fileNodes.forEach(fileNode => {

            fileNode.classList.remove("is-loading", "is-error");

            fileNode.setAttribute("aria-selected", "false");

            fileNode.classList.remove("is-selected");
        });

        this.selectedElement = null;
    }

    selectFile(fileHandle) {

        this.fileNodes.forEach(fileNode => {

            const isSelected = fileNode === this.fileNodes.get(fileHandle);

            fileNode.classList.toggle("is-selected", isSelected);

            fileNode.setAttribute("aria-selected", String(isSelected));
        });

        this.selectedElement = this.fileNodes.get(fileHandle) || null;
    }

    clearTransientStates() {

        this.fileNodes.forEach((fileNode, fileHandle) => {

            fileNode.classList.remove("is-loading", "is-error");

            const state = this.fileStates.get(fileHandle);

            if (state === "loading" || state === "error") {

                this.fileStates.set(fileHandle, "idle");
            }
        });
    }

}