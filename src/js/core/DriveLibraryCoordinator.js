import DriveAuthService from "../services/DriveAuthService.js";
import DrivePickerService from "../services/DrivePickerService.js";
import DriveLibraryService from "../services/DriveLibraryService.js";
import drivePerformance from "../services/DrivePerformanceMonitor.js";
import mobileDriveDiagnostic from "../ui/MobileDriveDiagnosticPanel.js";

const STORAGE_KEY = "trailbook.driveLibrary";

/** Coordinates explicit Google Drive authorization, picking, and Library load. */
export default class DriveLibraryCoordinator {

    constructor({
        config = {}, auth = null, picker = null, libraryService = null,
        storage = globalThis.localStorage, canSwitchLibrary = () => true,
        flushViewState = () => {}, beforeLoad = () => {}, applyLibrary,
        getCurrentLibrary = () => null, setReadOnlyPresentation = () => {}
    } = {}) {

        this.config = config;
        this.storage = storage;
        this.canSwitchLibrary = canSwitchLibrary;
        this.flushViewState = flushViewState;
        this.beforeLoad = beforeLoad;
        this.applyLibrary = applyLibrary;
        this.getCurrentLibrary = getCurrentLibrary;
        this.setReadOnlyPresentation = setReadOnlyPresentation;
        this.auth = auth || new DriveAuthService({ clientId: config.clientId });
        this.picker = picker || new DrivePickerService({
            apiKey: config.apiKey,
            appId: config.appId
        });
        this.libraryService = libraryService || new DriveLibraryService({
            apiKey: config.apiKey,
            getAccessToken: () => this.auth.getAccessToken(),
            onAuthorizationInvalid: () => {
                this.auth.clear();
                this.#showError("Google Driveの認証期限が切れました。再接続してください。");
            }
        });
        this.requestId = 0;
        this.busy = false;
        this.previousRoot = this.#loadPreviousRoot();
        this.element = this.#create();
        this.button = this.element.querySelector(".drive-library-open");
        this.status = this.element.querySelector(".drive-library-status");
        this.button.addEventListener("click", () => void (
            this.isReadOnlyActive() ? this.chooseAnother() : this.open()
        ));
        this.#renderAvailability();
    }

    attach(parent) { parent?.append(this.element); }

    isReadOnlyActive() {
        return this.getCurrentLibrary()?.sourceType === "google-drive";
    }

