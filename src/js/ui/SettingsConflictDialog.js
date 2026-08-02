const TITLE_ID = "settings-conflict-dialog-title";
const DESCRIPTION_ID = "settings-conflict-dialog-description";

/**
 * Presents explicit recovery choices without accessing settings state or files.
 */
export default class SettingsConflictDialog {

    constructor(eventBus) {

        this.eventBus = eventBus;
        this.origin = null;
        this.element = this.#create();
        this.description = this.element.querySelector(
            ".settings-conflict-dialog-description"
        );
        this.cancelButton = this.element.querySelector(
            ".settings-conflict-cancel"
        );
    }

    open({ origin = null, invalid = false } = {}) {

        if (this.isOpen()) {
            return;
        }

        this.origin = origin;
        this.description.textContent = invalid
            ? "Library設定fileが無効です。自動修正や自動mergeは行いません。"
            : "Library設定が外部で変更されました。TrailBook側には未保存の変更があります。自動mergeは行いません。";

        if (typeof this.element.showModal === "function") {
            this.element.showModal();
        } else {
            this.element.setAttribute("open", "");
        }

        this.cancelButton.focus();
    }

    close() {

        if (!this.isOpen()) {
            return;
        }

        if (typeof this.element.close === "function") {
            this.element.close();
            this.#restoreFocus();
        } else {
            this.element.removeAttribute("open");
            this.#restoreFocus();
        }
    }

    isOpen() {

        return this.element.open || this.element.hasAttribute("open");
    }

    #create() {

        const dialog = document.createElement("dialog");
        const title = document.createElement("h2");
        const description = document.createElement("p");
        const detail = document.createElement("p");
        const actions = document.createElement("div");
        const reloadButton = document.createElement("button");
        const overwriteButton = document.createElement("button");
        const cancelButton = document.createElement("button");

        dialog.className = "settings-conflict-dialog";
        dialog.setAttribute("aria-labelledby", TITLE_ID);
        dialog.setAttribute("aria-describedby", DESCRIPTION_ID);
        title.id = TITLE_ID;
        title.textContent = "Library設定の競合";
        description.id = DESCRIPTION_ID;
        description.className = "settings-conflict-dialog-description";
        detail.textContent = "Reloadは外部fileを採用し、Overwriteは現在のTrailBook側設定で明示的に置き換えます。";
        actions.className = "settings-conflict-dialog-actions";
        reloadButton.type = "button";
        reloadButton.className = "settings-conflict-reload";
        reloadButton.textContent = "Reloadして破棄";
        overwriteButton.type = "button";
        overwriteButton.className = "settings-conflict-overwrite";
        overwriteButton.textContent = "明示的にOverwrite";
        cancelButton.type = "button";
        cancelButton.className = "settings-conflict-cancel";
        cancelButton.textContent = "Cancel";
        cancelButton.autofocus = true;
        actions.append(reloadButton, overwriteButton, cancelButton);
        dialog.append(title, description, detail, actions);

        reloadButton.addEventListener("click", () => {
            this.close();
            this.eventBus.emit("library-settings:conflict-reload-requested");
        });
        overwriteButton.addEventListener("click", () => {
            this.close();
            this.eventBus.emit("library-settings:overwrite-requested");
        });
        cancelButton.addEventListener("click", () => this.close());
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
        if (origin && origin.isConnected !== false) {
            origin.focus();
        }
    }
}
