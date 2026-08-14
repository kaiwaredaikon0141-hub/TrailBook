import App from "./core/App.js";
import EditedGPXLibraryRefreshCoordinator from "./core/EditedGPXLibraryRefreshCoordinator.js";
import TrackEditingCoordinator from "./core/TrackEditingCoordinator.js";
import { folderPathFromFilePath } from "./utils/PathUtils.js";

window.addEventListener("DOMContentLoaded", () => {

    const app = new App();

    app.initialize();

    const editedFileRefresh = new EditedGPXLibraryRefreshCoordinator({
        treeView: app.treeView,
        displayState: app.displayState,
        selectionState: app.selectionState,
        discoveryCoordinator: app.trackDiscoveryCoordinator,
        getLibrary: () => app.currentLibrary,
        getColor: path => app.getColor(path),
        reloadVisiblePath: async ({ path, fileHandle, wasChecked }) => {
            if (!wasChecked) {
                app.treeView.setDisplayIdle(path);
                return true;
            }

            app.stopDisplay(path, {
                refocus: false,
                preserveSelection: true
            });
            app.displayState.invalidateCachedResult(path);
            app.displayState.setIdle(path);
            app.handleDisplayToggled({
                path,
                fileHandle,
                checked: true,
                preserveMapView: true,
                preserveSelection: true
            });
            return true;
        },
        onLibraryUpdated: library => {
            app.statusBar.showLibraryLoaded(library);
            app.libraryAccessPanel.hide();
        }
    });

    const editor = new TrackEditingCoordinator({
        eventBus: app.eventBus,
        selectionState: app.selectionState,
        mapView: app.mapView,
        getLibraryToken: () => app.currentLibrary,
        refreshEditedFile: saved => editedFileRefresh.refreshVerifiedFile(saved),
        setSaveBusy: busy => app.toolbar.setFolderPickerBusy(busy),
        interactionRoot: app.workspace.querySelector(".sidebar-shell"),
        getFileEntry: path => {
            const entry = app.treeView.getFileEntries()
                .find(candidate => candidate.path === path);

            if (!entry) return null;

            const parentPath = folderPathFromFilePath(path);
            const parentFolderHandle = app.treeView.nodeMetadata
                .get(parentPath)?.model?.handle || null;

            return { ...entry, parentPath, parentFolderHandle };
        }
    });

    editor.attach(app.mapView.element);

});
