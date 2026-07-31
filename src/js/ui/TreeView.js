export default class TreeView {

    /**
     * Creates an empty library tree view.
     */
    constructor() {

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

            fileItem.textContent = fileHandle.name;

            children.append(fileItem);
        });

        if (children.childElementCount > 0) {

            item.append(children);
        }

        return item;
    }

}