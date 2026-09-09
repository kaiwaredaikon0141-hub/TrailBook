const TITLE_ID = "library-cache-reset-dialog-title";
const DESCRIPTION_ID = "library-cache-reset-dialog-description";

/** Presents the destructive local-cache reset confirmation only. */
export default class LibraryCacheResetDialog {

    constructor(eventBus) {

        this.eventBus = eventBus;
        this.origin = null;
        this.element = this.#create();
        this.cancelButton = this.element.querySelector(
            ".library-cache-reset-cancel"
        );
    }

    open(origin = null) {

        if (this.isOpen()) return;
        this.origin = origin;
        if (typeof this.element.showModal === "function") {
            this.element.showModal();
        } else {
            this.element.setAttribute("open", "");
        }
        this.cancelButton.focus();
    }

    close() {

        if (!this.isOpen()) return;
        if (typeof this.element.close === "function") this.element.close();
        else this.element.removeAttribute("open");
        this.#restoreFocus();
    }

    isOpen() {

        return this.element.open || this.element.hasAttribute("open");
    }

    #create() {

        const dialog = document.createElement("dialog");
        const title = document.createElement("h2");
        const description = document.createElement("p");
        const actions = document.createElement("div");
        const cancelButton = document.createElement("button");
        const resetButton = document.createElement("button");

        dialog.className = "settings-conflict-dialog library-cache-reset-dialog";
        dialog.setAttribute("aria-labelledby", TITLE_ID);
        dialog.setAttribute("aria-describedby", DESCRIPTION_ID);
        title.id = TITLE_ID;
        title.textContent = "Libraryキャッシュをリセット";
        description.id = DESCRIPTION_ID;
        description.textContent =
            "TrailBookが保存しているLibraryのキャッシュと復元情報を削除します。" +
            "GPXファイルとtrailbook.jsonは変更されません。続行しますか？";
        actions.className = "settings-conflict-dialog-actions";
        cancelButton.type = "button";
        cancelButton.className = "library-cache-reset-cancel";
        cancelButton.textContent = "Cancel";
        cancelButton.autofocus = true;
        resetButton.type = "button";
        resetButton.className = "library-cache-reset-confirm";
        resetButton.textContent = "Reset";
        actions.append(cancelButton, resetButton);
        dialog.append(title, description, actions);

        cancelButton.addEventListener("click", () => this.close());
        resetButton.addEventListener("click", () => {
            this.close();
            this.eventBus.emit("library-cache:reset-requested");
        });
        dialog.addEventListener("cancel", event => {
            event.preventDefault();
            this.close();
        });
        dialog.addEventListener("close", () => this.#restoreFocus());
        return dialog;
    }

    #restoreFocus() {

        const origin = this.origin;

        this.origin = null;
        if (origin && origin.isConnected !== false) origin.focus();
    }
}
