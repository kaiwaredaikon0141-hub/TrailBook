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
                <button id="pick-folder" type="button">
                    📁 ライブラリを開く
                </button>
            </div>

            <div class="toolbar-version">
                ${this.version}
            </div>
        `;

        return header;

    }

    setFolderPickerState({ disabled, descriptionId, disabledReason = "" }) {

        this.pickFolderButton.disabled = disabled;
        this.pickFolderButton.setAttribute("aria-describedby", descriptionId);

        if (disabled) {
            this.pickFolderButton.setAttribute("aria-disabled", "true");
            this.pickFolderButton.title = disabledReason;
            return;
        }

        this.pickFolderButton.removeAttribute("aria-disabled");
        this.pickFolderButton.removeAttribute("title");
    }

}
