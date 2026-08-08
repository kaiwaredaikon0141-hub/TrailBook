/**
 * Desktop pointer and keyboard control for the workspace sidebar width.
 */
export default class SidebarResizeHandle {

    constructor(eventBus, {
        minWidth = 220,
        maxWidth = 520,
        defaultWidth = 260,
        keyboardStep = 16,
        isDesktop = () => (
            globalThis.matchMedia?.("(pointer: fine)").matches ?? true
        )
    } = {}) {

        this.eventBus = eventBus;
        this.minWidth = minWidth;
        this.maxWidth = maxWidth;
        this.defaultWidth = defaultWidth;
        this.keyboardStep = keyboardStep;
        this.isDesktop = isDesktop;
        this.workspace = null;
        this.sidebar = null;
        this.width = this.#clamp(defaultWidth);
        this.dragging = false;
        this.dragStartWidth = this.width;
        this.element = this.#create();
    }

    attach({ workspace, sidebar }) {

        this.workspace = workspace;
        this.sidebar = sidebar;
        sidebar.after(this.element);
        this.setWidth(this.width, { notifyLayout: false });
    }

    setWidth(width, { emit = false, notifyLayout = true } = {}) {

        const nextWidth = this.#clamp(width);
        const changed = nextWidth !== this.width;

        this.width = nextWidth;
        this.workspace?.style.setProperty(
            "--sidebar-width",
            `${nextWidth}px`
        );
        this.element.setAttribute("aria-valuenow", String(nextWidth));
        this.element.setAttribute("aria-valuetext", `${nextWidth} pixels`);

        if (changed && emit) {
            this.eventBus.emit("view-state:sidebar-width-changed", {
                width: nextWidth
            });
        }

        if (changed && notifyLayout) {
            this.eventBus.emit("view-state:sidebar-layout-changed");
        }

        return changed;
    }

    getWidth() {

        return this.width;
    }

    getDefaultWidth() {

        return this.defaultWidth;
    }

    setSidebarOpen(open) {

        const visible = Boolean(open) && this.isDesktop();

        this.element.hidden = !visible;

        return visible;
    }

    #create() {

        const handle = document.createElement("div");

        handle.className = "sidebar-resize-handle";
        handle.tabIndex = 0;
        handle.setAttribute("role", "separator");
        handle.setAttribute("aria-label", "サイドバーの幅を変更");
        handle.setAttribute("aria-orientation", "vertical");
        handle.setAttribute("aria-valuemin", String(this.minWidth));
        handle.setAttribute("aria-valuemax", String(this.maxWidth));
        handle.addEventListener("pointerdown", event => {
            this.#startDrag(event);
        });
        handle.addEventListener("pointermove", event => {
            this.#moveDrag(event);
        });
        handle.addEventListener("pointerup", event => {
            this.#finishDrag(event);
        });
        handle.addEventListener("pointercancel", event => {
            this.#finishDrag(event);
        });
        handle.addEventListener("lostpointercapture", event => {
            this.#finishDrag(event);
        });
        handle.addEventListener("keydown", event => {
            this.#handleKeyDown(event);
        });

        return handle;
    }

    #startDrag(event) {

        if (!this.isDesktop() || (event.button !== undefined && event.button !== 0)) {
            return;
        }

        event.preventDefault();
        this.dragging = true;
        this.dragStartWidth = this.width;
        try {
            this.element.setPointerCapture?.(event.pointerId);
        } catch {
            // Synthetic events and older browsers may not expose capture.
        }
        document.body.classList.add("is-sidebar-resizing");
    }

    #moveDrag(event) {

        if (!this.dragging) return;

        event.preventDefault();
        const left = this.workspace?.getBoundingClientRect().left ?? 0;

        this.setWidth(event.clientX - left, {
            emit: false,
            notifyLayout: false
        });
    }

    #finishDrag(event) {

        if (!this.dragging) return;

        event.preventDefault();
        this.dragging = false;
        document.body.classList.remove("is-sidebar-resizing");

        if (this.width !== this.dragStartWidth) {
            this.eventBus.emit("view-state:sidebar-width-changed", {
                width: this.width
            });
            this.eventBus.emit("view-state:sidebar-layout-changed");
        }
    }

    #handleKeyDown(event) {

        let width = null;

        if (event.key === "ArrowLeft") width = this.width - this.keyboardStep;
        if (event.key === "ArrowRight") width = this.width + this.keyboardStep;
        if (event.key === "Home") width = this.minWidth;
        if (event.key === "End") width = this.maxWidth;

        if (width === null) return;

        event.preventDefault();
        this.setWidth(width, { emit: true });
    }

    #clamp(width) {

        const numeric = Number.isFinite(width)
            ? width
            : (this.width ?? this.defaultWidth);

        return Math.round(Math.min(this.maxWidth, Math.max(this.minWidth, numeric)));
    }
}
