import SidebarResizeHandle from "./SidebarResizeHandle.js";
import TrackInfoResizeHandle from "./TrackInfoResizeHandle.js";

const SIDEBAR_ID = "trailbook-sidebar";
const STATUS_ID = "view-state-status";

/**
 * Presents device-local view-state controls without owning persistence.
 */
export default class ViewStateControls {

    constructor(eventBus, {
        confirmAction = message => globalThis.confirm?.(message) ?? false,
        requestFrame = callback => (
            globalThis.requestAnimationFrame?.(callback) ??
            globalThis.setTimeout(callback, 0)
        ),
        sidebarDefaultWidth = 260,
        sidebarMinWidth = 220,
        sidebarMaxWidth = 520,
        sidebarKeyboardStep = 16,
        trackInfoDefaultHeight = 220,
        trackInfoMinHeight = 120,
        trackInfoMaxHeight = 420,
        trackListMinHeight = 100,
        trackInfoKeyboardStep = 16,
        isDesktop
    } = {}) {

        this.eventBus = eventBus;
        this.confirmAction = confirmAction;
        this.requestFrame = requestFrame;
        this.workspace = null;
        this.sidebar = null;
        this.toolbar = null;
        this.libraryName = "";
        this.sidebarOpen = true;
        this.resizeHandle = new SidebarResizeHandle(eventBus, {
            minWidth: sidebarMinWidth,
            maxWidth: sidebarMaxWidth,
            defaultWidth: sidebarDefaultWidth,
            keyboardStep: sidebarKeyboardStep,
            ...(isDesktop ? { isDesktop } : {})
        });
        this.trackInfoResizeHandle = new TrackInfoResizeHandle(eventBus, {
            minHeight: trackInfoMinHeight,
            maxHeight: trackInfoMaxHeight,
            defaultHeight: trackInfoDefaultHeight,
            minListHeight: trackListMinHeight,
            keyboardStep: trackInfoKeyboardStep,
            ...(isDesktop ? { isDesktop } : {})
        });
        this.element = this.#create();
        this.status = this.element.querySelector(".view-state-message");
        this.resetButton = this.element.querySelector(".view-state-reset");
    }

    attach({ toolbar, workspace, sidebar }) {

        this.toolbar = toolbar;
        this.workspace = workspace;
        this.sidebar = sidebar;
        this.resizeHandle.attach({ workspace, sidebar });
        const trackList = sidebar.querySelector(".sidebar");
        const trackInfo = sidebar.querySelector(".track-info");

        if (trackList && trackInfo) {
            this.trackInfoResizeHandle.attach({
                shell: sidebar,
                trackList,
                trackInfo
            });
        }
        this.sidebar.id = SIDEBAR_ID;
        this.toolbar.sidebarToggleButton.setAttribute("aria-controls", SIDEBAR_ID);
        this.toolbar.sidebarToggleButton.addEventListener("click", () => {
            this.setSidebarOpen(!this.sidebarOpen, { emit: true });
        });
        this.setSidebarOpen(true);
    }

    setLibrary({ name, hasState }) {

        this.libraryName = name;
        this.element.hidden = false;
        this.setStoredStateAvailable(hasState);
    }

    setStoredStateAvailable(available) {

        this.resetButton.disabled = !available;
        this.resetButton.title = available
            ? "このLibraryの端末内表示状態だけを消去します"
            : "保存された前回表示状態はありません";
        this.status.textContent = available
            ? "前回の表示状態をこの端末に保存しています。"
            : "保存された前回表示状態はありません。";
    }

    setSidebarOpen(open, { emit = false, notifyLayout = true } = {}) {

        const normalizedOpen = Boolean(open);

        if (
            !normalizedOpen &&
            this.sidebar?.contains(globalThis.document?.activeElement)
        ) {
            this.toolbar?.sidebarToggleButton.focus();
        }

        this.sidebarOpen = normalizedOpen;
        this.sidebar.hidden = !normalizedOpen;
        this.workspace.classList.toggle(
            "is-sidebar-closed",
            !normalizedOpen
        );
        this.toolbar.setSidebarOpen(normalizedOpen);
        const resizeVisible = this.resizeHandle.setSidebarOpen(normalizedOpen);

        this.workspace.classList.toggle(
            "is-sidebar-resize-unavailable",
            normalizedOpen && !resizeVisible
        );

        if (emit) {
            this.eventBus.emit("view-state:sidebar-toggled", {
                open: normalizedOpen
            });
        }

        if (notifyLayout) {
            this.requestFrame(() => {
                this.eventBus.emit("view-state:sidebar-layout-changed");
            });
        }
    }

    isSidebarOpen() {

        return this.sidebarOpen;
    }

    setSidebarWidth(width, options = {}) {

        return this.resizeHandle.setWidth(width, options);
    }

    getSidebarWidth() {

        return this.resizeHandle.getWidth();
    }

    getDefaultSidebarWidth() {

        return this.resizeHandle.getDefaultWidth();
    }

    setTrackInfoHeight(height, options = {}) {

        return this.trackInfoResizeHandle.setHeight(height, options);
    }

    getTrackInfoHeight() {

        return this.trackInfoResizeHandle.getHeight();
    }

    getDefaultTrackInfoHeight() {

        return this.trackInfoResizeHandle.getDefaultHeight();
    }

    confirmReset() {

        return this.confirmAction(
            `「${this.libraryName}」の端末内に保存された前回表示状態を消去しますか？`
        );
    }

    #create() {

        const section = document.createElement("section");

        section.className = "library-access-panel view-state-controls";
        section.hidden = true;
        section.innerHTML = `
            <h4 class="library-access-title">Device-local view</h4>
            <p id="${STATUS_ID}" class="library-access-message view-state-message"
                role="status" aria-live="polite" aria-atomic="true"></p>
            <button class="view-state-reset" type="button"
                aria-describedby="${STATUS_ID}">前回の表示状態を消去</button>
        `;
        section.querySelector(".view-state-reset").addEventListener(
            "click",
            () => this.eventBus.emit("view-state:reset-requested")
        );

        return section;
    }
}
