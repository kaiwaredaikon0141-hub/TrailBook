import LibraryCacheResetDialog from "./LibraryCacheResetDialog.js";

/** Groups local maintenance actions without owning their persistence. */
export default class LibraryMaintenancePanel {

    constructor(eventBus, documentTarget = globalThis.document) {

        this.eventBus = eventBus;
        this.element = this.#create(documentTarget);
        this.disclosure = this.element.querySelector(
            ".library-maintenance-disclosure"
        );
        this.actions = this.element.querySelector(
            ".library-maintenance-actions"
        );
        this.viewStateStatus = this.element.querySelector(
            ".library-maintenance-view-status"
        );
        this.cacheResetButton = this.element.querySelector(
            ".library-cache-reset"
        );
        this.cacheResetStatus = this.element.querySelector(
            ".library-cache-reset-status"
        );
        this.appUpdateButton = this.element.querySelector(".app-update-action");
        this.appUpdateStatus = this.element.querySelector(".app-update-status");
        this.appUpdateHandler = null;
        this.appUpdateButton.addEventListener("click", () => {
            this.appUpdateHandler?.();
        });
        this.cacheResetDialog = new LibraryCacheResetDialog(eventBus);
        this.element.append(this.cacheResetDialog.element);
    }

    attachViewStateControls(controls) {

        if (!controls?.resetButton || !controls?.status) return false;
        this.viewStateButton = controls.resetButton;
        this.viewStateButton.disabled = controls.element.hidden ||
            this.viewStateButton.disabled;
        controls.resetButton.textContent = "表示状態だけをリセット";
        controls.resetButton.setAttribute(
            "aria-describedby",
            "library-maintenance-view-status"
        );
        this.actions.prepend(controls.resetButton);
        this.viewStateStatus.replaceWith(controls.status);
        controls.status.id = "library-maintenance-view-status";
        controls.status.classList.add("library-maintenance-view-status");
        controls.element.remove();
        return true;
    }

    setCacheResetState(state) {

        const running = state === "running";

        if (running) {
            this.viewStateWasDisabled = Boolean(this.viewStateButton?.disabled);
        } else if (state === "success" && this.viewStateButton) {
            this.viewStateButton.disabled = true;
        } else if (this.viewStateButton) {
            this.viewStateButton.disabled = this.viewStateWasDisabled;
        }
        if (this.viewStateButton && running) this.viewStateButton.disabled = true;
        this.cacheResetButton.disabled = running;
        this.cacheResetStatus.textContent = running
            ? "Libraryキャッシュをリセット中…"
            : state === "failed"
                ? "Libraryキャッシュを完全にリセットできませんでした。"
                : state === "success"
                    ? "Libraryキャッシュをリセットしました。"
                    : "";
    }

    setAppUpdateHandler(handler) {

        this.appUpdateHandler = typeof handler === "function" ? handler : null;
        this.appUpdateButton.disabled = !this.appUpdateHandler;
        return true;
    }

    setAppUpdateState(state) {

        const running = state === "checking" || state === "updating" ||
            state === "reloading";
        const messages = {
            checking: "更新を確認中…",
            latest: "最新版です。",
            updating: "更新しています…",
            reloading: "再読み込みします…",
            local: "ローカル版は再読み込みで更新されます。",
            failed: "更新できませんでした。"
        };

        this.appUpdateButton.disabled = running || !this.appUpdateHandler;
        this.appUpdateStatus.textContent = messages[state] || "";
    }

    #create(documentTarget) {

        const section = documentTarget.createElement("section");

        section.className = "library-maintenance-panel";
        section.innerHTML = `
            <details class="library-maintenance-disclosure">
                <summary>Maintenance</summary>
                <div class="library-maintenance-content">
                    <div class="library-maintenance-actions">
                        <button class="app-update-action" type="button" disabled>
                            最新版に更新
                        </button>
                        <button class="library-cache-reset" type="button">
                            Libraryキャッシュをリセット
                        </button>
                    </div>
                    <p id="library-maintenance-view-status"
                        class="library-access-message library-maintenance-view-status"
                        role="status" aria-live="polite"></p>
                    <p class="library-access-message library-cache-reset-status"
                        role="status" aria-live="polite"></p>
                    <p class="library-access-message app-update-status"
                        role="status" aria-live="polite"></p>
                </div>
            </details>
        `;
        section.querySelector(".library-cache-reset").addEventListener(
            "click",
            event => this.cacheResetDialog.open(event.currentTarget)
        );
        return section;
    }
}