    async open() {

        if (this.busy || !this.#isConfigured() || !this.canSwitchLibrary()) {
            return false;
        }

        this.busy = true;
        this.button.disabled = true;
        mobileDriveDiagnostic.beginAttempt();
        this.#showStatus("Google Driveへ接続しています…");
        const requestId = ++this.requestId;
        const isCurrent = () => requestId === this.requestId;

        this.diagnosticStep = "authorization";

        try {
            await this.auth.authorize();
            mobileDriveDiagnostic.recordAuth(true);
            console.info("[TrailBook Drive] Authorization completed");
            this.diagnosticStep = "picker";
            const root = this.previousRoot || await this.picker.pickFolder(
                this.auth.getAccessToken()
            );
            mobileDriveDiagnostic.recordPicker(Boolean(root));

            console.info("[TrailBook Drive] Folder received by coordinator", {
                folderId: root?.id ? "present" : "missing",
                folderName: root?.name || ""
            });

            if (!root || requestId !== this.requestId) {
                this.#showStatus("Google Drive Folderの選択をキャンセルしました。");
                return false;
            }

            this.#showStatus(`${root.name} を確認しています…`);
            this.diagnosticStep = "drive-scan";
            const performanceSessionId = drivePerformance.start({
                restoreOwner: isCurrent
            });
            drivePerformance.recordComponentCall("DriveLibraryCoordinator");
            console.info("[TrailBook Drive] Drive scan starting", {
                folderId: root.id ? "present" : "missing",
                folderName: root.name || ""
            });
            const library = await this.libraryService.scan(root);

            if (requestId !== this.requestId) return false;
            await this.flushViewState();
            this.beforeLoad();
            mobileDriveDiagnostic.recordLibraryApplyStarted();
            this.diagnosticStep = "library-apply";
            const applied = await this.applyLibrary(library, {
                generation: requestId,
                isCurrent,
                cacheNamespace: `drive:${root.id}`
            });

            if (!applied) return false;
            drivePerformance.markInitialRestoreStarted(performanceSessionId);
            this.previousRoot = { id: root.id, name: root.name };
            this.#savePreviousRoot(this.previousRoot);
            this.setReadOnlyPresentation(true);
            this.button.textContent = "別のGoogle Drive Libraryを開く";
            this.#showStatus(`${root.name}（Google Drive・読み取り専用）`);
            return true;
        } catch (error) {
            drivePerformance.cancel();
            mobileDriveDiagnostic.recordError(
                this.diagnosticStep || "unknown",
                error
            );
            const diagnostic = {
                step: this.diagnosticStep || "unknown",
                name: error?.name || "Error",
                code: error?.code || "unknown",
                message: error?.message || "Unknown error",
                httpStatus: error?.httpStatus || null,
                apiErrorCode: error?.apiErrorCode || null,
                apiErrorMessage: error?.apiErrorMessage || null
            };

            console.error("[TrailBook Drive] Connection failed", diagnostic);
            this.#showError(
                `${this.#messageForError(error)} ` +
                `(${diagnostic.step}: ${diagnostic.name} - ${diagnostic.message})`
            );
            return false;
        } finally {
            this.busy = false;
            this.button.disabled = !this.#isConfigured();
        }
    }

    chooseAnother() {
        this.previousRoot = null;
        return this.open();
    }

    #isConfigured() {
        return this.auth.isConfigured() && this.picker.isConfigured();
    }

    #create() {

        const section = document.createElement("section");

        section.className = "drive-library-control";
        section.innerHTML = `
            <button class="drive-library-open" type="button">
                Google Driveから開く
            </button>
            <p class="drive-library-status" role="status"
                aria-live="polite" aria-atomic="true"></p>
        `;
        return section;
    }

    #renderAvailability() {

        if (!this.#isConfigured()) {
            const missing = [
                [this.config.clientId, "OAuth Client ID"],
                [this.config.apiKey, "API Key"],
                [this.config.appId, "Picker App ID"]
            ].filter(([value]) => !value).map(([, label]) => label);

            this.button.disabled = true;
            this.button.title = "Google Driveのruntime設定が不足しています";
            this.#showError(
                `Google Drive設定が不足しています: ${missing.join("、") || "runtime config"}。` +
                "Local Libraryは通常どおり利用できます。"
            );
            console.warn("Google Drive integration is not configured.");
            return;
        }
        if (this.previousRoot) {
            this.button.textContent = "Google Drive Libraryを再接続";
            this.#showStatus(`${this.previousRoot.name} への再接続には認証が必要です。`);
        }
    }

    #showStatus(message) {
        this.element.dataset.state = "info";
        this.status.textContent = message;
    }

    #showError(message) {
        this.element.dataset.state = "error";
        this.status.textContent = message;
    }

    #messageForError(error) {

        const messages = {
            "oauth-cancelled": "Google認証をキャンセルしました。Libraryは変更していません。",
            "oauth-denied": "Google Driveへのアクセスが許可されませんでした。",
            "api-unauthorized": "Google Driveの認証期限が切れました。再接続してください。",
            "token-expired": "Google Driveの認証がありません。再接続してください。",
            "network-error": "Google Driveへ接続できませんでした。Viewerは引き続き利用できます。",
            "folder-inaccessible": "選択したGoogle Drive Folderを読み取れません。",
            "not-configured": "Google Drive設定がありません。"
        };

        return messages[error?.code] || "Google Drive Libraryを開けませんでした。";
    }

    #loadPreviousRoot() {

        try {
            const value = JSON.parse(this.storage?.getItem(STORAGE_KEY) || "null");

            return typeof value?.id === "string" && typeof value?.name === "string"
                ? { id: value.id, name: value.name }
                : null;
        } catch { return null; }
    }

    #savePreviousRoot(root) {

        try {
            this.storage?.setItem(STORAGE_KEY, JSON.stringify(root));
        } catch {
            // Optional device-local preference; the active Library remains usable.
        }
    }
}
