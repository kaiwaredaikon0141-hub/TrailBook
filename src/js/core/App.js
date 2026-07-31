import Config from "./Config.js";
import EventBus from "./EventBus.js";
import FolderScanner, { pickFolder } from "../services/FolderScanner.js";
import GPXLoader from "../services/GPXLoader.js";
import GPXParser from "../services/GPXParser.js";
import Toolbar from "../ui/Toolbar.js";
import TreeView from "../ui/TreeView.js";
import StatusBar from "../ui/StatusBar.js";

/**
 * TrailBook Application
 */
export default class App {

    /**
     * Creates the application coordinator.
     */
    constructor() {

        this.config = Config;

        this.eventBus = new EventBus();

        this.toolbar = null;
        this.treeView = null;
        this.statusBar = null;
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

        this.treeView = new TreeView();

        this.statusBar = new StatusBar();
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

            this.mapArea

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

            this.parseGPX(fileHandle);

        });

        this.eventBus.on("gpx:parsed", () => {

            console.log("GPX parsed successfully.");

        });

        this.eventBus.on("gpx:parse-failed", ({ fileHandle, error }) => {

            console.error(
                `Failed to parse GPX: ${fileHandle.name}`,
                error
            );

            this.statusBar.showGPXError();

        });

        this.toolbar.pickFolderButton.addEventListener(
            "click",
            () => this.eventBus.emit("folder:open-requested")
        );

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
    async parseGPX(fileHandle) {

        try {

            const loaded = await this.gpxLoader.load(fileHandle);
            const result = this.gpxParser.parse(
                loaded.text,
                loaded.sourceFileName
            );

            this.eventBus.emit("gpx:parsed", {
                fileHandle,
                result
            });

        } catch (error) {

            this.eventBus.emit("gpx:parse-failed", {
                fileHandle,
                error
            });
        }
    }

}