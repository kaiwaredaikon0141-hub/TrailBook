import ScreenWakeLockService from "../services/ScreenWakeLockService.js";

const MOBILE_QUERY = "(max-width: 768px)";

/** Coordinates session-only Mobile driving presentation, GPS Follow and Wake Lock. */
export default class DrivingModeController {

    constructor({
        currentPosition,
        eventBus,
        viewStateControls,
        workspace,
        trackInfoElement = null,
        wakeLock = new ScreenWakeLockService(),
        mobileMedia = globalThis.matchMedia?.(MOBILE_QUERY) ?? null
    }) {

        this.currentPosition = currentPosition;
        this.eventBus = eventBus;
        this.viewStateControls = viewStateControls;
        this.workspace = workspace;
        this.trackInfoElement = trackInfoElement;
        this.wakeLock = wakeLock;
        this.mobileMedia = mobileMedia;
        this.active = false;
        this.element = this.#create();
        this.button = this.element.querySelector(".driving-mode-button");
        this.label = this.element.querySelector(".driving-mode-label");
        this.status = this.element.querySelector(".driving-mode-status");
        this.button.addEventListener("click", () => void this.toggle());
        this.currentPosition.button?.addEventListener(
            "click",
            () => this.#render()
        );
        this.eventBus.on("map:user-drag-started", () => this.#render());
        this.mobileMedia?.addEventListener?.("change", () => this.#render());
        this.#render();
    }

    attach(container) {

        container.append(this.element);
    }

    isActive() {

        return this.active;
    }

    async toggle() {

        return this.active ? this.disable() : this.enable();
    }

    async enable() {

        if (!this.mobileMedia?.matches || this.active) return false;

        this.active = true;
        this.workspace.classList.add("is-driving-mode");
        globalThis.document?.body?.classList.add("is-driving-mode");
        this.viewStateControls.setSidebarOpen(false, {
            allowMobileOpen: true
        });
        this.trackInfoElement?.classList.add("is-mobile-dismissed");
        this.currentPosition.startFollowing();
        this.#render();
        await this.wakeLock.request();
        this.#render();
        return true;
    }

    async disable() {

        if (!this.active) return false;

        this.active = false;
        this.currentPosition.stopFollowing();
        this.workspace.classList.remove("is-driving-mode");
        globalThis.document?.body?.classList.remove("is-driving-mode");
        await this.wakeLock.release();
        this.#render();
        return true;
    }

    #render() {

        this.element.hidden = !this.mobileMedia?.matches;
        this.button.setAttribute("aria-pressed", String(this.active));
        this.label.textContent = this.active ? "走行中終了" : "走行中";
        const label = this.active ? "走行中モードを終了" : "走行中モードを開始";
        this.button.setAttribute("aria-label", label);
        this.button.title = label;

        if (!this.active) {
            this.status.textContent = "";
            return;
        }

        const follow = this.currentPosition.isFollowing()
            ? "GPS追従中"
            : "GPS追従OFF";
        const wake = this.wakeLock.isActive()
            ? "画面保持中"
            : "画面保持不可";

        this.status.textContent = `${follow}・${wake}`;
    }

    #create() {

        const control = document.createElement("div");

        control.className = "driving-mode-control";
        control.innerHTML = `
            <button class="driving-mode-button" type="button"
                aria-pressed="false" aria-label="走行中モードを開始"
                title="走行中モードを開始" aria-describedby="driving-mode-status">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M8 3h8l2 18H6L8 3z"></path>
                    <path d="M12 5v4M12 13v4"></path>
                </svg>
                <span class="driving-mode-label">走行中</span>
            </button>
            <span id="driving-mode-status" class="driving-mode-status"
                role="status" aria-live="polite"></span>
        `;
        return control;
    }
}
