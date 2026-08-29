import CurrentPositionService from "../services/CurrentPositionService.js";

const ERROR_MESSAGES = Object.freeze({
    1: "位置情報の利用が許可されていません。",
    2: "現在地を取得できません。",
    3: "現在地の取得がタイムアウトしました。"
});

/**
 * Coordinates session-only GPS state, Map presentation, and its control.
 */
export default class CurrentPositionController {

    constructor({
        mapView,
        eventBus,
        service = new CurrentPositionService(),
        windowObject = globalThis.window,
        portraitMedia = globalThis.matchMedia?.(
            "(max-width: 768px) and (orientation: portrait)"
        ) ?? null
    }) {

        this.mapView = mapView;
        this.eventBus = eventBus;
        this.service = service;
        this.windowObject = windowObject;
        this.portraitMedia = portraitMedia;
        this.following = false;
        this.lastPosition = null;
        this.element = this.#create();
        this.button = this.element.querySelector(".current-position-button");
        this.status = this.element.querySelector(".current-position-status");
        this.#bind();
        this.#showInitial();
    }

    attach(container) {

        container.append(this.element);
    }

    isFollowing() {

        return this.following;
    }

    isTracking() {

        return this.service.isTracking();
    }

    startFollowing() {

        if (!this.service.isSupported()) return false;

        if (!this.service.isTracking() || !this.following) {
            this.#handleButton();
        }

        return this.service.isTracking() && this.following;
    }

    stopFollowing() {

        if (!this.following) return false;
        this.following = false;
        if (this.lastPosition) this.#showPosition();
        return true;
    }

    stop() {

        const stopped = this.service.stop();
        this.following = false;
        return stopped;
    }

    #bind() {

        this.button.addEventListener("click", () => this.#handleButton());
        this.eventBus.on("map:user-drag-started", () => {
            if (!this.following) return;
            this.following = false;
            this.#showPosition();
        });
        this.windowObject?.addEventListener?.("pagehide", () => this.stop());
        this.windowObject?.addEventListener?.("beforeunload", () => this.stop());
    }

    #handleButton() {

        if (!this.service.isSupported()) return;

        if (!this.service.isTracking()) {
            this.following = true;
            this.#showAcquiring();
            try {
                this.service.start(
                    position => this.#handlePosition(position),
                    error => this.#handleError(error)
                );
            } catch {
                this.following = false;
                this.#showError("現在地の取得を開始できませんでした。");
            }
            return;
        }

        if (this.following) {
            this.following = false;
            this.#showPosition();
            return;
        }

        this.following = true;
        if (this.lastPosition) this.#follow(this.lastPosition);
        this.#showPosition();
    }

    #handlePosition(position) {

        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        if (
            !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180
        ) {
            this.#showError("現在地を取得できません。");
            return;
        }

        this.lastPosition = {
            latitude,
            longitude,
            accuracy: Number(position?.coords?.accuracy)
        };
        this.mapView.setCurrentPosition(this.lastPosition);
        if (this.following) this.#follow(this.lastPosition);
        this.#showPosition();
    }

    #follow(position) {

        this.mapView.followCurrentPosition(position, {
            verticalRatio: this.portraitMedia?.matches ? 0.625 : 0.5
        });
    }

    #handleError(error) {

        const code = Number(error?.code);

        if (code === 1) {
            this.service.stop();
            this.following = false;
        }

        this.#showError(
            ERROR_MESSAGES[code] || "現在地の取得中にエラーが発生しました。"
        );
    }

    #showInitial() {

        if (!this.service.isSupported()) {
            this.button.disabled = true;
            this.button.dataset.state = "unsupported";
            this.button.setAttribute("aria-pressed", "false");
            this.status.textContent = "このBrowserでは位置情報を利用できません。";
            return;
        }

        this.button.dataset.state = "idle";
        this.button.setAttribute("aria-pressed", "false");
        this.status.textContent = "現在地を表示";
    }

    #showAcquiring() {

        this.button.dataset.state = "acquiring";
        this.button.setAttribute("aria-pressed", "true");
        this.status.textContent = "GPS取得中…";
    }

    #showPosition() {

        this.button.dataset.state = "ready";
        this.button.setAttribute("aria-pressed", String(this.following));
        const accuracy = this.lastPosition?.accuracy;
        const accuracyText = Number.isFinite(accuracy) && accuracy >= 0
            ? ` ±${Math.round(accuracy)} m`
            : "";
        this.status.textContent = this.following
            ? `現在地を追従中${accuracyText}`
            : `現在地を表示中${accuracyText}`;
    }

    #showError(message) {

        this.button.dataset.state = "error";
        this.button.setAttribute("aria-pressed", String(this.following));
        this.status.textContent = message;
    }

    #create() {

        const control = document.createElement("div");

        control.className = "current-position-control";
        control.innerHTML = `
            <button class="current-position-button" type="button"
                aria-label="現在地を表示・追従" title="現在地を表示・追従"
                aria-describedby="current-position-status">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>
                    <circle cx="12" cy="12" r="9"></circle>
                </svg>
                <span>現在地</span>
            </button>
            <span id="current-position-status" class="current-position-status"
                role="status" aria-live="polite"></span>
        `;
        return control;
    }
}
