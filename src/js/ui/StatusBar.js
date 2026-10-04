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
        footer.innerHTML = `
            <span class="statusbar-message">ライブラリを開いてください</span>
            <span class="statusbar-elevation" hidden></span>
            <span class="statusbar-build-slot"></span>
        `;
        this.message = footer.querySelector(".statusbar-message");
        this.buildSlot = footer.querySelector(".statusbar-build-slot");
        this.elevation = footer.querySelector(".statusbar-elevation");

        return footer;

    }

    attachBuildInfo(element) {

        this.buildSlot.replaceChildren(element);
    }

    showCurrentElevation(result, reason = "") {

        this.elevation.hidden = false;
        this.elevation.textContent = Number.isFinite(result?.meters)
            ? `標高 約${Math.round(result.meters)} m` : "標高 —";
        this.elevation.title = reason || (Number.isFinite(result?.meters)
            ? `地表の概算標高（橋・建物の高さではありません）。出典：${result.source}` +
                `／${result.dataset}。位置誤差・地形により50 m以内は保証されません。`
            : "標高取得待ち");
        this.elevation.setAttribute("aria-label",
            `${this.elevation.textContent}。${this.elevation.title}`);
    }

    hideCurrentElevation() {

        this.elevation.hidden = true;
        this.elevation.textContent = "";
        this.elevation.title = "";
        this.elevation.removeAttribute("aria-label");
    }

    /**
     * Displays the loaded library summary.
     *
     * @param {import("../models/Library.js").default} library
     * @returns {void}
     */
    showLibraryLoaded(library) {

        if (library.gpxFileCount === 0) {
            this.message.textContent =
                `${library.name}: GPX 0件 — ` +
                "このFolderにはGPXファイルがありません";
            return;
        }

        this.message.textContent =
            `${library.name}: ${library.folderCount} folders, ` +
            `${library.gpxFileCount} GPX files`;
    }

    /**
     * Displays a concise library load error.
     *
     * @returns {void}
     */
    showError() {

        this.message.textContent = "ライブラリを開けませんでした";
    }

    showInitial() {

        this.message.textContent = "ライブラリを開いてください";
    }

    showUnsupportedEnvironment() {

        this.message.textContent = "この環境ではライブラリを開けません";
    }

    showLibraryLoading(folderName) {

        this.message.textContent = `ライブラリを読み込み中: ${folderName}`;
    }

    /**
     * Displays a map initialization or layer error.
     *
     * @returns {void}
     */
    showMapError() {

        this.message.textContent = "地図を表示できません";
    }


    showDisplaySummary(displayedCount, loadingCount) {

        this.message.textContent = loadingCount > 0
            ? `表示中: ${displayedCount} GPX / 読み込み中: ${loadingCount}`
            : `表示中: ${displayedCount} GPX`;
    }

    showDisplayError(fileName) {

        this.message.textContent = `GPXを表示できません: ${fileName}`;
    }
}
