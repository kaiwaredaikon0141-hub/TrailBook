/**
 * Invalidates and refreshes one verified edited GPX without rescanning.
 */
export default class EditedGPXLibraryRefreshCoordinator {

    constructor({
        treeView,
        displayState,
        selectionState,
        discoveryCoordinator,
        eventBus = null,
        getLibrary,
        getColor,
        invalidateGeometry = async () => false,
        reloadVisiblePath = async () => true,
        rebindTrackSource = () => true,
        onLibraryUpdated = () => {}
    }) {

        this.treeView = treeView;
        this.displayState = displayState;
        this.selectionState = selectionState;
        this.discoveryCoordinator = discoveryCoordinator;
        this.eventBus = eventBus;
        this.getLibrary = getLibrary;
        this.getColor = getColor;
        this.invalidateGeometry = invalidateGeometry;
        this.reloadVisiblePath = reloadVisiblePath;
        this.rebindTrackSource = rebindTrackSource;
        this.onLibraryUpdated = onLibraryUpdated;
    }

    async refreshVerifiedFile({ sourcePath, targetPath = sourcePath, fileHandle }) {

        const library = this.getLibrary();
        const metadata = this.treeView.nodeMetadata.get(sourcePath);
        const display = this.displayState.getDisplay(sourcePath);

        if (
            !library || !fileHandle || metadata?.kind !== "file" ||
            !this.treeView.hasFile(sourcePath)
        ) return false;

        const wasChecked = Boolean(display?.checked);
        const wasSelected = this.selectionState.isSelected(sourcePath);
        const previousRequestId = display?.requestId || 0;
        const renamed = targetPath !== sourcePath;

        await this.invalidateGeometry(sourcePath);

        if (renamed) {
            if (!this.#replaceLibraryFile(metadata, fileHandle)) return false;
            if (!this.displayState.replaceFilePath(
                sourcePath,
                targetPath,
                fileHandle,
                this.getColor(targetPath)
            )) return false;
            this.rebindTrackSource({ sourcePath, targetPath, fileHandle });

            const discoveryRefreshed = await this.discoveryCoordinator
                .renameFileEntry({ sourcePath, targetPath, fileHandle });

            if (!discoveryRefreshed) {
                throw new Error("The renamed GPX could not refresh Discovery data");
            }

            await this.treeView.render(library);
        } else {
            this.displayState.invalidateCachedResult(sourcePath);
            this.displayState.registerFile(
                sourcePath,
                fileHandle,
                this.getColor(sourcePath)
            );
            this.displayState.setIdle(sourcePath);
            this.rebindTrackSource({ sourcePath, targetPath, fileHandle });

            const discoveryRefreshed = await this.discoveryCoordinator
                .refreshFileEntry({ path: sourcePath, fileHandle });

            if (!discoveryRefreshed) {
                throw new Error("The edited GPX could not refresh Discovery data");
            }
        }

        if (wasSelected && renamed) {
            const change = this.selectionState.select(targetPath, "system");

            if (change) {
                this.eventBus?.emit("selection:changed", {
                    path: targetPath,
                    previousPath: sourcePath,
                    source: "system",
                    reason: "edited-file-renamed",
                    refocus: false
                });
            }
        }

        const displayRefreshed = await this.reloadVisiblePath({
            sourcePath,
            path: targetPath,
            fileHandle,
            wasChecked,
            wasSelected,
            previousRequestId,
            renamed
        });

        if (!displayRefreshed) {
            throw new Error("The edited GPX could not refresh Viewer data");
        }

        this.#restoreTreePresentation();
        this.onLibraryUpdated(library);

        return Object.freeze({
            path: targetPath,
            previousPath: sourcePath,
            fileHandle,
            checked: wasChecked,
            selected: wasSelected,
            renamed
        });
    }

    #replaceLibraryFile(metadata, fileHandle) {

        const folder = this.treeView.nodeMetadata.get(metadata.parentPath)?.model;
        const index = folder?.gpxFiles?.findIndex(
            candidate => candidate === metadata.model || candidate.name === metadata.name
        );

        if (index < 0) return false;

        folder.gpxFiles[index] = fileHandle;
        return true;
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
