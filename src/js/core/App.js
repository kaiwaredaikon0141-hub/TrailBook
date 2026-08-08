import Config from "./Config.js";
import EventBus from "./EventBus.js";
import FolderScanner from "../services/FolderScanner.js";
import GPXLoader from "../services/GPXLoader.js";
import GPXParser from "../services/GPXParser.js";
import GPXDisplayQueue from "../services/GPXDisplayQueue.js";
import GeometryCacheRepository from "../services/GeometryCacheRepository.js";
import GPXGeometryLoader from "../services/GPXGeometryLoader.js";
import SearchService from "../services/SearchService.js";
import TrackStyleService from "../services/TrackStyleService.js";
import DisplaySettingsStore from "../services/DisplaySettingsStore.js";
import ViewStateStore from "../services/ViewStateStore.js";
import PreviousLibraryStore from "../services/PreviousLibraryStore.js";
import LibrarySettingsCoordinator from "./LibrarySettingsCoordinator.js";
import ViewStateCoordinator from "./ViewStateCoordinator.js";
import PreviousLibraryCoordinator from "./PreviousLibraryCoordinator.js";
import DisplayState from "../state/DisplayState.js";
import SelectionState from "../state/SelectionState.js";
import FolderColorState from "../state/FolderColorState.js";
import { folderPathFromFilePath } from "../utils/PathUtils.js";
import { resolvePathHashColor } from "../utils/PathColor.js";
import Toolbar from "../ui/Toolbar.js";
import TreeView from "../ui/TreeView.js";
import FolderColorControl from "../ui/FolderColorControl.js";
import FolderColorDialog from "../ui/FolderColorDialog.js";
import SearchView from "../ui/SearchView.js";
import StatusBar from "../ui/StatusBar.js";
import LibraryAccessPanel from "../ui/LibraryAccessPanel.js";
import LibrarySettingsPanel from "../ui/LibrarySettingsPanel.js";
import ViewStateControls from "../ui/ViewStateControls.js";
import MapView from "../ui/MapView.js";

/**
 * TrailBook application coordinator.
 */
export default class App {

    #refocusTimer = null;

    #searchRefreshTimer = null;

