/**
 * Desktop pointer and keyboard control for the Track list / Track Info split.
 */
export default class TrackInfoResizeHandle {

    constructor(eventBus, {
        minHeight = 120,
        maxHeight = 420,
        defaultHeight = 220,
        minListHeight = 100,
        keyboardStep = 16,
        isDesktop = () => (
            globalThis.matchMedia?.("(pointer: fine)").matches ?? true
        )
    } = {}) {

        this.eventBus = eventBus;
        this.minHeight = minHeight;
        this.maxHeight = maxHeight;
        this.defaultHeight = defaultHeight;
        this.minListHeight = minListHeight;
        this.keyboardStep = keyboardStep;
        this.isDesktop = isDesktop;
        this.shell = null;
        this.trackList = null;
        this.trackInfo = null;
        this.height = this.#clamp(defaultHeight);
        this.dragging = false;
        this.dragStartHeight = this.height;
        this.element = this.#create();
    }

    attach({ shell, trackList, trackInfo }) {

        this.shell = shell;
        this.trackList = trackList;
        this.trackInfo = trackInfo;
        trackList.after(this.element);
        this.setHeight(this.height);
        const available = this.isDesktop();

        this.element.hidden = !available;
        shell.classList.toggle("is-track-info-resize-unavailable", !available);
    }

    setHeight(height, { emit = false } = {}) {

        const nextHeight = this.#clamp(height);
        const changed = nextHeight !== this.height;

        this.height = nextHeight;
        this.shell?.style.setProperty("--track-info-height", `${nextHeight}px`);
        this.element.setAttribute("aria-valuenow", String(nextHeight));
        this.element.setAttribute("aria-valuemax", String(this.#currentMax()));
        this.element.setAttribute("aria-valuetext", `${nextHeight} pixels`);

        if (changed && emit) {
            this.eventBus.emit("view-state:track-info-height-changed", {
                height: nextHeight
            });
        }

        return changed;
    }

    getHeight() {

        return this.height;
    }

    getDefaultHeight() {

        return this.defaultHeight;
    }

    #create() {

        const handle = document.createElement("div");

        handle.className = "track-info-resize-handle";
        handle.tabIndex = 0;
        handle.setAttribute("role", "separator");
        handle.setAttribute("aria-label", "Track listとTrack Infoの高さを変更");
        handle.setAttribute("aria-orientation", "horizontal");
        handle.setAttribute("aria-valuemin", String(this.minHeight));
        handle.addEventListener("pointerdown", event => this.#startDrag(event));
        handle.addEventListener("pointermove", event => this.#moveDrag(event));
        handle.addEventListener("pointerup", event => this.#finishDrag(event));
        handle.addEventListener("pointercancel", event => this.#finishDrag(event));
        handle.addEventListener("lostpointercapture", event => this.#finishDrag(event));
        handle.addEventListener("keydown", event => this.#handleKeyDown(event));

        return handle;
    }

    #startDrag(event) {

        if (!this.isDesktop() || (event.button !== undefined && event.button !== 0)) {
            return;
        }

        event.preventDefault();
        this.dragging = true;
        this.dragStartHeight = this.height;
        try {
            this.element.setPointerCapture?.(event.pointerId);
        } catch {
            // Synthetic events and older browsers may not expose capture.
        }
        document.body.classList.add("is-track-info-resizing");
    }

    #moveDrag(event) {

        if (!this.dragging) return;

        event.preventDefault();
        const bottom = this.shell?.getBoundingClientRect().bottom ?? 0;

        this.setHeight(bottom - event.clientY);
    }

    #finishDrag(event) {

        if (!this.dragging) return;

        event.preventDefault();
        this.dragging = false;
        document.body.classList.remove("is-track-info-resizing");

        if (this.height !== this.dragStartHeight) {
            this.eventBus.emit("view-state:track-info-height-changed", {
                height: this.height
            });
        }
    }

    #handleKeyDown(event) {

        let height = null;

        if (event.key === "ArrowUp") height = this.height + this.keyboardStep;
        if (event.key === "ArrowDown") height = this.height - this.keyboardStep;
        if (event.key === "Home") height = this.minHeight;
        if (event.key === "End") height = this.#currentMax();

        if (height === null) return;

        event.preventDefault();
        this.setHeight(height, { emit: true });
    }

    #currentMax() {

        const shellHeight = this.shell?.getBoundingClientRect().height ?? 0;
        const controlsHeight = this.shell?.querySelector(
            ".sidebar-fixed-controls"
        )?.getBoundingClientRect().height ?? 0;
        const available = Math.floor(
            shellHeight - controlsHeight - this.minListHeight - 6
        );

        if (shellHeight <= 0 || available < this.minHeight) {
            return this.maxHeight;
        }

        return Math.max(
            this.minHeight,
            Math.min(this.maxHeight, available)
        );
    }

    #clamp(height) {

        const numeric = Number.isFinite(height)
            ? height
            : (this.height ?? this.defaultHeight);

        return Math.round(Math.min(
            this.#currentMax(),
            Math.max(this.minHeight, numeric)
        ));
    }
}
