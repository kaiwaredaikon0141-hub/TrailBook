/**
 * Native dialog for editing one Folder's explicit presentation color.
 */
export default class FolderColorDialog {

    constructor(eventBus, defaultPreviewColor = "#e53935") {

        this.eventBus = eventBus;
        this.defaultPreviewColor = defaultPreviewColor;
        this.folderPath = null;
        this.origin = null;
        this.element = this.#create();
        this.title = this.element.querySelector(".folder-color-dialog-title");
        this.state = this.element.querySelector(".folder-color-dialog-state");
        this.colorInput = this.element.querySelector(".folder-color-input");
    }

    open({
        folderPath,
        folderName,
        mode,
        explicitColor,
        resolvedColor,
        origin
    }) {

        this.folderPath = folderPath;
        this.origin = origin || null;
        this.title.textContent = `Folder色: ${folderName}`;
        this.state.textContent = `現在の状態: ${this.#modeLabel(mode)}`;
        this.colorInput.value = (
            explicitColor || resolvedColor || this.defaultPreviewColor
        ).toLowerCase();

        if (typeof this.element.showModal === "function") {
            this.element.showModal();
        } else {
            this.element.setAttribute("open", "");
        }

        this.colorInput.focus();
    }

    close() {

        if (typeof this.element.close === "function") {
            this.element.close();
        } else {
            this.element.removeAttribute("open");
            this.#restoreFocus();
        }
    }

    #create() {

        const dialog = document.createElement("dialog");
        const title = document.createElement("h2");
        const state = document.createElement("p");
        const label = document.createElement("label");
        const colorInput = document.createElement("input");
        const actions = document.createElement("div");
        const applyButton = document.createElement("button");
        const defaultButton = document.createElement("button");
        const cancelButton = document.createElement("button");

        dialog.className = "folder-color-dialog";
        dialog.setAttribute("aria-labelledby", "folder-color-dialog-title");
        title.id = "folder-color-dialog-title";
        title.className = "folder-color-dialog-title";
        state.className = "folder-color-dialog-state";
        label.className = "folder-color-label";
        label.textContent = "明示色";
        colorInput.className = "folder-color-input";
        colorInput.type = "color";
        actions.className = "folder-color-dialog-actions";
        applyButton.type = "button";
        applyButton.textContent = "Apply";
        defaultButton.type = "button";
        defaultButton.textContent = "Defaultへ戻す";
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        label.append(colorInput);
        actions.append(defaultButton, cancelButton, applyButton);
        dialog.append(title, state, label, actions);

        applyButton.addEventListener("click", () => {
            this.eventBus.emit("folder:color-change-requested", {
                folderPath: this.folderPath,
                color: colorInput.value
            });
            this.close();
        });
        defaultButton.addEventListener("click", () => {
            this.eventBus.emit("folder:color-default-requested", {
                folderPath: this.folderPath
            });
            this.close();
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

        this.folderPath = null;
        this.origin = null;
        origin?.focus();
    }

    #modeLabel(mode) {

        switch (mode) {
        case "explicit":
            return "Explicit";
        case "inherited":
            return "Inherited";
        default:
            return "Auto";
        }
    }
}