    #displayOptions = {
        showWaypoints: false
    };

    constructor() {

        this.config = Config;
        this.eventBus = new EventBus();
        this.toolbar = null;
        this.treeView = null;
        this.searchView = null;
        this.statusBar = null;
        this.libraryAccessPanel = null;
        this.librarySettingsPanel = null;
        this.mapView = null;
        this.folderColorControl = null;
        this.folderColorDialog = null;
        this.folderScanner = new FolderScanner();
        this.gpxGeometryLoader = new GPXGeometryLoader({
            parser: new GPXParser(),
            fileLoader: new GPXLoader(),
            repository: new GeometryCacheRepository(
                this.config.geometryCache
            )
        });
        this.searchService = new SearchService();
        this.trackStyleService = new TrackStyleService(
            this.config.map.trackStyle
        );
        this.displaySettingsStore = new DisplaySettingsStore(
            this.config.uiSettings
        );
        this.viewStateStore = new ViewStateStore(this.config.viewState);
        this.previousLibraryStore = new PreviousLibraryStore(
            this.config.previousLibrary
        );
        this.folderColorState = new FolderColorState({
            store: this.displaySettingsStore,
            pathColorResolver: path => resolvePathHashColor(
                path,
                this.config.map.displayPalette
            ),
            fallbackColor: this.config.map.trackStyle.lineColor
        });
        this.librarySettingsCoordinator = new LibrarySettingsCoordinator({
            config: this.config.sharedLibrarySettings,
            displaySettingsStore: this.displaySettingsStore,
            folderColorState: this.folderColorState,
            setSaveInteraction: busy => this.toolbar?.setFolderPickerBusy(busy),
            applyFolderColorChange: path => this.applyFolderColorChange(path)
        });
        this.displayState = new DisplayState();
        this.selectionState = new SelectionState();
        this.displayQueue = new GPXDisplayQueue(2);
        this.currentTrackZoomBucket = this.trackStyleService.getZoomBucket(
            this.config.map.initialZoom
        ).name;
        this.workspace = null;
        this.currentLibrary = null;
        this.currentLibraryId = null;
    }

    initialize() {

        this.createComponents();
        this.createLayout();
        this.bindEvents();
        void this.previousLibraryCoordinator.initialize();
    }

    createComponents() {

        this.toolbar = new Toolbar(this.config.version);
        this.treeView = new TreeView(this.eventBus);
        this.searchView = new SearchView(this.eventBus);
        this.statusBar = new StatusBar();
        this.libraryAccessPanel = new LibraryAccessPanel();
        this.librarySettingsPanel = new LibrarySettingsPanel(this.eventBus);
        this.librarySettingsCoordinator.setPanel(this.librarySettingsPanel);
        this.mapView = new MapView(this.config, this.eventBus);
        this.mapView.setMapDisplayMode(
            this.displaySettingsStore.getMapMode()
        );
        this.folderColorControl = new FolderColorControl(
            this.treeView,
            this.eventBus
        );
        this.folderColorDialog = new FolderColorDialog(
            this.eventBus,
            this.config.map.trackStyle.lineColor
        );
        this.viewStateControls = new ViewStateControls(this.eventBus);
    }

    createLayout() {

        const app = document.getElementById("app");

        this.workspace = document.createElement("main");
        this.workspace.className = "workspace";

        this.treeView.element.querySelector("h3").after(
            this.libraryAccessPanel.element,
            this.librarySettingsPanel.element,
            this.viewStateControls.element,
            this.searchView.element
        );

        this.workspace.append(this.treeView.element, this.mapView.element);
        this.viewStateControls.attach({
            toolbar: this.toolbar,
            workspace: this.workspace,
            sidebar: this.treeView.element
        });
        this.viewStateCoordinator = new ViewStateCoordinator({
            eventBus: this.eventBus,
            store: this.viewStateStore,
            mapView: this.mapView,
            controls: this.viewStateControls,
            displayState: this.displayState,
            displayQueue: this.displayQueue,
            selectionState: this.selectionState,
            debounceMs: this.config.viewState.debounceMs
        });
        this.previousLibraryCoordinator = new PreviousLibraryCoordinator({
            store: this.previousLibraryStore,
            scanner: this.folderScanner,
            toolbar: this.toolbar,
            accessPanel: this.libraryAccessPanel,
            statusBar: this.statusBar,
            canSwitchLibrary: () =>
                this.librarySettingsCoordinator.canSwitchLibrary(),
            flushViewState: () => this.viewStateCoordinator.flush(),
            beforeLoad: () => this.clearSelection("library-switch"),
            applyLibrary: (library, context) =>
                this.handleLibraryLoaded(library, context),
            getCurrentLibrary: () => this.currentLibrary
        });

        app.replaceChildren(
            this.toolbar.element,
            this.workspace,
            this.statusBar.element,
            this.folderColorDialog.element
        );
    }

    bindEvents() {

        this.eventBus.on(
            "folder:open-requested",
            () => void this.previousLibraryCoordinator.openManual()
        );

        this.eventBus.on("gpx:selection-requested", data => {
            this.handleSelectionRequest(data);
        });

        this.eventBus.on("selection:changed", data => {
            this.handleSelectionChanged(data);
        });

        this.eventBus.on("gpx:display-toggled", data => {
            this.handleDisplayToggled(data);
        });

        this.eventBus.on("folder:display-toggled", data => {
            this.handleFolderDisplayToggled(data);
        });

        this.eventBus.on("folder:color-edit-requested", data => {
            this.handleFolderColorEditRequested(data);
        });

        this.eventBus.on("folder:color-change-requested", data => {
            this.handleFolderColorChangeRequested(data);
        });

        this.eventBus.on("folder:color-default-requested", data => {
            this.handleFolderColorDefaultRequested(data);
        });

        this.librarySettingsCoordinator.bindEvents(this.eventBus);

        this.eventBus.on("search:query-changed", ({ query }) => {
            this.handleSearchQuery(query);
        });

        this.eventBus.on("search:result-activated", ({ path }) => {
            this.treeView.activateSearchResult(path);
        });

        this.eventBus.on("search:gpx-display-toggled", data => {
            this.treeView.toggleSearchResultDisplay(
                data.path,
                data.checked
            );
        });

        this.eventBus.on("map:clear-requested", () => this.clearPresentation());

        this.eventBus.on("map:track-clicked", ({ path }) => {
            this.handleSelectionRequest({
                path,
                source: "map",
                refocus: false
            });
        });

        this.eventBus.on("map:background-clicked", () => {
            this.clearSelection("background");
        });

        this.eventBus.on("map:zoom-ended", data => {
            this.handleMapZoomEnded(data);
        });

        this.eventBus.on("map:waypoint-visibility-toggled", ({ visible }) => {
            this.setWaypointVisibility(visible);
        });

        this.eventBus.on("map:display-mode-changed", ({ mode }) => {
            this.setMapDisplayMode(mode);
        });

        this.eventBus.on("map:display-failed", ({ error }) => {
            console.error("Map display failed.", error);
            this.mapView.showError();
            this.statusBar.showMapError();
        });

        this.toolbar.pickFolderButton.addEventListener(
            "click",
            () => this.eventBus.emit("folder:open-requested")
        );

        this.mapView.initialize();
    }

    async handleLibraryLoaded(
        library,
        { generation, isCurrent, cacheNamespace = null }
    ) {

        if (!isCurrent()) {
            return false;
        }
        const settingsLoad = await this.librarySettingsCoordinator.load(
            library.rootFolder.handle,
            { generation, isCurrent }
        );

        if (!settingsLoad) {
            return false;
        }

        this.clearSelection("library-switch");
        this.displayQueue.clear();
        clearTimeout(this.#searchRefreshTimer);
        this.searchService.clear();
        this.searchView.setAvailable(false);
        this.mapView.clear();
        this.mapView.resetView({ silent: true });
        this.gpxGeometryLoader.setLibraryNamespace(cacheNamespace);
        this.displayState.setLibrary(library.rootFolder.handle);

        await this.treeView.render(library);

        if (!isCurrent()) {
            return false;
        }

        this.searchService.setEntries(
            library.gpxFileCount === 0
                ? []
                : this.treeView.getSearchSourceEntries()
        );
        this.searchView.setAvailable(true);

        this.currentLibrary = library;
        this.currentLibraryId = this.displaySettingsStore.setActiveLibrary(
            library.name
        );
        const folderPaths = this.treeView.getSearchSourceEntries()
            .filter(entry => entry.kind === "folder")
            .map(entry => entry.path);
        if (!this.librarySettingsCoordinator.applyLoad(settingsLoad, {
            libraryId: this.currentLibraryId,
            folderPaths
        })) {
            return false;
        }
        this.updateFolderColorPresentation();

        this.treeView.getFileEntries().forEach(({ path, fileHandle }) => {
            this.displayState.registerFile(
                path,
                fileHandle,
                this.getColor(path)
            );
        });

        this.statusBar.showLibraryLoaded(library);

        if (library.gpxFileCount === 0) {
            this.libraryAccessPanel.showEmpty(library.name);
        } else {
            this.libraryAccessPanel.hide();
        }

        void this.viewStateCoordinator.restoreLibrary({
            libraryId: this.currentLibraryId,
            libraryName: library.name,
            generation,
            isCurrent
        });

        return true;
    }

    handleSearchQuery(query) {

        const searchResult = this.searchService.search(query);
        const results = searchResult.results.map(entry => ({
            ...entry,
            ...this.treeView.getSearchResultState(entry.path),
            selected: this.selectionState.isSelected(entry.path)
        }));

        this.searchView.showResults(
            { totalCount: searchResult.totalCount, results },
            query
        );
    }

    scheduleSearchRefresh() {

        clearTimeout(this.#searchRefreshTimer);
        this.#searchRefreshTimer = setTimeout(() => {
            const query = this.searchView.getActiveQuery();

            if (query) {
                this.handleSearchQuery(query);
            }
        }, 0);
    }

    handleSelectionRequest({ path, source = "system", refocus = false } = {}) {

        if (
            !["tree", "search", "map"].includes(source) ||
            !this.treeView.hasFile(path)
        ) {
            return false;
        }

        const display = this.displayState.getDisplay(path);
        const shouldRefocus = source !== "map" && refocus;

        if (
            source === "map" &&
            (!display?.checked ||
                display.state !== "loaded" ||
                !this.mapView.hasDisplay(path))
        ) {
            return false;
        }

        if (this.selectionState.isSelected(path)) {
            if (shouldRefocus && this.mapView.hasDisplay(path)) {
                this.mapView.refocusGPX(path);
            }
            return false;
        }

        const change = this.selectionState.select(path, source);

        if (!change) {
            return false;
        }

        this.eventBus.emit("selection:changed", {
            path: change.selectedPath,
            previousPath: change.previousPath,
            reason: change.source
        });

        if (shouldRefocus && this.mapView.hasDisplay(path)) {
            this.mapView.refocusGPX(path);
        }

        return true;
    }

    handleSelectionChanged({ path, reason }) {

        const revealFromMap = reason === "map" && path !== null;
        const revealFromRestore = reason === "view-state-restore" &&
            path !== null;

        this.treeView.setSelectedPath(path, {
            reveal: revealFromMap || revealFromRestore,
            scroll: revealFromMap,
            moveFocus: false
        });
        this.searchView.setSelectedPath(path);
        this.mapView.clearSelectionHighlight();

        if (path) {
            this.applySelectionHighlight(path);
        }
    }

    clearSelection(reason = "clear") {

        const change = this.selectionState.clear("system");

        if (!change) {
            return false;
        }

        this.eventBus.emit("selection:changed", {
            path: null,
            previousPath: change.previousPath,
            reason
        });

        return true;
    }

    handleDisplayToggled({ path, fileHandle, checked }) {

        const display = this.displayState.getDisplay(path);

        if (!display) {
            this.displayState.registerFile(path, fileHandle, this.getColor(path));
        }

        this.displayState.setChecked(path, checked);
        this.treeView.setDisplayChecked(path, checked);

        if (!checked) {
            this.stopDisplay(path);
            return;
        }

        this.startDisplay(path, fileHandle);
    }

    handleFolderDisplayToggled({ fileEntries, checked }) {

        fileEntries.forEach(({ path, fileHandle }) => {

            let display = this.displayState.getDisplay(path);

            if (!display) {
                this.displayState.registerFile(
                    path,
                    fileHandle,
                    this.getColor(path)
                );

                display = this.displayState.getDisplay(path);
            }

            if (
                checked &&
                display.checked &&
                (display.state === "loading" || display.state === "loaded")
            ) {
                return;
            }

            this.handleDisplayToggled({ path, fileHandle, checked });
        });

        this.updateDisplayStatus();
    }

    startDisplay(path, fileHandle) {

        const display = this.displayState.getDisplay(path);
        const cachedResult = this.displayState.getCachedResult(path);
        const color = display.color;

        if (cachedResult) {
            this.displayState.setLoaded(path, cachedResult);
            this.treeView.setDisplayLoaded(path, color);
            this.mapView.displayGPX(
                path,
                cachedResult,
                this.createTrackStyle(color),
                { showWaypoints: this.#displayOptions.showWaypoints }
            );
            this.applySelectionHighlight(path);
            this.scheduleRefocus();
            this.updateDisplayStatus();
            this.scheduleSearchRefresh();
            return;
        }

        const requestId = this.displayState.nextRequestId(path);
        const generation = this.displayState.getLibraryGeneration();

        this.displayState.setChecked(path, true);
        this.displayState.setLoading(path, requestId);
        this.treeView.setDisplayLoading(path);
        this.updateDisplayStatus();
        this.scheduleSearchRefresh();

        this.displayQueue.enqueue({
            path,
            fileHandle,
            generation,
            requestId,
            run: () => this.gpxGeometryLoader.load(path, fileHandle),
            onSuccess: result => this.handleDisplayParsed(
                path,
                result,
                generation,
                requestId
            ),
            onFailure: error => this.handleDisplayFailed(
                path,
                error,
                generation,
                requestId
            )
        });
    }

    handleDisplayParsed(path, result, generation, requestId) {

        const display = this.displayState.getDisplay(path);

        if (
            generation !== this.displayState.getLibraryGeneration() ||
            !display ||
            display.requestId !== requestId
        ) {
            return;
        }

        this.displayState.setCachedResult(path, result);

        if (!display.checked) {
            this.displayState.setIdle(path);
            this.treeView.setDisplayIdle(path);
            this.scheduleSearchRefresh();
            return;
        }

        this.displayState.setLoaded(path, result);
        this.treeView.setDisplayLoaded(path, display.color);
        this.mapView.displayGPX(
            path,
            result,
            this.createTrackStyle(display.color),
            { showWaypoints: this.#displayOptions.showWaypoints }
        );
        this.applySelectionHighlight(path);
        this.scheduleRefocus();
        this.updateDisplayStatus();
        this.scheduleSearchRefresh();
    }

    handleDisplayFailed(path, error, generation, requestId) {

        const display = this.displayState.getDisplay(path);

        if (
            generation !== this.displayState.getLibraryGeneration() ||
            !display ||
            display.requestId !== requestId ||
            !display.checked
        ) {
            return;
        }

        console.error(
            `Failed to display GPX: ${display.fileHandle.name}`,
            error
        );
        if (this.selectionState.isSelected(path)) {
            this.clearSelection("parse-failure");
        }
        this.displayState.setError(path, error);
        this.treeView.setDisplayError(path);
        this.updateDisplayStatus();
        this.statusBar.showDisplayError(display.fileHandle.name);
        this.scheduleSearchRefresh();
    }

    stopDisplay(path) {

        const display = this.displayState.getDisplay(path);

        if (!display) {
            return;
        }

        if (this.selectionState.isSelected(path)) {
            this.clearSelection("hidden");
        }

        this.displayQueue.invalidate(path, display.requestId);
        this.displayState.invalidateRequest(path);
        this.mapView.removeGPX(path);
        this.treeView.setDisplayChecked(path, false);

        if (display.state !== "error") {
            this.treeView.setDisplayIdle(path);
        }

        this.scheduleRefocus();
        this.updateDisplayStatus();
        this.scheduleSearchRefresh();
    }

    clearPresentation() {

        this.clearSelection("clear");
        this.displayQueue.clear();
        this.displayState.clearDisplays();
        this.mapView.clear();
        this.mapView.resetView();
        this.treeView.clearDisplayStates();
        this.scheduleRefocus();
        this.updateDisplayStatus();
        this.scheduleSearchRefresh();
    }

    setWaypointVisibility(visible) {

        this.#displayOptions.showWaypoints = visible;

        this.displayState.getDisplays().forEach(display => {
            if (!display.checked || display.state !== "loaded") {
                return;
            }

            const result = this.displayState.getCachedResult(display.path);

            if (!result) {
                return;
            }

            try {
                if (visible) {
                    this.mapView.addWaypoints(display.path, result);
                } else {
                    this.mapView.removeWaypoints(display.path);
                }
            } catch (error) {
                console.error(
                    `Failed to update Waypoints: ${display.fileHandle.name}`,
                    error
                );
            }
        });
    }

    updateDisplayStatus() {

        let displayedCount = 0;
        let loadingCount = 0;

        this.displayState.getDisplays().forEach(display => {
            if (display.checked && display.state === "loaded") {
                displayedCount += 1;
            }

            if (display.checked && display.state === "loading") {
                loadingCount += 1;
            }
        });

        this.statusBar.showDisplaySummary(displayedCount, loadingCount);
    }

    scheduleRefocus() {
        if (this.viewStateCoordinator.isRestoring()) {
            return;
        }

        clearTimeout(this.#refocusTimer);

        this.#refocusTimer = setTimeout(() => {
            if (this.displayState.getDisplays().size === 0) {
                this.mapView.resetView();
                return;
            }

            this.mapView.refocus();
        }, 250);
    }

    setMapDisplayMode(mode) {

        this.displaySettingsStore.setMapMode(mode);

        return this.mapView.setMapDisplayMode(
            this.displaySettingsStore.getMapMode()
        );
    }

    handleFolderColorEditRequested({
        folderPath,
        folderName,
        origin
    } = {}) {

        if (!this.folderColorState.hasFolderPath(folderPath)) {
            return false;
        }

        this.folderColorDialog.open({
            folderPath,
            folderName,
            ...this.folderColorState.getFolderPresentation(folderPath),
            origin
        });

        return true;
    }

    handleFolderColorChangeRequested({ folderPath, color } = {}) {

        if (!this.folderColorState.setExplicitColor(folderPath, color)) {
            return false;
        }

        this.applyFolderColorChange(folderPath);
        this.librarySettingsCoordinator.markDirty();

        return true;
    }

    handleFolderColorDefaultRequested({ folderPath } = {}) {

        if (!this.folderColorState.removeExplicitColor(folderPath)) {
            return false;
        }

        this.applyFolderColorChange(folderPath);
        this.librarySettingsCoordinator.markDirty();

        return true;
    }

    applyFolderColorChange(folderPath) {

        const affectedFolders = new Set(
            this.folderColorState.getAffectedFolderPaths(folderPath)
        );
        let updatedLayers = 0;

        this.displayState.getDisplays().forEach(display => {
            const displayFolderPath = folderPathFromFilePath(display.path);

            if (!affectedFolders.has(displayFolderPath)) {
                return;
            }

            const color = this.folderColorState.resolveTrackColor(
                display.path,
                displayFolderPath
            );

            if (display.color === color) {
                return;
            }

            display.color = color;
            this.folderColorControl.setFileColor(display.path, color);
            this.searchView.setResultColor(display.path, color);

            if (!this.mapView.hasDisplay(display.path)) {
                return;
            }

            updatedLayers += this.mapView.updateTrackColor(
                display.path,
                {
                    normalStyle: this.createTrackStyle(color),
                    ...this.createSelectionStyles(color)
                }
            );
        });

        this.updateFolderColorPresentation();

        return updatedLayers;
    }

    updateFolderColorPresentation() {

        this.folderColorControl.setPersistenceStatus(
            this.displaySettingsStore.getStatus().persistence
        );
        this.folderColorControl.setPresentations(
            this.folderColorState.getFolderPresentations()
        );
    }

    getColor(path) {

        return this.folderColorState.resolveTrackColor(path);
    }

    createTrackStyle(color) {

        return this.trackStyleService.getNormalStyle({
            color,
            zoomLevel: this.mapView.getZoom()
        });
    }

    createSelectionStyles(color, zoomLevel = this.mapView.getZoom()) {

        return {
            selectedMainStyle: this.trackStyleService.getSelectedMainStyle({
                color,
                zoomLevel
            }),
            selectedOutlineStyle: this.trackStyleService.getSelectedOutlineStyle({
                color,
                zoomLevel
            })
        };
    }

    applySelectionHighlight(path) {

        const display = this.displayState.getDisplay(path);

        if (
            !this.selectionState.isSelected(path) ||
            !display?.checked ||
            display.state !== "loaded" ||
            !this.mapView.hasDisplay(path)
        ) {
            return false;
        }

        const styles = this.createSelectionStyles(display.color);

        return this.mapView.setSelectedPath(
            path,
            styles.selectedMainStyle,
            styles.selectedOutlineStyle
        );
    }

    handleMapZoomEnded({ zoom } = {}) {

        const bucket = this.trackStyleService.getZoomBucket(zoom);

        if (bucket.name === this.currentTrackZoomBucket) {
            return;
        }

        this.currentTrackZoomBucket = bucket.name;
        const selectedDisplay = this.displayState.getDisplay(
            this.selectionState.getSelectedPath()
        );
        const selectionStyles = this.createSelectionStyles(
            selectedDisplay?.color,
            zoom
        );

        this.mapView.updateTrackStyles({
            normalWeight: bucket.weight,
            selectedMainWeight: selectionStyles.selectedMainStyle.weight,
            outlineWeight: selectionStyles.selectedOutlineStyle.weight
        });
    }
}
