/** Projects TreeView metadata onto rendered rows without owning Tree state. */
export default class TreeRowPresenter {

    constructor(treeView) {
        this.treeView = treeView;
    }

    updateFolderRow(row, expanded) {
        row.setAttribute("aria-expanded", String(expanded));
        row.classList.toggle("is-expanded", expanded);
        row.classList.toggle("is-collapsed", !expanded);
    }

    refreshFolderRow(path) {
        const treeView = this.treeView;
        const row = treeView.folderNodes.get(path);

        if (!row) {
            return;
        }

        const folder = treeView.nodeMetadata.get(path)?.model;
        const files = folder
            ? treeView.metadataBuilder.collectDescendantFiles(folder, path)
            : [];
        const checkedCount = files.reduce((count, entry) =>
            count + Boolean(treeView.nodeMetadata.get(entry.path)?.checked), 0
        );
        const checkbox = row.querySelector(".folder-display-toggle");

        if (!checkbox) {
            return;
        }

        checkbox.disabled = files.length === 0;
        checkbox.checked = files.length > 0 && checkedCount === files.length;
        checkbox.indeterminate = checkedCount > 0 &&
            checkedCount < files.length;
    }

    refreshFileRow(path, refreshAncestors = true) {
        const treeView = this.treeView;
        const row = treeView.fileNodes.get(path);
        const metadata = treeView.nodeMetadata.get(path);

        if (!row || !metadata) {
            return;
        }

        const isSelected = treeView.selectedFilePath === path;

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

        if (refreshAncestors) treeView.refreshFolderAncestors(metadata.parentPath);
    }
}
