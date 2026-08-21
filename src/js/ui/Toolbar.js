export default class Toolbar {

    constructor(version) {

        this.version = version;

        this.element = this.create();

        this.pickFolderButton =
            this.element.querySelector("#pick-folder");

        this.sidebarToggleButton =
            this.element.querySelector("#toggle-sidebar");

        this.folderPickerState = {
            disabled: false,
            descriptionId: "",
            disabledReason: ""
        };
        this.mobileLayout = false;

    }

    create() {

        const header = document.createElement("header");

        header.className = "toolbar";

        header.innerHTML = `
            <div class="toolbar-title">
                🧭 TrailBook
            </div>

            <div class="toolbar-actions">
                <button id="toggle-sidebar" type="button" aria-pressed="true">
                    サイドバー
                </button>
                <button id="pick-folder" type="button">
                    📁 端末からライブラリを開く
                </button>
            </div>

            <div class="toolbar-version">
                ${this.version}
            </div>
        `;

        return header;

    }

    setFolderPickerState({ disabled, descriptionId, disabledReason = "" }) {

        this.folderPickerState = {
            disabled,
            descriptionId,
            disabledReason
        };

        this.#applyFolderPickerState(this.folderPickerState);
    }

    setFolderPickerBusy(busy) {

        if (!busy) {
            this.#applyFolderPickerState(this.folderPickerState);
            return;
        }

        this.#applyFolderPickerState({
            ...this.folderPickerState,
            disabled: true,
            disabledReason: "Library設定を保存中です"
        });
    }

    setSidebarOpen(open) {

        this.sidebarToggleButton.setAttribute("aria-pressed", String(open));
        this.sidebarToggleButton.title = this.mobileLayout
            ? "ライブラリ"
            : open
                ? "サイドバーを閉じます"
                : "サイドバーを開きます";
    }

    setMobileLayout(mobile) {

        this.mobileLayout = Boolean(mobile);

        if (!this.mobileLayout) {
            this.sidebarToggleButton.textContent = "サイドバー";
            this.sidebarToggleButton.setAttribute("aria-label", "サイドバー");
            return;
        }

        this.sidebarToggleButton.innerHTML = `
            <svg class="mobile-library-icon" viewBox="0 0 24 24"
                aria-hidden="true" focusable="false">
                <path d="M3 6.5h7l2 2h9v10H3z"></path>
            </svg>
        `;
        this.sidebarToggleButton.setAttribute("aria-label", "ライブラリ");
        this.sidebarToggleButton.title = "ライブラリ";
    }

    #applyFolderPickerState({ disabled, descriptionId, disabledReason }) {

        this.pickFolderButton.disabled = disabled;

        if (descriptionId) {
            this.pickFolderButton.setAttribute("aria-describedby", descriptionId);
        }

        if (disabled) {
            this.pickFolderButton.setAttribute("aria-disabled", "true");
            this.pickFolderButton.title = disabledReason;
            return;
        }

        this.pickFolderButton.removeAttribute("aria-disabled");
        this.pickFolderButton.removeAttribute("title");
    }

}
