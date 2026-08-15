const PICKER_URL = "https://apis.google.com/js/api.js";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/** Opens a Google Picker restricted to one Drive folder. */
export default class DrivePickerService {

    constructor({
        apiKey = "",
        appId = "",
        browserWindow = globalThis.window,
        documentObject = globalThis.document
    } = {}) {

        this.apiKey = apiKey;
        this.appId = appId;
        this.browserWindow = browserWindow;
        this.documentObject = documentObject;
        this.scriptPromise = null;
    }

    isConfigured() {

        return typeof this.apiKey === "string" && this.apiKey.length > 0 &&
            typeof this.appId === "string" && this.appId.length > 0;
    }

    async pickFolder(accessToken) {

        if (!this.isConfigured()) {
            throw this.#error("not-configured", "Google Picker is not configured");
        }
        await this.#loadPicker();

        return new Promise((resolve, reject) => {
            const pickerApi = this.browserWindow.google.picker;
            const view = new pickerApi.DocsView(pickerApi.ViewId.FOLDERS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true)
                .setMimeTypes(FOLDER_MIME_TYPE);
            const picker = new pickerApi.PickerBuilder()
                .addView(view)
                .setOAuthToken(accessToken)
                .setDeveloperKey(this.apiKey)
                .setAppId(this.appId)
                .setCallback(data => {
                    console.info("[TrailBook Drive] Picker callback", {
                        action: data?.action || "unknown"
                    });
                    if (data.action === pickerApi.Action.CANCEL) {
                        resolve(null);
                        return;
                    }
                    if (data.action !== pickerApi.Action.PICKED) return;

                    const document = data.docs?.[0];

                    console.info("[TrailBook Drive] Picker selection", {
                        folderId: document?.id ? "present" : "missing",
                        folderName: document?.name || ""
                    });

                    if (!document?.id) {
                        reject(this.#error(
                            "folder-inaccessible",
                            "The selected Drive folder is unavailable"
                        ));
                        return;
                    }
                    resolve({ id: document.id, name: document.name || "Google Drive" });
                })
                .build();

            picker.setVisible(true);
        });
    }

    #loadPicker() {

        if (this.browserWindow?.google?.picker) return Promise.resolve();
        if (this.scriptPromise) return this.scriptPromise;

        this.scriptPromise = new Promise((resolve, reject) => {
            const finish = () => this.browserWindow.gapi.load("picker", {
                callback: resolve,
                onerror: () => reject(this.#error(
                    "network-error",
                    "Google Picker could not be loaded"
                ))
            });

            if (this.browserWindow?.gapi) {
                finish();
                return;
            }

            const script = this.documentObject.createElement("script");

            script.src = PICKER_URL;
            script.async = true;
            script.onload = finish;
            script.onerror = () => reject(this.#error(
                "network-error",
                "Google Picker could not be loaded"
            ));
            this.documentObject.head.append(script);
        });
        return this.scriptPromise;
    }

    #error(code, message) {

        const error = new Error(message);

        error.code = code;
        return error;
    }
}
