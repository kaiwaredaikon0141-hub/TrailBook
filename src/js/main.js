import App from "./core/App.js";
import CurrentPositionController from "./core/CurrentPositionController.js";
import DrivingModeController from "./core/DrivingModeController.js";
import DriveLibraryCoordinator from "./core/DriveLibraryCoordinator.js";
import BatchSimplificationCoordinator, {
    collectBatchEntries,
    supportsBatchSimplification
} from "./core/BatchSimplificationCoordinator.js";
import EditedGPXLibraryRefreshCoordinator from "./core/EditedGPXLibraryRefreshCoordinator.js";
import LibraryRefreshCoordinator from "./core/LibraryRefreshCoordinator.js";
import LibraryCacheResetCoordinator, {
    clearLibraryRuntime
} from "./core/LibraryCacheResetCoordinator.js";
import OfflineDownloadCoordinator from "./core/OfflineDownloadCoordinator.js";
import OfflineMapPackageDownloadCoordinator from
    "./core/OfflineMapPackageDownloadCoordinator.js";
import OfflineMapPackageImportCoordinator from
    "./core/OfflineMapPackageImportCoordinator.js";
import OfflineMapPackagesController from
    "./core/OfflineMapPackagesController.js";
import OfflineMapsController from "./core/OfflineMapsController.js";
import TrackEditingCoordinator from "./core/TrackEditingCoordinator.js";
import TrackSourceResolver from "./core/TrackSourceResolver.js";
import OfflineMapsRepository from "./services/OfflineMapsRepository.js";
import OfflineMapArchiveStore from "./services/OfflineMapArchiveStore.js";
import OfflineMapPackageCatalog from
    "./services/OfflineMapPackageCatalog.js";
import { BUNDLED_OFFLINE_MAP_PACKAGE_MANIFEST } from
    "./services/OfflineMapPackageManifest.js";
import OfflineMapPackageRepository from
    "./services/OfflineMapPackageRepository.js";
import OfflineMapRegionCatalog from
    "./services/OfflineMapRegionCatalog.js";
import OfflineTileResolver from "./services/OfflineTileResolver.js";
import PMTilesArchiveReader from "./services/PMTilesArchiveReader.js";
import SelectedTrackFileResolver from "./services/SelectedTrackFileResolver.js";
import { registerTrailBookServiceWorker } from "./services/PWAServiceWorker.js";
import { folderPathFromFilePath } from "./utils/PathUtils.js";
import {
    createBuildInfoElement,
    resolveBuildInfoElements
} from "./ui/BuildInfoView.js";
import LibraryDiagnosticsPanel from "./ui/LibraryDiagnosticsPanel.js";
import LibraryMaintenancePanel from "./ui/LibraryMaintenancePanel.js";
import AppUpdateCoordinator from "./core/AppUpdateCoordinator.js";
import OfflineMapsPanel from "./ui/OfflineMapsPanel.js";

