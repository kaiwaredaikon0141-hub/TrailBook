import Config from "./Config.js";
import EventBus from "./EventBus.js";
import FolderScanner, { pickFolder } from "../services/FolderScanner.js";
import Toolbar from "../ui/Toolbar.js";
import TreeView from "../ui/TreeView.js";
import StatusBar from "../ui/StatusBar.js";

/**
 * TrailBook Application
 */
export default class App {

    constructor() {

        this.config = Config;

        this.eventBus = new EventBus();

        this.toolbar = null;
        this.treeView = null;
        this.statusBar = null;
        this.folderScanner = new FolderScanner();

        this.workspace = null;
        this.mapArea = null;

        console.log(
            `${this.config.appName} v${this.config.version}`
        );
    }

    /**
     * Application Entry Point
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
     */
    createComponents() {

        this.toolbar = new Toolbar(this.config.version);

        this.treeView = new TreeView();

        this.statusBar = new StatusBar();
    }

    /**
     * Create Main Layout
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

        this.toolbar.pickFolderButton.addEventListener(
            "click",
            () => this.eventBus.emit("folder:open-requested")
        );

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

}