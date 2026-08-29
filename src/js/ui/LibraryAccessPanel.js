const PANEL_ID = "library-access-status";

/**
 * Presents persistent Library access guidance without blocking interaction.
 */
export default class LibraryAccessPanel {

    constructor() {

        this.element = this.#create();
        this.primaryContent = this.element.querySelector(
            ".library-access-primary"
        );
        this.previousLibraryButton = this.element.querySelector(
            ".previous-library-open"
        );
        this.previousLibraryStatus = this.element.querySelector(
            ".previous-library-status"
        );
        this.manualLibraryButtons = [
            ...this.element.querySelectorAll(".manual-library-open")
        ];
        this.libraryChange = this.element.querySelector(".library-change");
        this.libraryChangeContainer = this.element.querySelector(
            ".library-change-options"
        );
        this.libraryRefreshButton = this.element.querySelector(
            ".library-refresh-action"
        );
        this.libraryRefreshDiagnostic = this.element.querySelector(
            ".library-refresh-diagnostic"
        );
        this.libraryRefreshHydrationOutput = this.element.querySelector(
            ".library-refresh-hydration-source"
        );
        this.previousLibraryAction = null;
        this.manualLibraryAction = null;
        this.libraryRefreshAction = null;
        this.provisionalLibrary = false;
        this.libraryRefreshState = Object.freeze({
            permission: "unknown", hasHandle: false, libraryState: "none",
            canManualRefresh: false,
            cachedCount: null, scannedCount: null,
            addedCount: null, removedCount: null, modifiedCount: null,
            reason: "none", result: "idle"
        });
        this.previousLibraryButton.addEventListener("click", () => {
            this.previousLibraryAction?.();
        });
        this.manualLibraryButtons.forEach(button => {
            button.addEventListener("click", () => {
                this.manualLibraryAction?.();
            });
        });
        this.libraryRefreshButton.addEventListener("click", () => {
            this.libraryRefreshAction?.();
        });
        this.libraryChange.addEventListener("toggle", () => {
            this.#renderLibraryRefreshState();
        });
    }

    get descriptionId() {

        return PANEL_ID;
    }

