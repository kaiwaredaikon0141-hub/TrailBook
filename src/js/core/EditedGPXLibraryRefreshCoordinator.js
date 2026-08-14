/**
 * Invalidates and refreshes one verified in-place GPX without rescanning.
 */
export default class EditedGPXLibraryRefreshCoordinator {

    constructor({
        treeView,
        displayState,
        selectionState,
        discoveryCoordinator,
        getLibrary,
        getColor,
        reloadVisiblePath = async () => true,
        onLibraryUpdated = () => {}
    }) {

        this.treeView = treeView;
        this.displayState = displayState;
        this.selectionState = selectionState;
        this.discoveryCoordinator = discoveryCoordinator;
        this.getLibrary = getLibrary;
        this.getColor = getColor;
        this.reloadVisiblePath = reloadVisiblePath;
        this.onLibraryUpdated = onLibraryUpdated;
    }

    async refreshVerifiedFile({ sourcePath, fileHandle }) {

        const library = this.getLibrary();
        const metadata = this.treeView.nodeMetadata.get(sourcePath);
        const display = this.displayState.getDisplay(sourcePath);

        if (
            !library || !fileHandle || metadata?.kind !== "file" ||
            !this.treeView.hasFile(sourcePath)
        ) {
            return false;
        }

        const wasChecked = Boolean(display?.checked);
        const wasSelected = this.selectionState.isSelected(sourcePath);

        this.displayState.invalidateCachedResult(sourcePath);
        this.displayState.registerFile(
            sourcePath,
            fileHandle,
            this.getColor(sourcePath)
        );
        this.displayState.setIdle(sourcePath);

        const discoveryRefreshed = await this.discoveryCoordinator
            .refreshFileEntry({ path: sourcePath, fileHandle });

        if (!discoveryRefreshed) {
            throw new Error("The edited GPX could not refresh Discovery data");
        }

        const displayRefreshed = await this.reloadVisiblePath({
            path: sourcePath,
            fileHandle,
            wasChecked,
            wasSelected
        });

        if (!displayRefreshed) {
            throw new Error("The edited GPX could not refresh Viewer data");
        }

        this.#restoreTreePresentation();
        this.onLibraryUpdated(library);

        return Object.freeze({
            path: sourcePath,
            fileHandle,
            checked: wasChecked,
            selected: wasSelected
        });
    }

    #restoreTreePresentation() {

        this.displayState.getDisplays().forEach(display => {
            const metadata = this.treeView.nodeMetadata.get(display.path);

            if (!metadata || metadata.kind !== "file") return;

            metadata.checked = display.checked;
            metadata.state = display.state;
            metadata.error = display.error;
            metadata.color = display.color;
        });
        this.treeView.refreshAllFileRows();
        this.treeView.refreshAllFolderRows();
        this.treeView.setSelectedPath(
            this.selectionState.getSelectedPath(),
            { reveal: false, scroll: false, moveFocus: false }
        );
    }
}
