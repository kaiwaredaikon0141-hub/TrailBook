/** Owns one session-only Screen Wake Lock request. */
export default class ScreenWakeLockService {

    constructor({
        wakeLock = globalThis.navigator?.wakeLock,
        documentObject = globalThis.document
    } = {}) {

        this.wakeLock = wakeLock;
        this.documentObject = documentObject;
        this.sentinel = null;
        this.requested = false;
        this.status = this.isSupported() ? "idle" : "unsupported";
        this.visibilityHandler = () => void this.#handleVisibility();
        this.documentObject?.addEventListener?.(
            "visibilitychange",
            this.visibilityHandler
        );
    }

    isSupported() {

        return typeof this.wakeLock?.request === "function";
    }

    isActive() {

        return Boolean(this.sentinel && !this.sentinel.released);
    }

    getStatus() {

        return this.status;
    }

    async request() {

        this.requested = true;

        if (!this.isSupported()) {
            this.status = "unsupported";
            return false;
        }

        if (this.isActive()) return true;

        try {
            const sentinel = await this.wakeLock.request("screen");

            if (!this.requested) {
                await sentinel.release?.();
                return false;
            }

            this.sentinel = sentinel;
            this.status = "active";
            sentinel.addEventListener?.("release", () => {
                if (this.sentinel === sentinel) {
                    this.sentinel = null;
                    this.status = this.requested ? "released" : "idle";
                }
            });
            return true;
        } catch {
            this.sentinel = null;
            this.status = "error";
            return false;
        }
    }

    async release() {

        this.requested = false;
        const sentinel = this.sentinel;

        this.sentinel = null;
        this.status = this.isSupported() ? "idle" : "unsupported";

        if (!sentinel || sentinel.released) return false;

        try {
            await sentinel.release();
            return true;
        } catch {
            return false;
        }
    }

    destroy() {

        this.documentObject?.removeEventListener?.(
            "visibilitychange",
            this.visibilityHandler
        );
        return this.release();
    }

    async #handleVisibility() {

        if (
            this.requested &&
            this.documentObject?.visibilityState === "visible" &&
            !this.isActive()
        ) {
            await this.request();
        }
    }
}