    showInitial() {

        this.#show(
            "端末からライブラリを開く",
            "GPXを含むFolderを選択します。",
            "info",
            "manual"
        );
    }

    showInsecureContext() {

        this.#show(
            "安全な接続が必要です",
            "このページは安全な接続で開かれていません。HTTPS、" +
            "http://localhost、http://127.0.0.1で開いてください。" +
            "file://や通常のLAN内HTTP IPでは利用できません。",
            "error",
            "manual"
        );
    }

    showUnsupportedBrowser() {

        this.#show(
            "Folder選択を利用できません",
            "このbrowserではFolder選択APIを利用できません。" +
            "Windows版ChromeまたはEdge desktopを推奨します。" +
            "Mobileでは必要APIが利用できる端末だけ実機試験できます。" +
            "代替のFolder選択方式はRelease 1.0では実装していません。",
            "error",
            "manual"
        );
    }

    showUnverifiedMobile() {

        this.#show(
            "未検証のMobile環境です",
            "Folder選択APIを利用できるため実機試験を続行できます。" +
            "この端末は正式対応環境ではなく、合格するまでbest effort対応にも含めません。",
            "info",
            "manual"
        );
    }

    showLoading(folderName) {

        this.#show(
            "ライブラリを読み込み中",
            `${folderName}を確認しています。`,
            "info",
            "none"
        );
    }

    showPreviousLibrary(folderName, permission = "prompt") {

        if (this.provisionalLibrary) {
            this.hide();
            return;
        }

        const denied = permission === "denied";
        const granted = permission === "granted";

        this.#show(
            "前回のライブラリがあります",
            denied
                ? `${folderName}へのアクセスは許可されていません。` +
                    "明示的に開き直すか、通常のLibraryを選択できます。"
                : granted
                    ? `${folderName}を開けます。`
                    : `${folderName}を開くにはアクセスの確認が必要です。`,
            denied ? "error" : "info",
            denied ? "manual" : "previous"
        );
        if (!denied) {
            this.previousLibraryButton.setAttribute(
                "aria-label",
                `前回のライブラリ ${folderName} を開く`
            );
        }
    }

    setPreviousLibraryAction(action) {

        this.previousLibraryAction = action;
    }

    setManualLibraryAction(action) {

        this.manualLibraryAction = action;
    }

    setLibraryRefreshAction(action) {

        this.libraryRefreshAction = action;
        this.#renderLibraryRefreshState();
    }

    setLibraryRefreshState(state = {}) {

        this.libraryRefreshState = state;
        this.#renderLibraryRefreshState();
    }

    setLibraryRefreshHydrationDiagnostic(diagnostic) {

        const value = candidate => candidate ?? "-";
        const yesNo = candidate => candidate === null || candidate === undefined
            ? "-"
            : candidate ? "yes" : "no";
        const text = [
            "Previous Refresh Context",
            `getter called: ${yesNo(diagnostic.previous.getterCalled)}`,
            `initialized: ${yesNo(diagnostic.previous.initialized)}`,
            `initialization stage: ${value(diagnostic.previous.initializationStage)}`,
            `hasHandle: ${yesNo(diagnostic.previous.hasHandle)}`,
            `permission: ${value(diagnostic.previous.permission)}`,
            `handle type: ${value(diagnostic.previous.handleType)}`,
            `status: ${value(diagnostic.previous.status)}`,
            "",
            "Snapshot Refresh Context",
            `getter called: ${yesNo(diagnostic.snapshot.getterCalled)}`,
            `provisional: ${yesNo(diagnostic.snapshot.provisional)}`,
            `cachedCount: ${value(diagnostic.snapshot.cachedCount)}`,
            `libraryIdentity: ${value(diagnostic.snapshot.libraryIdentity)}`,
            "",
            "Coordinator Hydration",
            `runtime module: ${diagnostic.coordinator.runtimeBuildId}`,
            `hydrate called count: ${diagnostic.coordinator.hydrateCallCount}`,
            `last hydrate reason: ${diagnostic.coordinator.reason}`,
            `resulting permission: ${diagnostic.coordinator.permission}`,
            `resulting hasHandle: ${yesNo(diagnostic.coordinator.hasHandle)}`,
            `resulting libraryState: ${diagnostic.coordinator.libraryState}`,
            `resulting cachedCount: ${value(diagnostic.coordinator.cachedCount)}`
        ].join("\n");

        if (this.libraryRefreshHydrationOutput.textContent !== text) {
            this.libraryRefreshHydrationOutput.textContent = text;
        }
    }

    setFolderPickerState({ disabled, descriptionId, disabledReason = "" }) {

        this.manualLibraryButtons.forEach(button => {
            button.disabled = disabled;
            if (descriptionId) {
                button.setAttribute("aria-describedby", descriptionId);
            }
            button.title = disabled ? disabledReason : "";
        });
    }

    setPreviousLibraryStatus(status) {

        const allowed = new Set([
            "saved / granted",
            "saved / prompt",
            "saved / denied",
            "no persistent handle",
            "invalid",
            "unsupported"
        ]);
        const normalized = allowed.has(status)
            ? status
            : "no persistent handle";

        this.previousLibraryStatus.textContent =
            `Previous Library: ${normalized}`;
    }

    setProvisionalLibrary(active) {

        this.provisionalLibrary = Boolean(active);
        if (this.provisionalLibrary) this.hide();
    }

    showPermissionFailure() {

        this.#show(
            "Folderを開けませんでした",
            "Folderへのアクセスを許可して、もう一度" +
            "「端末からライブラリを開く」を押してください。" +
            "現在のLibraryがある場合、その内容は維持されています。",
            "error",
            "manual"
        );
    }

    showLoadFailure() {

        this.#show(
            "ライブラリを開けませんでした",
            "Folderを読み取れませんでした。内容とアクセス権を確認して、もう一度お試しください。" +
            "現在のLibraryがある場合、その内容は維持されています。",
            "error",
            "manual"
        );
    }

    showEmpty(libraryName) {

        const provisional = this.provisionalLibrary;
        this.provisionalLibrary = false;
        this.#show(
            `${libraryName}: GPX 0件`,
            "このFolderにはGPXファイルがありません。別のLibraryへ切り替えることができます。",
            "info",
            "manual"
        );
        this.provisionalLibrary = provisional;
    }

    hide() {

        this.element.classList.add("is-compact");
        this.primaryContent.hidden = true;
        this.previousLibraryButton.hidden = true;
        this.element.querySelector(".manual-library-primary").hidden = true;
        this.element.querySelector(".manual-library-secondary").hidden = false;
        this.libraryChange.hidden = false;
        this.libraryChange.open = false;
        this.element.hidden = false;
    }

    #create() {

        const section = document.createElement("section");

        section.id = PANEL_ID;
        section.className = "library-access-panel";
        section.setAttribute("role", "status");
        section.setAttribute("aria-live", "polite");
        section.setAttribute("aria-atomic", "true");
        section.innerHTML = `
            <div class="library-access-primary">
                <h4 class="library-access-title"></h4>
                <p class="library-access-message"></p>
                <button class="previous-library-open" type="button" hidden>
                    前回のライブラリを開く
                </button>
                <button class="manual-library-open manual-library-primary"
                    type="button" hidden>
                    端末からライブラリを開く
                </button>
            </div>
            <details class="library-change" hidden>
                <summary>ライブラリを変更</summary>
                <div class="library-change-options">
                    <button class="manual-library-open manual-library-secondary"
                        type="button">
                        端末からライブラリを開く
                    </button>
                    <p class="library-device-description">
                        端末・Files・Google Driveなど
                    </p>
                    <button class="library-refresh-action" type="button" hidden>
                        更新を確認
                    </button>
                </div>
            </details>
            <small class="previous-library-status">
                Previous Library: no persistent handle
            </small>
            <details class="fast-restore-diagnostic library-refresh-diagnostic" open>
                <summary>Library Refresh</summary>
                <pre></pre>
                <pre class="library-refresh-hydration-source"></pre>
            </details>
        `;

        return section;
    }

    #show(title, message, state = "info", action = "none") {

        if (this.provisionalLibrary) {
            this.hide();
            return;
        }

        this.element.classList.remove("is-compact");
        this.primaryContent.hidden = false;
        this.previousLibraryButton.hidden = action !== "previous";
        this.element.querySelector(".manual-library-primary").hidden =
            action !== "manual";
        const canChangeLibrary = ["manual", "previous"].includes(action);

        this.element.querySelector(".manual-library-secondary").hidden =
            !canChangeLibrary;
        this.libraryChange.hidden = !canChangeLibrary;
        this.libraryChange.open = false;
        this.element.dataset.state = state;
        this.element.querySelector(".library-access-title").textContent = title;
        this.element.querySelector(".library-access-message").textContent = message;
        this.element.hidden = false;
    }

    #renderLibraryRefreshState() {

        const state = this.libraryRefreshState;

        this.libraryRefreshButton.hidden =
            state.canManualRefresh !== true;
        const output = this.libraryRefreshDiagnostic?.querySelector("pre");

        if (!output) return;
        const value = key => state[key] ?? "-";
        const text = [
            `permission: ${value("permission")}`,
            `handle: ${state.hasHandle ? "yes" : "no"}`,
            `cached: ${value("cachedCount")}`,
            `scanned: ${value("scannedCount")}`,
            `added: ${value("addedCount")}`,
            `removed: ${value("removedCount")}`,
            `modified: ${value("modifiedCount")}`,
            `reason: ${value("reason")}`,
            `result: ${value("result")}`,
            `library: ${value("libraryState")}`,
            `manual refresh: ${state.canManualRefresh ? "yes" : "no"}`
        ].join("\n");

        if (output.textContent !== text) output.textContent = text;
    }
}
