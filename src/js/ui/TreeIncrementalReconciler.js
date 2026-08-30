const ROOT_PATH = "";

/** Reconciles Tree metadata and rebuilds only affected rendered folders. */
export default class TreeIncrementalReconciler {

    async reconcile(treeView, library, { affectedPaths = [] } = {}) {

        treeView.renderRequestId += 1;
        const prepared = treeView.metadataBuilder.build(library);
        const previousMetadata = treeView.nodeMetadata;
        const previousScrollTop = treeView.element.scrollTop;

        prepared.nodeMetadata.forEach((metadata, path) => {
            const previous = previousMetadata.get(path);

            if (metadata.kind === "file" && previous?.kind === "file") {
                Object.assign(metadata, {
                    checked: previous.checked,
                    state: previous.state,
                    color: previous.color,
                    error: previous.error
                });
            }
        });
        Object.assign(treeView, {
            currentLibrary: library,
            currentRootHandle: prepared.rootHandle,
            nodeMetadata: prepared.nodeMetadata,
            fileHandlesByPath: prepared.fileHandlesByPath,
            pathsByFileHandle: prepared.pathsByFileHandle
        });
        treeView.expandedPaths = treeView.metadataBuilder.filterExpandedPaths(
            treeView.expandedPaths,
            prepared.nodeMetadata
        );
        treeView.expandedPaths.add(ROOT_PATH);
        if (!treeView.nodeMetadata.has(treeView.selectedFilePath)) {
            treeView.selectedFilePath = null;
        }
        const rebuildPaths = new Set();

        affectedPaths.forEach(path => {
            let folderPath = treeView.parentPath(path);

            while (folderPath && (
                !this.#hasLiveFolderRow(treeView, folderPath) ||
                treeView.nodeMetadata.get(folderPath)?.kind !== "folder"
            )) {
                folderPath = treeView.parentPath(folderPath);
            }
            rebuildPaths.add(folderPath);
        });
        const minimalPaths = [...rebuildPaths].filter(path =>
            ![...rebuildPaths].some(candidate =>
                candidate !== path && (
                    candidate === ROOT_PATH ||
                    treeView.isDescendant(path, candidate)
                )
            )
        );

        minimalPaths.forEach(path => this.#rebuildFolder(treeView, path));
        treeView.applyFocusState();
        treeView.element.scrollTop = previousScrollTop;
        treeView.scrollTop = previousScrollTop;

        return Object.freeze({
            affectedPaths: [...affectedPaths],
            metadataPaths: affectedPaths.filter(path => treeView.hasFile(path)),
            renderedPaths: affectedPaths.filter(path =>
                this.#hasLiveFileRow(treeView, path)
            )
        });
    }

    #rebuildFolder(treeView, path) {

        const row = treeView.folderNodes.get(path);
        const item = row?.parentElement;
        const folder = treeView.nodeMetadata.get(path)?.model;

        if (!row || !item || !folder) return;
        item.querySelector(":scope > .tree-group")?.remove();
        this.#removeRenderedDescendants(treeView, path);
        if (path === ROOT_PATH || treeView.expandedPaths.has(path)) {
            treeView.appendFolderChildren(item, folder, path);
        }
        treeView.updateFolderRow(
            row,
            path === ROOT_PATH || treeView.expandedPaths.has(path)
        );
        treeView.refreshFolderRow(path);
    }

    #removeRenderedDescendants(treeView, path) {

        if (path !== ROOT_PATH) {
            treeView.removeRenderedDescendants(path);
            return;
        }
        [...treeView.folderNodes.keys()].forEach(candidate => {
            if (candidate !== ROOT_PATH) treeView.folderNodes.delete(candidate);
        });
        treeView.fileNodes.clear();
    }

    #hasLiveFolderRow(treeView, path) {

        const row = treeView.folderNodes.get(path);

        return Boolean(row && treeView.element.contains(row));
    }

    #hasLiveFileRow(treeView, path) {

        const row = treeView.fileNodes.get(path);

        return Boolean(row && treeView.element.contains(row));
    }
}
