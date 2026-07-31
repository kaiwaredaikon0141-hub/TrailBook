import Config from "./Config.js";
import EventBus from "./EventBus.js";
import FolderScanner, { pickFolder } from "../services/FolderScanner.js";
import GPXLoader from "../services/GPXLoader.js";
import GPXParser from "../services/GPXParser.js";
import Toolbar from "../ui/Toolbar.js";
import TreeView from "../ui/TreeView.js";
import StatusBar from "../ui/StatusBar.js";
import MapView from "../ui/MapView.js";

/**
 * TrailBook Application
 */
export default class App {

    #presentationState = {
        selectedFileHandle: null,
        selectedFileName: null,
        parsedResult: null,
        status: "idle"
    };

    #requestId = 0;

    /**
     * Creates the application coordinator.
     */
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

        this.workspace = null;
        this.mapArea = null;

        console.log(
            `${this.config.appName} v${this.config.version}`
        );
    }

    /**
     * Application Entry Point
        *
        * @returns {void}
     */
    initialize() {

        console.log("Initializing application...");

        this.createComponents();

        this.createLayout();

        this.bindEvents();

        console.log("Application Ready.");
    }

    /**
     * Create UI Components
        *
        * @returns {void}
     */
    createComponents() {

        this.toolbar = new Toolbar(this.config.version);

        this.treeView = new TreeView(this.eventBus);

        this.statusBar = new StatusBar();

        this.mapView = new MapView(this.config, this.eventBus);
    }

    /**
     * Create Main Layout
        *
        * @returns {void}
     */
    createLayout() {

        const app = document.getElementById("app");

        this.workspace = document.createElement("main");

        this.workspace.className = "workspace";

        this.mapArea = document.createElement("section");

        this.mapArea.className = "map";

        this.mapArea.textContent = "Map Area";

        this.workspace.append(

            this.treeView.element,

            this.mapView.element

        );

        app.replaceChildren(

            this.toolbar.element,

            this.workspace,

            this.statusBar.element

        );
    }

    /**
     * Register Events
        *
        * @returns {void}
     */
    bindEvents() {

        this.eventBus.on("app:ready", () => {

            console.log("Event : app:ready");

        });

        this.eventBus.on("folder:open-requested", () => {

            this.loadLibrary();

        });

        this.eventBus.on("library:loaded", ({ library }) => {

            this.treeView.render(library);

            this.statusBar.showLibraryLoaded(library);

        });

        this.eventBus.on("library:load-failed", ({ error }) => {

            console.error("Failed to load library.", error);

            this.statusBar.showError();

        });

        this.eventBus.on("gpx:parse-requested", ({ fileHandle }) => {

            this.handleGPXRequest(fileHandle);

        });

        this.eventBus.on("gpx:parsed", ({ fileHandle, result }) => {

            this.handleGPXParsed(fileHandle, result);

        });

        this.eventBus.on("gpx:parse-failed", ({ fileHandle, error }) => {

            this.handleGPXFailed(fileHandle, error);

        });

        this.eventBus.on("map:clear-requested", () => {

            this.clearPresentation();

        });

        this.eventBus.on("map:display-failed", ({ error }) => {

            console.error("Map display failed.", error);

            this.mapView.showError();

            if (this.#presentationState.selectedFileHandle) {

                this.#setPresentationState("error", {
                    parsedResult: null
                });

                this.treeView.setError(
                    this.#presentationState.selectedFileHandle
                );
            }

            this.statusBar.showMapError();

        });

        this.toolbar.pickFolderButton.addEventListener(
            "click",
            () => this.eventBus.emit("folder:open-requested")
        );

        this.mapView.initialize();

    }

    /**
     * Opens and scans a library selected by the user.
     *
     * @returns {Promise<void>}
     */
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

    /**
     * Loads and parses one explicitly requested GPX file.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @returns {Promise<void>}
     */
    async parseGPX(fileHandle, requestId) {

        try {

            const loaded = await this.gpxLoader.load(fileHandle);
            const result = this.gpxParser.parse(
                loaded.text,
                loaded.sourceFileName
            );

            if (!this.#isCurrentRequest(fileHandle, requestId)) {
                return;
            }

            this.eventBus.emit("gpx:parsed", {
                fileHandle,
                result
            });

        } catch (error) {

            if (!this.#isCurrentRequest(fileHandle, requestId)) {
                return;
            }

            this.eventBus.emit("gpx:parse-failed", {
                fileHandle,
                error
            });
        }
    }

    /**
     * Starts parsing for a selected GPX file or refocuses an existing display.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @returns {void}
     */
    handleGPXRequest(fileHandle) {

        const isSameFile =
            this.#presentationState.selectedFileHandle === fileHandle;

        if (isSameFile && this.#presentationState.status === "loading") {
            return;
        }

        if (isSameFile && this.#presentationState.status === "loaded") {
            this.mapView.refocus();

            return;
        }

        const requestId = ++this.#requestId;

        this.#setPresentationState("loading", {
            selectedFileHandle: fileHandle,
            selectedFileName: fileHandle.name,
            parsedResult: null
        });

        this.treeView.setLoading(fileHandle);

        this.mapView.clear();

        this.mapView.resetView();

        this.mapView.showLoading();

        this.statusBar.showGPXLoading(fileHandle.name);

        this.parseGPX(fileHandle, requestId);
    }

    /**
     * Applies a successful parse result to the current presentation.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @param {object} result
     * @returns {void}
     */
    handleGPXParsed(fileHandle, result) {

        if (this.#presentationState.selectedFileHandle !== fileHandle) {
            return;
        }

        try {

            this.mapView.displayGPX(result);

            this.#setPresentationState("loaded", {
                parsedResult: result
            });

            this.treeView.setLoaded(fileHandle);

            this.statusBar.showGPXLoaded(fileHandle.name);

        } catch (error) {

            this.eventBus.emit("map:display-failed", { error });
        }
    }

    /**
     * Applies a failed parse result to the current presentation.
     *
     * @param {FileSystemFileHandle} fileHandle
     * @param {Error} error
     * @returns {void}
     */
    handleGPXFailed(fileHandle, error) {

        if (this.#presentationState.selectedFileHandle !== fileHandle) {
            return;
        }

        console.error(`Failed to parse GPX: ${fileHandle.name}`, error);

        this.#setPresentationState("error", {
            parsedResult: null
        });

        this.treeView.setError(fileHandle);

        this.mapView.clear();

        this.mapView.showError();

        this.statusBar.showGPXFailed(fileHandle.name);
    }

    /**
     * Clears the active GPX presentation.
     *
     * @returns {void}
     */
    clearPresentation() {

        this.#requestId += 1;

        this.#setPresentationState("idle", {
            selectedFileHandle: null,
            selectedFileName: null,
            parsedResult: null
        });

        this.mapView.clear();

        this.mapView.resetView();

        this.treeView.clearSelection();

        this.statusBar.showReady();
    }

    #setPresentationState(status, values = {}) {

        this.#presentationState = {
            ...this.#presentationState,
            ...values,
            status
        };
    }

    #isCurrentRequest(fileHandle, requestId) {

        return requestId === this.#requestId &&
            this.#presentationState.selectedFileHandle === fileHandle;
    }

}