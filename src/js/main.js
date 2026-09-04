import App from "./core/App.js";
import CurrentPositionController from "./core/CurrentPositionController.js";
import DrivingModeController from "./core/DrivingModeController.js";
import DriveLibraryCoordinator from "./core/DriveLibraryCoordinator.js";
import BatchSimplificationCoordinator, {
    collectBatchEntries
} from "./core/BatchSimplificationCoordinator.js";
import EditedGPXLibraryRefreshCoordinator from "./core/EditedGPXLibraryRefreshCoordinator.js";
import LibraryRefreshCoordinator from "./core/LibraryRefreshCoordinator.js";
import TrackEditingCoordinator from "./core/TrackEditingCoordinator.js";
import TrackSourceResolver from "./core/TrackSourceResolver.js";
import SelectedTrackFileResolver from "./services/SelectedTrackFileResolver.js";
import { registerTrailBookServiceWorker } from "./services/PWAServiceWorker.js";
import { folderPathFromFilePath } from "./utils/PathUtils.js";
import {
    createBuildInfoElement,
    resolveBuildInfoElements
} from "./ui/BuildInfoView.js";

window.addEventListener("DOMContentLoaded", () => {

    const app = new App();

    app.initialize();
    const trackSourceResolver = new TrackSourceResolver({
        catalog: app.libraryTrackCatalogCoordinator.catalog,
        getLibraryIdentity: () => app.gpxGeometryLoader.namespace
    });
    app.gpxGeometryLoader.setSourceResolver(trackSourceResolver);
    app.trackDiscoveryCoordinator.setSourceResolver(trackSourceResolver);
    app.trackDiscoveryCoordinator.sidebarShell
        ?.querySelector(".sidebar-fixed-controls")
        ?.append(app.mapView.sidebarDisplayControls);
    const buildInfo = createBuildInfoElement();
    app.trackDiscoveryCoordinator.sidebarShell?.append(buildInfo);
    const localDevelopment = location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" || location.hostname === "[::1]";
    const developmentBuildInfo = localDevelopment
        ? document.getElementById("trailbook-development-build-info") ||
            createBuildInfoElement({ compact: true })
        : null;

    if (developmentBuildInfo && !developmentBuildInfo.isConnected) {
        developmentBuildInfo.id = "trailbook-development-build-info";
        developmentBuildInfo.classList.add("trailbook-development-build-info");
        document.body.append(developmentBuildInfo);
    }

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
        accessPanel: app.libraryAccessPanel,
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
        },
        rebindTrackSource: source => app.libraryTrackCatalogCoordinator
            .replaceActualPath(app.gpxGeometryLoader.namespace, source)
    });
    const libraryRefresh = new LibraryRefreshCoordinator({
        eventBus: app.eventBus,
        scanner: app.folderScanner,
        previousLibraryCoordinator: app.previousLibraryCoordinator,
        librarySnapshotService: app.librarySnapshotService,
        trackCatalogCoordinator: app.libraryTrackCatalogCoordinator,
        accessPanel: app.libraryAccessPanel,
        treeView: app.treeView,
        discoveryCoordinator: app.trackDiscoveryCoordinator,
        displayState: app.displayState,
        selectionState: app.selectionState,
        repository: app.gpxGeometryLoader.repository,
        getNamespace: () => app.gpxGeometryLoader.namespace,
        canRefresh: () => app.displaySnapshotCoordinator.getStatus()
            .restoreState === "ready" || app.librarySnapshotService.isProvisional(),
        getLibrary: () => app.currentLibrary,
        setLibrary: library => { app.currentLibrary = library; },
        getColor: path => app.getColor(path),
        getFolderColor: folderPath =>
            app.folderColorControl.getLegacyTrackProjectionColor(folderPath),
        getEntryPresentationDiagnostic: path => {
            const metadata = app.treeView.nodeMetadata.get(path);
            const folderPath = metadata?.parentPath;
            const folderRow = app.treeView.folderNodes.get(folderPath);
            const trackRow = app.treeView.fileNodes.get(path);
            const folderSwatch = folderRow?.querySelector(
                ".folder-color-readonly-swatch, .folder-color-swatch"
            );
            const trackSwatch = trackRow?.querySelector(
                ".tree-color-indicator"
            );

            return {
                folderResolvedColor: app.folderColorControl
                    .getResolvedFolderColor(folderPath),
                displayColor: app.displayState.getDisplay(path)?.color || null,
                treeColor: metadata?.color || null,
                folderDomColor: folderSwatch
                    ? getComputedStyle(folderSwatch).backgroundColor
                    : null,
                trackDomColor: trackSwatch
                    ? getComputedStyle(trackSwatch).backgroundColor
                    : null
            };
        },
        removePath: path => app.stopDisplay(path, { refocus: false }),
        reloadVisiblePath: async ({ path, fileHandle }) => {
            app.stopDisplay(path, { refocus: false, preserveSelection: true });
            app.handleDisplayToggled({
                path, fileHandle, checked: true,
                preserveMapView: true, preserveSelection: true
            });
        },
        onLibraryUpdated: (library, {
            preserveExistingPresentation = false,
            presentationUnchanged = false
        } = {}) => {
            if (!preserveExistingPresentation) {
                app.librarySettingsCoordinator.reconcileFolderPaths(
                    app.treeView.getSearchSourceEntries()
                        .filter(entry => entry.kind === "folder")
                        .map(entry => entry.path)
                );
            }
            if (!presentationUnchanged) {
                app.updateFolderColorPresentation();
            }
            app.statusBar.showLibraryLoaded(library);
            app.libraryAccessPanel.hide();
            if (app.displaySnapshotCoordinator.getStatus().restoreState ===
                "phaseB") {
                return app.displaySnapshotCoordinator.completePhaseB({
                    restored: true
                });
            }
            return app.displaySnapshotCoordinator.flush("library-refresh");
        }
    });

    app.gpxGeometryLoader.setDiagnosticObserver(
        diagnostic => app.eventBus.emit(
            "library-refresh:entry-diagnostic",
            diagnostic
        )
    );

    app.libraryAccessPanel.setLibraryRefreshRuntimeBuild(
        libraryRefresh.getDiagnostic()
    );
    libraryRefresh.bind();

    let batchSimplification = null;
    let driveLibrary = null;
    const selectedTrackFileResolver = new SelectedTrackFileResolver();
    const editor = new TrackEditingCoordinator({
        eventBus: app.eventBus,
        selectionState: app.selectionState,
        mapView: app.mapView,
        getLibraryToken: () => app.currentLibrary,
        getAvailabilityContext: () => {
            const library = app.currentLibrary;
            const previous = app.previousLibraryCoordinator.getRefreshContext();
            const currentHandle = library?.rootFolder?.handle || null;
            const directoryHandle = previous.handle || currentHandle;

            return {
                mobile: matchMedia("(max-width: 768px)").matches,
                directoryHandle,
                permission: previous.permission
            };
        },
        resolveEditableEntry: (path, directoryHandle) =>
            selectedTrackFileResolver.resolve(directoryHandle, path),
        subscribeAvailabilityChanges: listener =>
            app.previousLibraryCoordinator.subscribePersistenceStatus(listener),
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
            app.displaySnapshotCoordinator.beginPhaseB();
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
        app.libraryAccessPanel.libraryChangeContainer
    );

    const serviceWorkerRegistration = registerTrailBookServiceWorker();
    resolveBuildInfoElements([buildInfo, developmentBuildInfo], {
        serviceWorkerRegistration
    });

});
