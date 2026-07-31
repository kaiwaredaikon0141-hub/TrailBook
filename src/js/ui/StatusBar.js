export default class StatusBar {

    /**
     * Creates a status bar in the ready state.
     */
    constructor() {

        this.element = this.create();

    }

    /**
     * Creates the status bar element.
     *
     * @returns {HTMLElement}
     */
    create() {

        const footer = document.createElement("footer");

        footer.className = "statusbar";

        footer.textContent = "Ready";

        return footer;

    }

    /**
     * Displays the loaded library summary.
     *
     * @param {import("../models/Library.js").default} library
     * @returns {void}
     */
    showLibraryLoaded(library) {

        this.element.textContent =
            `${library.name}: ${library.folderCount} folders, ` +
            `${library.gpxFileCount} GPX files`;
    }

    /**
     * Displays a concise library load error.
     *
     * @returns {void}
     */
    showError() {

        this.element.textContent = "ライブラリを開けませんでした";
    }

    /**
     * Displays a concise GPX parsing error.
     *
     * @returns {void}
     */
    showGPXError() {

        this.element.textContent = "GPXを解析できませんでした";
    }

}