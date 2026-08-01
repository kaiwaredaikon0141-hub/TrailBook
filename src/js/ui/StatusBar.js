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

    /**
     * Displays a GPX loading message.
     *
     * @param {string} fileName
     * @returns {void}
     */
    showGPXLoading(fileName) {

        this.element.textContent = `GPXを読み込み中: ${fileName}`;
    }

    /**
     * Displays a loaded GPX message.
     *
     * @param {string} fileName
     * @returns {void}
     */
    showGPXLoaded(fileName) {

        this.element.textContent = `表示中: ${fileName}`;
    }

    /**
     * Displays a file-specific GPX error.
     *
     * @param {string} fileName
     * @returns {void}
     */
    showGPXFailed(fileName) {

        this.element.textContent = `GPXを表示できません: ${fileName}`;
    }

    /**
     * Restores the ready status.
     *
     * @returns {void}
     */
    showReady() {

        this.element.textContent = "Ready";
    }

    /**
     * Displays a map initialization or layer error.
     *
     * @returns {void}
     */
    showMapError() {

        this.element.textContent = "地図を表示できません";
    }


    showDisplaySummary(displayedCount, loadingCount) {

        this.element.textContent = loadingCount > 0
            ? `表示中: ${displayedCount} GPX / 読み込み中: ${loadingCount}`
            : `表示中: ${displayedCount} GPX`;
    }

    showDisplayError(fileName) {

        this.element.textContent = `GPXを表示できません: ${fileName}`;
    }
}