import { parentPath } from "../utils/PathUtils.js";

/**
 * Projects matching Discovery paths onto TreeView's lazy DOM without owning
 * visibility, selection, expansion, or Tree metadata state.
 */
export default class FolderTreeFilterProjection {

    constructor(root) {

        this.root = root;
        this.matchingPaths = null;
        this.visibleFolders = new Set();
        this.observer = typeof MutationObserver === "function"
            ? new MutationObserver(() => this.#apply())
            : null;
        this.observer?.observe(root, { childList: true, subtree: true });
    }

    setMatchingPaths(paths) {

        this.matchingPaths = paths === null ? null : new Set(paths);
        this.visibleFolders.clear();

        this.matchingPaths?.forEach(path => {
            let folder = parentPath(path);

            while (true) {
                this.visibleFolders.add(folder);
                if (folder === "") break;
                folder = parentPath(folder);
            }
        });

        this.#apply();
    }

    clear() {

        this.setMatchingPaths(null);
    }

    destroy() {

        this.observer?.disconnect();
        this.clear();
    }

    #apply() {

        this.root.querySelectorAll("[data-tree-path]").forEach(row => {
            const visible = this.matchingPaths === null ||
                (row.dataset.nodeKind === "file"
                    ? this.matchingPaths.has(row.dataset.treePath)
                    : this.visibleFolders.has(row.dataset.treePath));

            row.parentElement.hidden = !visible;
        });
    }
}
