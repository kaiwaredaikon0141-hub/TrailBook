import SettingsConflictDialog from "./SettingsConflictDialog.js";

const STATUS_ID = "library-settings-status";

/**
 * Presents autosave status and the existing conflict recovery controls.
 */
export default class LibrarySettingsPanel {

    constructor(eventBus) {

        this.eventBus = eventBus;
        this.element = this.#create();
        this.status = this.element.querySelector(".library-settings-message");
        this.reloadButton = this.element.querySelector(
            ".library-settings-reload"
        );
        this.conflictDialog = new SettingsConflictDialog(eventBus);
        this.element.append(this.conflictDialog.element);
    }

    setAvailable(available) {

        this.element.hidden = !available;

        if (!available) {
            this.conflictDialog.close();
        }
    }

    render(state) {

        const presentation = this.#getPresentation(state);

        this.status.textContent = presentation.message;
        this.element.dataset.state = presentation.state;
        const busy = state.saving || state.reloading;

        this.reloadButton.disabled = busy;
        this.reloadButton.title = busy
            ? "Library設定を処理中です"
            : "trailbook.jsonを手動で再読み込みします";
    }

    openConflict({ invalid = false } = {}) {

        this.conflictDialog.open({
            origin: this.reloadButton,
            invalid
        });
    }

    isConflictOpen() {

        return this.conflictDialog.isOpen();
    }

    #create() {

        const section = document.createElement("section");
        const title = document.createElement("h4");
        const message = document.createElement("p");
        const reloadButton = document.createElement("button");
        const actions = document.createElement("div");

        section.className = "library-access-panel library-settings-panel";
        section.hidden = true;
        title.className = "library-access-title";
        title.textContent = "Shared settings";
        message.id = STATUS_ID;
        message.className = "library-access-message library-settings-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        message.setAttribute("aria-atomic", "true");
        reloadButton.className = "library-settings-reload";
        reloadButton.type = "button";
        reloadButton.textContent = "設定を再読み込み";
        reloadButton.setAttribute("aria-describedby", STATUS_ID);
        actions.className = "library-settings-actions";
        reloadButton.addEventListener("click", () => {
            this.eventBus.emit("library-settings:reload-requested");
        });
        actions.append(reloadButton);
        section.append(title, message, actions);

        return section;
    }

    #getPresentation(state) {

        if (state.reloading) {
            return { state: "info", message: "Shared settings: Reloading…" };
        }

        if (state.saving) {
            return { state: "info", message: "共有設定を保存中です。" };
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

        if (state.saveStatus === "conflict") {
            if (state.saveErrorCode === "write-permission-denied") {
                return {
                    state: "error",
                    message: "Overwrite権限がありません。Conflictは未解決です。"
                };
            }

            if (
                state.saveErrorCode &&
                !["conflict", "invalid-current-file"].includes(
                    state.saveErrorCode
                )
            ) {
                return {
                    state: "error",
                    message: "Conflict復旧の保存に失敗しました。Reloadまたは再試行を選択してください。"
                };
            }

            return {
                state: "error",
                message: "Shared settings: Conflict。Reloadまたは明示Overwriteを選択してください。"
            };
        }

        if (state.status === "invalid") {
            return {
                state: "error",
                message: "Shared settings: Invalid。ViewerはAutoで継続します。"
            };
        }

        if (state.dirty || state.saveStatus === "pending" || state.migrationAvailable) {
            return { state: "info", message: "Shared settings: 保存待ち（変更は端末内に保持）" };
        }

        if (state.saveStatus === "saved") {
            return { state: "info", message: "Shared settings: Saved" };
        }

        if (state.status === "read-failed") {
            return {
                state: "error",
                message: "Shared settings: Read failed。利用可能な端末内設定で継続します。"
            };
        }

        return state.source === "shared-json"
            ? { state: "info", message: "Shared settings: Loaded" }
            : { state: "info", message: "Shared settings: Local only" };
    }
}
