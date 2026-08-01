import Config from "./Config.js";
import EventBus from "./EventBus.js";
import FolderScanner, { pickFolder } from "../services/FolderScanner.js";
import GPXLoader from "../services/GPXLoader.js";
import GPXParser from "../services/GPXParser.js";
import GPXDisplayQueue from "../services/GPXDisplayQueue.js";
import DisplayState from "../state/DisplayState.js";
import Toolbar from "../ui/Toolbar.js";
import TreeView from "../ui/TreeView.js";
import StatusBar from "../ui/StatusBar.js";
import MapView from "../ui/MapView.js";

/**
 * TrailBook application coordinator.
 */
export default class App {

    #presentationState = {
        selectedFileHandle: null,
        selectedFileName: null,
        selectedFilePath: null,
        status: "idle"
    };

    #refocusTimer = null;

    #displayOptions = {
        showWaypoints: false
    };

    constructor() {

        this.config = Config;
        this.eventBus = new EventBus();
        this.toolbar = null;
        this.treeView = null;
        this.statusBar = null;
        this.mapView = null;
        this.folderScanner = new FolderScanner();
        this.gpxLoader = new GPXLoader();
        this.gpxParser = new GPXParser();
        this.displayState = new DisplayState();
        this.displayQueue = new GPXDisplayQueue(2);
        this.workspace = null;
        this.mapArea = null;

        console.log(`${this.config.appName} v${this.config.version}`);
    }

    initialize() {

        console.log("Initializing application...");
        this.createComponents();
        this.createLayout();
        this.bindEvents();
        console.log("Application Ready.");
    }

    createComponents() {

        this.toolbar = new Toolbar(this.config.version);
        this.treeView = new TreeView(this.eventBus);
        this.statusBar = new StatusBar();
        this.mapView = new MapView(this.config, this.eventBus);
    }

    createLayout() {

        const app = document.getElementById("app");

        this.workspace = document.createElement("main");
        this.workspace.className = "workspace";

        this.mapArea = document.createElement("section");
        this.mapArea.className = "map";
        this.mapArea.textContent = "Map Area";

        this.workspace.append(this.treeView.element, this.mapView.element);

        app.replaceChildren(
            this.toolbar.element,
            this.workspace,
            this.statusBar.element
        );
    }

    bindEvents() {

        this.eventBus.on("app:ready", () => console.log("Event : app:ready"));

        this.eventBus.on("folder:open-requested", () => this.loadLibrary());

        this.eventBus.on("library:loaded", ({ library }) => {
            void this.handleLibraryLoaded(library);
        });

        this.eventBus.on("library:load-failed", ({ error }) => {
            console.error("Failed to load library.", error);
            this.statusBar.showError();
        });

        this.eventBus.on("gpx:selected", data => {
            this.handleGPXSelected(data);
        });

        this.eventBus.on("gpx:display-toggled", data => {
            this.handleDisplayToggled(data);
        });

        this.eventBus.on("folder:display-toggled", data => {
            this.handleFolderDisplayToggled(data);
        });

        this.eventBus.on("map:clear-requested", () => this.clearPresentation());

        this.eventBus.on("map:waypoint-visibility-toggled", ({ visible }) => {
            this.setWaypointVisibility(visible);
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

    async loadLibrary() {

        try {
            const handle = await pickFolder();

            if (!handle) {
                return;
            }

            const library = await this.folderScanner.scan(handle);
            this.eventBus.emit("library:loaded", { library });

        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            this.eventBus.emit("library:load-failed", { error });
        }
    }

    async handleLibraryLoaded(library) {

        this.displayQueue.clear();
        this.mapView.clear();
        this.mapView.resetView();
        this.displayState.setLibrary(library.rootFolder.handle);

        await this.treeView.render(library);

        this.treeView.getFileEntries().forEach(({ path, fileHandle }) => {
            this.displayState.registerFile(
                path,
                fileHandle,
                this.getColor(path)
            );
        });

        this.statusBar.showLibraryLoaded(library);
    }

    handleGPXSelected({ path, fileHandle }) {

        this.#presentationState.selectedFileHandle = fileHandle;
        this.#presentationState.selectedFileName = fileHandle.name;
        this.#presentationState.selectedFilePath = path;
        this.#presentationState.status = "selected";

        if (this.displayState.getDisplay(path)?.checked) {
            this.mapView.refocusGPX(path);
        }
    }

    handleDisplayToggled({ path, fileHandle, checked }) {

        const display = this.displayState.getDisplay(path);

        if (!display) {
            this.displayState.registerFile(path, fileHandle, this.getColor(path));
        }

        this.displayState.setChecked(path, checked);

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
            this.scheduleRefocus();
            this.updateDisplayStatus();
            return;
        }

        const requestId = this.displayState.nextRequestId(path);
        const generation = this.displayState.getLibraryGeneration();

        this.displayState.setChecked(path, true);
        this.displayState.setLoading(path, requestId);
        this.treeView.setDisplayLoading(path);
        this.updateDisplayStatus();

        this.displayQueue.enqueue({
            path,
            fileHandle,
            generation,
            requestId,
            run: async () => {
                const loaded = await this.gpxLoader.load(fileHandle);
                return this.gpxParser.parse(
                    loaded.text,
                    loaded.sourceFileName
                );
            },
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
        this.scheduleRefocus();
        this.updateDisplayStatus();
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

        console.error(`Failed to display GPX: ${path}`, error);
        this.displayState.setError(path, error);
        this.treeView.setDisplayError(path);
        this.updateDisplayStatus();
        this.statusBar.showDisplayError(display.fileHandle.name);
    }

    stopDisplay(path) {

        const display = this.displayState.getDisplay(path);

        if (!display) {
            return;
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
    }

    clearPresentation() {

        this.displayQueue.clear();
        this.displayState.clearDisplays();
        this.mapView.clear();
        this.mapView.resetView();
        this.treeView.clearDisplayStates();
        this.scheduleRefocus();
        this.updateDisplayStatus();
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
                    `Failed to update Waypoints: ${display.path}`,
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

        clearTimeout(this.#refocusTimer);

        this.#refocusTimer = setTimeout(() => {
            if (this.displayState.getDisplays().size === 0) {
                this.mapView.resetView();
                return;
            }

            this.mapView.refocus();
        }, 250);
    }

    getColor(path) {

        const palette = this.config.map.displayPalette;
        let hash = 0;

        for (let index = 0; index < path.length; index += 1) {
            hash = ((hash << 5) - hash + path.charCodeAt(index)) | 0;
        }

        return palette[Math.abs(hash) % palette.length];
    }

    createTrackStyle(color) {

        return {
            color,
            lineColor: color,
            weight: this.config.map.trackStyle.lineWeight,
            opacity: this.config.map.trackStyle.lineOpacity
        };
    }
}
