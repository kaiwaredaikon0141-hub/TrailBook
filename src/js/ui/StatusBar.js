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
        footer.setAttribute("role", "status");
        footer.setAttribute("aria-live", "polite");
        footer.setAttribute("aria-atomic", "true");
        footer.textContent = "ライブラリを開いてください";

        return footer;

    }

    /**
     * Displays the loaded library summary.
     *
     * @param {import("../models/Library.js").default} library
     * @returns {void}
     */
    showLibraryLoaded(library) {

        if (library.gpxFileCount === 0) {
            this.element.textContent =
                `${library.name}: GPX 0件 — ` +
                "このFolderにはGPXファイルがありません";
            return;
        }

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

    showInitial() {

        this.element.textContent = "ライブラリを開いてください";
    }

    showUnsupportedEnvironment() {

        this.element.textContent = "この環境ではライブラリを開けません";
    }

    showLibraryLoading(folderName) {

        this.element.textContent = `ライブラリを読み込み中: ${folderName}`;
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
