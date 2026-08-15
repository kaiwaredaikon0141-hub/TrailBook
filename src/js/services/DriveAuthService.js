export const DRIVE_READONLY_SCOPE =
    "https://www.googleapis.com/auth/drive.readonly";

const GIS_URL = "https://accounts.google.com/gsi/client";

/** Keeps a Google OAuth access token in session memory only. */
export default class DriveAuthService {

    constructor({
        clientId = "",
        scope = DRIVE_READONLY_SCOPE,
        browserWindow = globalThis.window,
        documentObject = globalThis.document
    } = {}) {

        this.clientId = clientId;
        this.scope = scope;
        this.browserWindow = browserWindow;
        this.documentObject = documentObject;
        this.accessToken = null;
        this.expiresAt = 0;
        this.scriptPromise = null;
    }

    isConfigured() {

        return typeof this.clientId === "string" && this.clientId.length > 0;
    }

    hasValidToken() {

        return Boolean(this.accessToken) && Date.now() < this.expiresAt;
    }

    getAccessToken() {

        return this.hasValidToken() ? this.accessToken : null;
    }

    clear() {

        this.accessToken = null;
        this.expiresAt = 0;
    }

    async authorize() {

        if (!this.isConfigured()) {
            throw this.#error("not-configured", "Google Drive is not configured");
        }
        if (this.hasValidToken()) return this.accessToken;

        await this.#loadScript();

        return new Promise((resolve, reject) => {
            const tokenClient = this.browserWindow.google.accounts.oauth2
                .initTokenClient({
                    client_id: this.clientId,
                    scope: this.scope,
                    callback: response => {
                        if (response?.error || !response?.access_token) {
                            reject(this.#error(
                                response?.error === "access_denied"
                                    ? "oauth-denied"
                                    : "oauth-cancelled",
                                "Google authorization was not completed"
                            ));
                            return;
                        }

                        this.accessToken = response.access_token;
                        const lifetime = Number(response.expires_in);
                        this.expiresAt = Date.now() +
                            (Number.isFinite(lifetime) ? lifetime * 1000 : 0);
                        resolve(this.accessToken);
                    },
                    error_callback: () => reject(this.#error(
                        "oauth-cancelled",
                        "Google authorization was cancelled"
                    ))
                });

            tokenClient.requestAccessToken({ prompt: "consent" });
        });
    }

    #loadScript() {

        if (this.browserWindow?.google?.accounts?.oauth2) {
            return Promise.resolve();
        }
        if (this.scriptPromise) return this.scriptPromise;

        this.scriptPromise = new Promise((resolve, reject) => {
            const script = this.documentObject.createElement("script");

            script.src = GIS_URL;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(this.#error(
                "network-error",
                "Google Identity Services could not be loaded"
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
