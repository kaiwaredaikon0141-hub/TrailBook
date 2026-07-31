export default class Toolbar {

    constructor(version) {

        this.version = version;

        this.element = this.create();

        this.pickFolderButton =
            this.element.querySelector("#pick-folder");

    }

    create() {

        const header = document.createElement("header");

        header.className = "toolbar";

        header.innerHTML = `
            <div class="toolbar-title">
                🧭 TrailBook
            </div>

            <div class="toolbar-actions">
                <button id="pick-folder">
                    📁 ライブラリを開く
                </button>
            </div>

            <div class="toolbar-version">
                ${this.version}
            </div>
        `;

        return header;

    }

}