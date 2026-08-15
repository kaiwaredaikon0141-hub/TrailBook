import App from "./core/App.js";
import CurrentPositionController from "./core/CurrentPositionController.js";
import DrivingModeController from "./core/DrivingModeController.js";
import DriveLibraryCoordinator from "./core/DriveLibraryCoordinator.js";
import BatchSimplificationCoordinator, {
    collectBatchEntries
} from "./core/BatchSimplificationCoordinator.js";
import EditedGPXLibraryRefreshCoordinator from "./core/EditedGPXLibraryRefreshCoordinator.js";
import TrackEditingCoordinator from "./core/TrackEditingCoordinator.js";
import { folderPathFromFilePath } from "./utils/PathUtils.js";

window.addEventListener("DOMContentLoaded", () => {

    const app = new App();

    app.initialize();

    const currentPosition = new CurrentPositionController({
        mapView: app.mapView,
        eventBus: app.eventBus
    });
    currentPosition.attach(app.mapView.element);
    const drivingMode = new DrivingModeController({
        currentPosition, eventBus: app.eventBus,
        viewStateControls: app.viewStateControls, workspace: app.workspace,
        trackInfoElement: app.trackDiscoveryCoordinator.trackInfo.element
    });
    drivingMode.attach(app.mapView.element);

    const editedFileRefresh = new EditedGPXLibraryRefreshCoordinator({
        treeView: app.treeView,
        displayState: app.displayState,
        selectionState: app.selectionState,
        discoveryCoordinator: app.trackDiscoveryCoordinator,
        eventBus: app.eventBus,
        getLibrary: () => app.currentLibrary,
        getColor: path => app.getColor(path),
        invalidateGeometry: path => app.gpxGeometryLoader.repository.invalidate(
            app.gpxGeometryLoader.namespace,
            path
        ),
        reloadVisiblePath: async ({
            sourcePath,
            path,
            fileHandle,
            wasChecked,
            previousRequestId,
            renamed
        }) => {
            if (renamed) {
                app.displayQueue.invalidate(sourcePath, previousRequestId);
                app.mapView.removeGPX(sourcePath);
            }

            if (!wasChecked) {
                app.treeView.setDisplayIdle(path);
                return true;
            }

            if (!renamed) {
                app.stopDisplay(path, {
                    refocus: false,
                    preserveSelection: true
                });
            }
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

    let batchSimplification = null;
    let driveLibrary = null;
    const editor = new TrackEditingCoordinator({
        eventBus: app.eventBus,
        selectionState: app.selectionState,
        mapView: app.mapView,
        getLibraryToken: () => app.currentLibrary,
        refreshEditedFile: saved => editedFileRefresh.refreshVerifiedFile(saved),
        setSaveBusy: busy => app.toolbar.setFolderPickerBusy(busy),
        isExternalBusy: () => Boolean(batchSimplification?.isBusy()) ||
            Boolean(driveLibrary?.isReadOnlyActive()),
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

    batchSimplification = new BatchSimplificationCoordinator({
        getEntries: scope => collectBatchEntries(app.treeView, scope),
        getRootDirectoryHandle: () => app.currentLibrary?.rootFolder?.handle,
        getLibraryToken: () => app.currentLibrary,
        isLibraryAvailable: () => Boolean(app.currentLibrary) &&
            !driveLibrary?.isReadOnlyActive(),
        isEditorBusy: () => editor.isBusy(),
        refreshSavedFile: saved => editedFileRefresh.refreshVerifiedFile(saved),
        setBusy: busy => app.toolbar.setFolderPickerBusy(busy)
    });
    batchSimplification.attach(
        app.trackDiscoveryCoordinator.sidebarShell
            ?.querySelector(".sidebar-fixed-controls") ||
        app.trackDiscoveryCoordinator.sidebarShell
    );

    driveLibrary = new DriveLibraryCoordinator({
        config: app.config.googleDrive,
        canSwitchLibrary: () =>
            !editor.isBusy() &&
            !batchSimplification.isBusy() &&
            app.librarySettingsCoordinator.canSwitchLibrary(),
        flushViewState: () => app.viewStateCoordinator.flush(),
        beforeLoad: () => {
            app.clearSelection("library-switch");
            app.trackDiscoveryCoordinator.clearLibrary();
        },
        applyLibrary: (library, context) =>
            app.handleLibraryLoaded(library, context),
        getCurrentLibrary: () => app.currentLibrary,
        setReadOnlyPresentation: readOnly => {
            if (readOnly) app.librarySettingsPanel.setAvailable(false);
        }
    });
    driveLibrary.attach(
        app.trackDiscoveryCoordinator.sidebarShell
            ?.querySelector(".sidebar-fixed-controls") ||
        app.trackDiscoveryCoordinator.sidebarShell
    );

});
