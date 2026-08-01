import LayerManager from "../map/LayerManager.js";

const DEFAULT_MAP_DISPLAY_MODE = "color";
const MAP_DISPLAY_MODES = new Set([
    DEFAULT_MAP_DISPLAY_MODE,
    "monochrome"
]);

function normalizeMapDisplayMode(mode) {

    return MAP_DISPLAY_MODES.has(mode)
        ? mode
        : DEFAULT_MAP_DISPLAY_MODE;
}

/**
 * Displays parsed GPX data on a Leaflet map.
 */
export default class MapView {

    /**
     * @param {object} config
     * @param {import("../core/EventBus.js").default} eventBus
     */
    constructor(config, eventBus) {

        this.config = config;

        this.eventBus = eventBus;

        this.element = this.create();

        this.map = null;

        this.layerManager = null;

        this.trackRenderer = null;

        this.mapDisplayMode = DEFAULT_MAP_DISPLAY_MODE;

        this.handleZoomEnd = () => {
            this.eventBus.emit("map:zoom-ended", {
                zoom: this.getZoom()
            });
        };

        this.handleMapClick = () => {
            this.eventBus.emit("map:background-clicked");
        };
    }

    /**
     * Initializes Leaflet and the base tile layer.
     *
     * @returns {void}
     */
    initialize() {

        try {

            if (!window.L) {

                throw new Error("Leaflet is not available.");
            }

            const mapElement = this.element.querySelector(".map-canvas");

            this.map = L.map(mapElement).setView(
                [
                    this.config.map.center.latitude,
                    this.config.map.center.longitude
                ],
                this.config.map.initialZoom
            );

            L.tileLayer(
                this.config.map.tileUrl,
                {
                    attribution: this.config.map.tileAttribution,
                    maxZoom: this.config.map.tileMaxZoom
                }
            ).addTo(this.map);

            this.trackRenderer = L.canvas({
                tolerance: this.config.map.trackStyle.hitTolerance
            });

            this.layerManager = new LayerManager(
                this.map,
                this.config.map,
                {
                    trackRenderer: this.trackRenderer,
                    onTrackClick: (path, event) => {
                        this.eventBus.emit("map:track-clicked", { path });

                        if (event?.originalEvent) {
                            L.DomEvent.stopPropagation(event.originalEvent);
                        }
                    }
                }
            );

            this.map.on("zoomend", this.handleZoomEnd);
            this.map.on("click", this.handleMapClick);

            this.showEmpty();

        } catch (error) {

            this.showError();

            this.eventBus.emit("map:display-failed", { error });
        }
    }

    /**
     * Shows the loading state.
     *
     * @returns {void}
     */
    showLoading() {

        this.setState("loading", "GPXを読み込み中");
    }

    /**
     * Shows the empty map state.
     *
     * @returns {void}
     */
    showEmpty() {

        this.setState("empty", "GPXを選択してください");
    }

    /**
     * Shows the map error state.
     *
     * @returns {void}
     */
    showError() {

        this.setState("error", "地図を表示できません");
    }

    /**
     * Displays a parsed GPX result.
     *
     * @param {object} result
     * @returns {void}
     */
    displayGPX(path, result, style, options = {}) {

        if (!this.layerManager) {

            throw new Error("MapView is not initialized.");
        }

        this.layerManager.displayGPX(path, result, style, options);

        this.setState("loaded", "");
    }

    /**
     * Refocuses the map on the displayed Track bounds.
     *
     * @returns {void}
     */
    refocus() {

        if (this.layerManager) {

            this.layerManager.refocus();
        }
    }

    /**
     * Refocuses the map on one displayed GPX.
     *
     * @param {string} path
     * @returns {void}
     */
    refocusGPX(path) {

        if (this.layerManager) {
            this.layerManager.refocusGPX(path);
        }
    }

    /**
     * Removes one displayed GPX.
     *
     * @param {string} path
     * @returns {void}
     */
    removeGPX(path) {

        if (this.layerManager) {
            this.layerManager.removeGPX(path);

            if (!this.layerManager.hasDisplay()) {
                this.showEmpty();
            }
        }
    }