window.addEventListener("DOMContentLoaded", () => {

    const app = new App();

    app.initialize();
    const trackSourceResolver = new TrackSourceResolver({
        catalog: app.libraryTrackCatalogCoordinator.catalog,
        getLibraryIdentity: () => app.gpxGeometryLoader.namespace
    });
    app.gpxGeometryLoader.setSourceResolver(trackSourceResolver);
    app.trackDiscoveryCoordinator.setSourceResolver(trackSourceResolver);
    const staticBasemapProviders = app.mapView.basemapProviders;
    const offlineMapsRepository = new OfflineMapsRepository();
    const offlineTileResolver = new OfflineTileResolver(
        offlineMapsRepository
    );
    const offlineDownloadCoordinator = new OfflineDownloadCoordinator({
        providerRegistry: staticBasemapProviders,
        repository: offlineMapsRepository
    });
    const offlineMapsPanel = new OfflineMapsPanel();
    const offlineMapsController = new OfflineMapsController({
        panel: offlineMapsPanel,
        mapView: app.mapView,
        providerRegistry: staticBasemapProviders,
        repository: offlineMapsRepository,
        downloadCoordinator: offlineDownloadCoordinator,
        eventBus: app.eventBus
    });
    const packageRepository = new OfflineMapPackageRepository();
    const packageArchiveStore = new OfflineMapArchiveStore();
    const packageArchiveReader = new PMTilesArchiveReader();
    const packageDownloadCoordinator =
        new OfflineMapPackageDownloadCoordinator({
            repository: packageRepository,
            archiveStore: packageArchiveStore,
            archiveReader: packageArchiveReader
        });
    const packageImportCoordinator = new OfflineMapPackageImportCoordinator({
        repository: packageRepository,
        archiveStore: packageArchiveStore,
        archiveReader: packageArchiveReader
    });
    const packageBasemapCatalog = new OfflineMapPackageCatalog({
        staticProviders: staticBasemapProviders,
        repository: packageRepository,
        archiveStore: packageArchiveStore,
        archiveReader: packageArchiveReader
    });
    const packageRegionCatalog = new OfflineMapRegionCatalog({
        manifest: BUNDLED_OFFLINE_MAP_PACKAGE_MANIFEST,
        repository: packageRepository,
        archiveStore: packageArchiveStore,
        archiveReader: packageArchiveReader
    });
    const offlineMapPackagesController = new OfflineMapPackagesController({
        panel: offlineMapsPanel,
        mapView: app.mapView,
        eventBus: app.eventBus,
        regionCatalog: packageRegionCatalog,
        basemapCatalog: packageBasemapCatalog,
        downloadCoordinator: packageDownloadCoordinator,
        importCoordinator: packageImportCoordinator
    });
    const sidebarFixedControls = app.trackDiscoveryCoordinator.sidebarShell
        ?.querySelector(".sidebar-fixed-controls");

    app.mapView.setOfflineTileResolver(offlineTileResolver);
    app.mapView.setPMTilesArchiveStore(packageArchiveStore);
    sidebarFixedControls?.append(
        app.mapView.sidebarDisplayControls,
        offlineMapsPanel.element
    );
    void offlineMapsController.attach();
    void offlineMapPackagesController.attach();
    const libraryDiagnostics = new LibraryDiagnosticsPanel();
    const libraryMaintenance = new LibraryMaintenancePanel(app.eventBus);

    libraryMaintenance.attachViewStateControls(app.viewStateControls);
    const buildInfo = createBuildInfoElement();
    const mapBuildInfo = createBuildInfoElement({
        compact: true,
        mapIndicator: true
    });
    app.mapView.element.append(mapBuildInfo);
    const localDevelopment = location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" || location.hostname === "[::1]";
    const developmentBuildInfo = localDevelopment
        ? document.getElementById("trailbook-development-build-info") ||
            createBuildInfoElement({ compact: true })
        : null;

    if (developmentBuildInfo && !developmentBuildInfo.isConnected) {
        developmentBuildInfo.id = "trailbook-development-build-info";
        developmentBuildInfo.classList.add("trailbook-development-build-info");
    }
    libraryDiagnostics.appendBuildInfo(buildInfo, developmentBuildInfo);
    libraryDiagnostics.attachPreviousLibrary(
        app.libraryAccessPanel.previousLibraryStatus
    );
    libraryDiagnostics.attachFastRestore(
        app.displaySnapshotCoordinator.diagnosticElement
    );
    libraryDiagnostics.attachLibraryRefresh(
        app.libraryAccessPanel.libraryRefreshDiagnostic
    );
    const sidebarFooter = document.createElement("div");

    sidebarFooter.className = "library-sidebar-footer";
    sidebarFooter.append(
        libraryMaintenance.element,
        libraryDiagnostics.element
    );
    app.trackDiscoveryCoordinator.sidebarShell?.append(sidebarFooter);

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
        canRefresh: () => app.currentLibrary?.capabilities?.refreshMode !==
            "reselect" && (app.displaySnapshotCoordinator.getStatus()
            .restoreState === "ready" || app.librarySnapshotService.isProvisional()),
        getLibrary: () => app.currentLibrary,
        setLibrary: library => { app.currentLibrary = library; },
        getColor: path => app.getColor(path),
        reconcileSharedSettings: async ({
            library,
            rootHandle,
            folderPaths
        }) => {
            const expectedLibrary = app.currentLibrary;
            const namespace = app.gpxGeometryLoader.namespace;
            const generation = app.displayState.getLibraryGeneration();
            const isCurrent = () => (
                app.gpxGeometryLoader.namespace === namespace &&
                (
                    app.currentLibrary === expectedLibrary ||
                    app.currentLibrary?.rootFolder?.handle === rootHandle
                )
            );
            const result = await app.librarySettingsCoordinator
                .reconcileActual(rootHandle, {
                    libraryName: library.name,
                    folderPaths,
                    generation,
                    isCurrent
                });

            if (!result.applied) return false;
            app.currentLibraryId = result.libraryId;
            app.displaySnapshotCoordinator.setLibraryContext({
                libraryIdentity: result.libraryId,
                cacheNamespace: namespace
            });
            app.updateFolderColorPresentation();
            const colorMutationCount = app.trackColorMapProjection.converge(
                path => app.getColor(path)
            );

            return Object.freeze({ ...result, colorMutationCount });
        },
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
        getSnapshotPathDiagnostic: path => app.displaySnapshotCoordinator
            .getLibraryPathDiagnostic(path),
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

    const libraryCacheReset = new LibraryCacheResetCoordinator({
        eventBus: app.eventBus,
        panel: libraryMaintenance,
        prepare: async () => {
            await libraryRefresh.prepareCacheReset();
            await app.librarySettingsCoordinator.prepareCacheReset();
            await app.displaySnapshotCoordinator.prepareCacheReset();
            app.previousLibraryCoordinator.prepareCacheReset();
        },
        clearers: [
            { name: "display-snapshot", clear: () => app.displaySnapshotStore.clear() },
            { name: "geometry-cache", clear: () => app.gpxGeometryLoader.repository.clear() },
            { name: "previous-library", clear: () => app.previousLibraryStore.clear() },
            { name: "folder-presentation", clear: () => app.folderPresentationCache.clear() },
            { name: "view-state", clear: () => app.viewStateStore.clearLibraryStates() },
            { name: "discovery-view", clear: () => app.discoveryViewStateStore.clearLibraryStates() }
        ],
        clearRuntime: () => {
            app.librarySettingsCoordinator.detachForCacheReset();
            app.viewStateCoordinator.detachLibrary();
            app.displaySnapshotCoordinator.detachAfterCacheReset();
            clearLibraryRuntime(app);
            libraryRefresh.reset();
        },
        confirmReset: () => true,
        setBusy: busy => app.toolbar.setFolderPickerBusy(busy),
        onFailure: () => app.librarySettingsCoordinator.scheduleAutosave()
    });

    libraryCacheReset.bind();

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
            const currentHandle = library?.readOnly
                ? null
                : library?.rootFolder?.handle || null;
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
        isLibraryAvailable: () => supportsBatchSimplification(
            app.currentLibrary
        ),
        isEditorBusy: () => editor.isBusy(),
        refreshSavedFile: saved => editedFileRefresh.refreshVerifiedFile(saved),
        setBusy: busy => app.toolbar.setFolderPickerBusy(busy)
    });
    batchSimplification.attach(sidebarFooter, {
        before: libraryMaintenance.element
    });
    app.eventBus.on("library:source-changed", () => {
        batchSimplification.refreshAvailability();
    });

    driveLibrary = new DriveLibraryCoordinator({
        config: app.config.googleDrive,
        canSwitchLibrary: () =>
            !editor.isBusy() &&
            !batchSimplification.isBusy() &&
            app.librarySettingsCoordinator.prepareLibrarySwitch(),
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
    const appUpdateCoordinator = new AppUpdateCoordinator({
        panel: libraryMaintenance,
        serviceWorkerRegistration
    });

    appUpdateCoordinator.attach();
    resolveBuildInfoElements([buildInfo, developmentBuildInfo, mapBuildInfo], {
        serviceWorkerRegistration
    });

});
