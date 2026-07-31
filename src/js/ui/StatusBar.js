export default class StatusBar {

    constructor() {

        this.element = this.create();

    }

    create() {

        const footer = document.createElement("footer");

        footer.className = "statusbar";

        footer.textContent = "Ready";

        return footer;

    }

    showLibraryLoaded(library) {

        this.element.textContent =
            `${library.name}: ${library.folderCount} folders, ` +
            `${library.gpxFileCount} GPX files`;
    }

    showError() {

        this.element.textContent = "ライブラリを開けませんでした";
    }

}