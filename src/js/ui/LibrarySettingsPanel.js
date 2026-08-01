const STATUS_ID = "library-settings-status";

/**
 * Presents shared-settings save state and emits explicit save requests.
 */
export default class LibrarySettingsPanel {

    constructor(eventBus) {

        this.eventBus = eventBus;
        this.element = this.#create();
        this.status = this.element.querySelector(".library-settings-message");
        this.saveButton = this.element.querySelector(
            ".library-settings-save"
        );
    }

    setAvailable(available) {

        this.element.hidden = !available;
    }

    render(state) {

        const presentation = this.#getPresentation(state);

        this.status.textContent = presentation.message;
        this.element.dataset.state = presentation.state;
        this.saveButton.disabled = !state.dirty || state.saving;
        this.saveButton.title = this.saveButton.disabled
            ? state.saving
                ? "保存処理中です"
                : "未保存の変更はありません"
            : "現在のFolder色をtrailbook.jsonへ保存します";
    }

    #create() {

        const section = document.createElement("section");
        const title = document.createElement("h4");
        const message = document.createElement("p");
        const saveButton = document.createElement("button");

        section.className = "library-access-panel library-settings-panel";
        section.hidden = true;
        title.className = "library-access-title";
        title.textContent = "Shared settings";
        message.id = STATUS_ID;
        message.className = "library-access-message library-settings-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        message.setAttribute("aria-atomic", "true");
        saveButton.className = "library-settings-save";
        saveButton.type = "button";
        saveButton.textContent = "Libraryへ保存";
        saveButton.setAttribute("aria-describedby", STATUS_ID);
        saveButton.addEventListener("click", () => {
            this.eventBus.emit("library-settings:save-requested");
        });
        section.append(title, message, saveButton);

        return section;
    }

    #getPresentation(state) {

        if (state.saving) {
            return { state: "info", message: "共有設定を保存中です。" };
        }

        if (state.saveStatus === "conflict") {
            return {
                state: "error",
                message: "外部変更または既存fileを検出したため、保存を停止しました。"
            };
        }

        if (state.saveStatus === "permission-denied") {
            return {
                state: "error",
                message: "書き込み権限がありません。変更は端末内に保持されています。"
            };
        }

        if (state.saveStatus === "failed") {
            return {
                state: "error",
                message: "共有設定を保存できませんでした。変更は端末内に保持されています。"
            };
        }

        if (state.dirty) {
            return { state: "info", message: "Shared settings: Unsaved" };
        }

        if (state.saveStatus === "saved") {
            return { state: "info", message: "Shared settings: Saved" };
        }

        if (state.status === "invalid") {
            return {
                state: "error",
                message: "Shared settings: Invalid。ViewerはAutoで継続します。"
            };
        }

        return state.source === "shared-json"
            ? { state: "info", message: "Shared settings: Loaded" }
            : { state: "info", message: "Shared settings: Local only" };
    }
}