    addWaypoints(path, result) {

        if (this.layerManager) {
            this.layerManager.addWaypoints(path, result);
        }
    }

    removeWaypoints(path) {

        if (this.layerManager) {
            this.layerManager.removeWaypoints(path);
        }
    }

    getZoom() {

        if (typeof this.map?.getZoom === "function") {
            return this.map.getZoom();
        }

        return this.config.map.initialZoom;
    }

    updateTrackWeights(weight) {

        return this.layerManager?.updateTrackWeights(weight) ?? 0;
    }

    updateTrackStyles(styles) {

        return this.layerManager?.updateTrackStyles(styles) ?? 0;
    }

    updateTrackColor(path, styles) {

        return this.layerManager?.updateTrackColor(path, styles) ?? 0;
    }

    hasDisplay(path) {

        return this.layerManager?.hasDisplay(path) ?? false;
    }

    setSelectedPath(path, selectedMainStyle, selectedOutlineStyle) {

        return this.layerManager?.setSelectedPath(
            path,
            selectedMainStyle,
            selectedOutlineStyle
        ) ?? false;
    }

    clearSelectionHighlight() {

        return this.layerManager?.clearSelectionHighlight() ?? false;
    }

    setMapDisplayMode(mode) {

        const normalizedMode = normalizeMapDisplayMode(mode);

        if (this.mapDisplayMode === normalizedMode) {
            return false;
        }

        this.mapDisplayMode = normalizedMode;

        const mapElement = this.element.querySelector(".map-canvas");
        const modeSelect = this.element.querySelector(".map-mode-select");

        mapElement?.classList.toggle(
            "map--monochrome",
            normalizedMode === "monochrome"
        );

        if (modeSelect) {
            modeSelect.value = normalizedMode;
        }

        return true;
    }

    getMapDisplayMode() {

        return this.mapDisplayMode;
    }

    /**
     * Removes displayed GPX layers.
     *
     * @returns {void}
     */
    clear() {

        if (this.layerManager) {

            this.layerManager.clear();
        }

        this.showEmpty();
    }

    /**
     * Restores the configured initial map view.
     *
     * @returns {void}
     */
    resetView() {

        if (this.map) {

            this.map.setView(
                [
                    this.config.map.center.latitude,
                    this.config.map.center.longitude
                ],
                this.config.map.initialZoom
            );
        }
    }

    /**
     * Creates the map view elements.
     *
     * @returns {HTMLElement}
     */
    create() {

        const section = document.createElement("section");

        section.className = "map-view";

        section.innerHTML = `
            <div class="map-toolbar">
                <label class="map-mode-control">
                    <span>Map:</span>
                    <select class="map-mode-select" aria-label="背景地図の表示モード">
                        <option value="color">Color</option>
                        <option value="monochrome">Monochrome</option>
                    </select>
                </label>
                <label class="waypoint-toggle">
                    <input type="checkbox" aria-label="Waypointを表示">
                    <span>Waypointを表示</span>
                </label>
                <button class="map-clear" type="button">表示をクリア</button>
            </div>
            <div class="map-canvas" role="application" aria-label="GPX地図"></div>
            <div class="map-state" aria-live="polite"></div>
        `;

        section.querySelector(".map-clear").addEventListener(
            "click",
            () => this.eventBus.emit("map:clear-requested")
        );

        section.querySelector(".waypoint-toggle input").addEventListener(
            "change",
            event => this.eventBus.emit(
                "map:waypoint-visibility-toggled",
                { visible: event.target.checked }
            )
        );

        section.querySelector(".map-mode-select").addEventListener(
            "change",
            event => this.eventBus.emit(
                "map:display-mode-changed",
                { mode: event.target.value }
            )
        );

        return section;
    }

    /**
     * Updates the visible map state.
     *
     * @param {string} state
     * @param {string} message
     * @returns {void}
     */
    setState(state, message) {

        this.element.dataset.state = state;

        this.element.querySelector(".map-state").textContent = message;
    }

}
