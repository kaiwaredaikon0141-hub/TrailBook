function distance(left, right) {
    const radians = value => value * Math.PI / 180;
    const latitude = radians(right.latitude - left.latitude);
    const longitude = radians(right.longitude - left.longitude);
    const a = Math.sin(latitude / 2) ** 2 +
        Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) *
        Math.sin(longitude / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Current GPS -> replaceable ground-elevation provider -> presentation.
 * No Library, GPX, package, or persistent-location ownership.
 */
export default class CurrentElevationController {
    constructor({
        provider, view, minIntervalMs = 30000, reuseDistanceMeters = 25,
        now = () => Date.now(), documentObject = globalThis.document,
        windowObject = globalThis.window
    }) {
        this.provider = provider;
        this.view = view;
        this.minIntervalMs = minIntervalMs;
        this.reuseDistanceMeters = reuseDistanceMeters;
        this.now = now;
        this.documentObject = documentObject;
        this.windowObject = windowObject;
        this.latest = null;
        this.cached = null;
        this.job = null;
        this.lastAttempt = -Infinity;
        this.detached = false;
        this.paused = documentObject.visibilityState === "hidden";
        this.handleVisibility = () => {
            this.paused = documentObject.visibilityState === "hidden";
            if (this.paused) {
                this.#cancelJob();
                if (this.latest) this.view.showCurrentElevation(null, "画面非表示のため取得を停止中");
            } else this.#schedule();
        };
        this.handlePageHide = () => this.clear();
        documentObject.addEventListener("visibilitychange", this.handleVisibility);
        windowObject.addEventListener("pagehide", this.handlePageHide);
    }

    update(position) {
        if (this.detached) return;
        const { latitude, longitude, accuracy } = position ?? {};
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
            !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50) {
            this.latest = null;
            this.#cancelJob();
            this.view.showCurrentElevation(null, "現在地の位置精度が不足しています（目安50 m以内）");
            return;
        }
        this.latest = { latitude, longitude, accuracy };
        this.#schedule();
    }

    clear() {
        this.latest = null;
        this.cached = null;
        this.#cancelJob();
        this.view.hideCurrentElevation();
    }

    detach() {
        this.detached = true;
        this.clear();
        this.documentObject.removeEventListener("visibilitychange", this.handleVisibility);
        this.windowObject.removeEventListener("pagehide", this.handlePageHide);
    }

    #cancelJob() {
        clearTimeout(this.timer);
        const job = this.job;
        this.job = null;
        job?.abort.abort();
    }

    #schedule() {
        clearTimeout(this.timer);
        if (!this.latest || this.paused) return;
        if (this.cached && distance(this.latest, this.cached.position) <= this.reuseDistanceMeters) {
            this.view.showCurrentElevation(this.cached.result);
            return;
        }
        this.view.showCurrentElevation(null, "国土地理院の地表標高を取得中");
        if (this.job) return;
        const remaining = this.minIntervalMs - (this.now() - this.lastAttempt);
        if (remaining > 0) {
            this.timer = setTimeout(() => this.#schedule(), remaining);
            return;
        }
        const job = { position: this.latest, abort: new AbortController() };
        this.job = job;
        this.lastAttempt = this.now();
        void this.#lookup(job);
    }

    async #lookup(job) {
        try {
            const result = await this.provider.lookup(job.position, { signal: job.abort.signal });
            if (this.job !== job || !this.latest || this.paused) return;
            if (!Number.isFinite(result?.meters)) throw new Error("Invalid ground elevation");
            this.cached = { position: job.position, result };
            this.job = null;
            this.#schedule();
        } catch {
            if (this.job !== job) return;
            this.job = null;
            this.view.showCurrentElevation(null, "標高を取得できません（通信・データ提供範囲を確認してください）");
            // Retry only on a later GPS update, and still respect the interval.
        }
    }
}
