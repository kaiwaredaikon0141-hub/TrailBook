import LayerManager from "../map/LayerManager.js";
import drivePerformance from "../services/DrivePerformanceMonitor.js";

const DEFAULT_MAP_DISPLAY_MODE = "color";
const MAP_DISPLAY_MODES = new Set([
    DEFAULT_MAP_DISPLAY_MODE,
    "monochrome"
]);
const DEFAULT_BASE_MAP = "osm";
const BASE_MAPS = Object.freeze({
    gsiStandard: Object.freeze({
        url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" ' +
            'target="_blank" rel="noopener noreferrer" ' +
            'style="text-decoration: underline;">国土地理院</a>',
        maxZoom: 18
    })
});

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

        this.mapDisplayMode = DEFAULT_MAP_DISPLAY_MODE;

        this.baseMap = DEFAULT_BASE_MAP;

        this.element = this.create();

        this.sidebarDisplayControls = this.#createSidebarDisplayControls();

        this.map = null;

        this.layerManager = null;

        this.trackRenderer = null;

        this.baseTileLayer = null;

        this.currentPositionMarker = null;

        this.currentPositionAccuracy = null;

        this.programmaticViewChangeDepth = 0;

        this.selectionInteractionEnabled = true;

        this.handleZoomEnd = () => {
            this.eventBus.emit("map:zoom-ended", {
                zoom: this.getZoom()
            });
        };

        this.handleMapClick = () => {
            if (this.selectionInteractionEnabled) {
                this.eventBus.emit("map:background-clicked");
            }
        };

        this.handleDragStart = () => {
            this.eventBus.emit("map:user-drag-started");
        };

        this.handleMoveEnd = () => {
            this.eventBus.emit("map:view-changed", {
                viewState: this.getViewState(),
                programmatic: this.programmaticViewChangeDepth > 0
            });
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

            this.map = L.map(mapElement, {
                maxZoom: this.config.map.tileMaxZoom
            }).setView(
                [
                    this.config.map.center.latitude,
                    this.config.map.center.longitude
                ],
                this.config.map.initialZoom
            );

            this.#replaceBaseLayer();

            this.trackRenderer = L.canvas({
                tolerance: this.config.map.trackStyle.hitTolerance
            });

            this.layerManager = new LayerManager(
                this.map,
                this.config.map,
                {
                    trackRenderer: this.trackRenderer,
                    onTrackClick: (path, event) => {
                        if (this.selectionInteractionEnabled) {
                            this.eventBus.emit("map:track-clicked", { path });
                        }

                        if (event?.originalEvent) {
                            L.DomEvent.stopPropagation(event.originalEvent);
                        }
                    }
                }
            );

            this.map.on("zoomend", this.handleZoomEnd);
            this.map.on("moveend", this.handleMoveEnd);
            this.map.on("click", this.handleMapClick);
            this.map.on("dragstart", this.handleDragStart);

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

        const endLayer = drivePerformance.begin("mapLayerMs", "mapLayerCount");

        drivePerformance.recordComponentCall("MapView.displayGPX");

        try {
            this.layerManager.displayGPX(path, result, style, options);
        } finally {
            endLayer();
        }

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

    getViewState() {

        if (
            typeof this.map?.getCenter !== "function" ||
            typeof this.map?.getZoom !== "function"
        ) {
            return null;
        }

        const center = this.map.getCenter();

        return {
            lat: center.lat,
            lng: center.lng,
            zoom: this.map.getZoom()
        };
    }

    isValidViewState({ lat, lng, zoom } = {}) {

        const minZoom = this.map?.getMinZoom?.() ?? 0;
        const maxZoom = this.map?.getMaxZoom?.() ?? this.config.map.tileMaxZoom;

        return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
            Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
            Number.isFinite(zoom) && zoom >= minZoom && zoom <= maxZoom;
    }

    setViewState(viewState, { animate = false, silent = false } = {}) {

        if (!this.map || !this.isValidViewState(viewState)) {
            return false;
        }

        this.#runViewChange(
            () => this.map.setView(
                [viewState.lat, viewState.lng],
                viewState.zoom,
                { animate }
            ),
            silent
        );

        return true;
    }

    invalidateSize({ silent = false } = {}) {

        if (typeof this.map?.invalidateSize !== "function") {
            return false;
        }

        this.#runViewChange(
            () => this.map.invalidateSize({ pan: false, animate: false }),
            silent
        );

        return true;
    }

    setCurrentPosition({ latitude, longitude, accuracy } = {}) {

        if (
            !this.map || !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return false;
        }

        const latLng = [latitude, longitude];

        if (!this.currentPositionMarker) {
            this.currentPositionMarker = L.circleMarker(latLng, {
                radius: 7,
                color: "#ffffff",
                weight: 3,
                fillColor: "#2563eb",
                fillOpacity: 1,
                interactive: false,
                bubblingMouseEvents: false,
                pane: "markerPane",
                className: "current-position-marker"
            }).addTo(this.map);
        } else {
            this.currentPositionMarker.setLatLng(latLng);
        }

        if (Number.isFinite(accuracy) && accuracy >= 0) {
            if (!this.currentPositionAccuracy) {
                this.currentPositionAccuracy = L.circle(latLng, {
                    radius: accuracy,
                    color: "#2563eb",
                    weight: 1,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.16,
                    interactive: false,
                    bubblingMouseEvents: false,
                    pane: "overlayPane",
                    className: "current-position-accuracy"
                }).addTo(this.map);
            } else {
                this.currentPositionAccuracy
                    .setLatLng(latLng)
                    .setRadius(accuracy);
            }
        } else if (this.currentPositionAccuracy) {
            this.currentPositionAccuracy.remove();
            this.currentPositionAccuracy = null;
        }

        return true;
    }

    followCurrentPosition({ latitude, longitude } = {}, {
        verticalRatio = 0.5
    } = {}) {

        if (
            !this.map || !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return false;
        }

        const zoom = this.map.getZoom();
        let center = [latitude, longitude];

        if (
            verticalRatio !== 0.5 &&
            typeof this.map.project === "function" &&
            typeof this.map.unproject === "function" &&
            typeof this.map.getSize === "function"
        ) {
            const point = this.map.project(center, zoom);
            const size = this.map.getSize();
            center = this.map.unproject(
                [point.x, point.y - (verticalRatio - 0.5) * size.y],
                zoom
            );
        }

        this.#runViewChange(
            () => this.map.setView(center, zoom, { animate: false }),
            true
        );
        return true;
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

    setSelectionInteractionEnabled(enabled) {

        this.selectionInteractionEnabled = Boolean(enabled);
        return this.selectionInteractionEnabled;
    }

    setEditingTargetSuppressed(path, suppressed) {

        return this.layerManager?.setTrackPresentationVisible(
            path,
            !suppressed
        ) ?? false;
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
            this.#syncMobileMapControls();
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

        this.#syncMobileMapControls();

        return true;
    }

    getMapDisplayMode() {

        return this.mapDisplayMode;
    }

    setBaseMap(value) {

        const normalized = this.#normalizeBaseMap(value);
        const changed = normalized !== this.baseMap;

        this.baseMap = normalized;
        const select = this.element.querySelector(".base-map-select");

        if (select) select.value = normalized;
        this.#syncMobileMapControls();
        if (this.map && (changed || !this.baseTileLayer)) {
            this.#replaceBaseLayer();
        }

        return changed;
    }

    getBaseMap() {

        return this.baseMap;
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
    resetView({ silent = false } = {}) {

        if (this.map) {
            this.#runViewChange(
                () => this.map.setView(
                    [
                        this.config.map.center.latitude,
                        this.config.map.center.longitude
                    ],
                    this.config.map.initialZoom
                ),
                silent
            );
        }
    }

    #runViewChange(callback, silent) {

        if (silent) {
            this.programmaticViewChangeDepth += 1;
        }

        try {
            callback();
        } finally {
            if (silent) {
                this.programmaticViewChangeDepth -= 1;
            }
        }
    }

    #replaceBaseLayer() {

        this.baseTileLayer?.remove?.();
        if (this.baseTileLayer && !this.baseTileLayer.remove) {
            this.map.removeLayer?.(this.baseTileLayer);
        }

        const definition = this.#getBaseMapDefinition(this.baseMap);

        this.baseTileLayer = L.tileLayer(definition.url, {
            attribution: definition.attribution,
            maxZoom: definition.maxZoom
        }).addTo(this.map);
    }

    #getBaseMapDefinition(value) {

        if (value === DEFAULT_BASE_MAP) {
            return {
                url: this.config.map.tileUrl,
                attribution: this.config.map.tileAttribution,
                maxZoom: this.config.map.tileMaxZoom
            };
        }

        return BASE_MAPS[value] || this.#getBaseMapDefinition(DEFAULT_BASE_MAP);
    }

    #normalizeBaseMap(value) {

        return value === DEFAULT_BASE_MAP || Object.hasOwn(BASE_MAPS, value)
            ? value
            : DEFAULT_BASE_MAP;
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
                <label class="base-map-control">
                    <span>背景:</span>
                    <select class="base-map-select" aria-label="背景地図">
                        <option value="osm">OSM</option>
                        <option value="gsiStandard">地理院 標準</option>
                    </select>
                </label>
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
            <div class="mobile-map-controls" aria-label="地図表示設定">
                <button class="mobile-base-map-toggle" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true"
                        focusable="false">
                        <path d="M3 6.5 8 4l8 3 5-2.5v13L16 20l-8-3-5 2.5z"></path>
                        <path d="M8 4v13M16 7v13"></path>
                    </svg>
                </button>
                <button class="mobile-map-mode-toggle" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true"
                        focusable="false">
                        <circle cx="12" cy="12" r="4"></circle>
                        <path d="M12 2v2M12 20v2M2 12h2M20 12h2
                            M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4
                            M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"></path>
                    </svg>
                </button>
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
            event => {
                const visible = event.target.checked;

                const sidebarInput = this.sidebarDisplayControls
                    ?.querySelector("input");

                if (sidebarInput) sidebarInput.checked = visible;
                this.eventBus.emit(
                    "map:waypoint-visibility-toggled",
                    { visible }
                );
            }
        );

        section.querySelector(".map-mode-select").addEventListener(
            "change",
            event => this.eventBus.emit(
                "map:display-mode-changed",
                { mode: event.target.value }
            )
        );

        section.querySelector(".base-map-select").addEventListener(
            "change",
            event => this.eventBus.emit(
                "map:base-map-changed",
                { baseMap: event.target.value }
            )
        );

        section.querySelector(".mobile-base-map-toggle").addEventListener(
            "click",
            () => this.eventBus.emit(
                "map:base-map-changed",
                { baseMap: this.baseMap === "osm" ? "gsiStandard" : "osm" }
            )
        );

        section.querySelector(".mobile-map-mode-toggle").addEventListener(
            "click",
            () => this.eventBus.emit(
                "map:display-mode-changed",
                {
                    mode: this.mapDisplayMode === "color"
                        ? "monochrome"
                        : "color"
                }
            )
        );

        this.#syncMobileMapControls(section);

        return section;
    }

    #createSidebarDisplayControls() {

        const section = document.createElement("section");

        section.className = "mobile-sidebar-display-controls";
        section.setAttribute("aria-label", "表示");
        section.innerHTML = `
            <strong class="mobile-sidebar-display-title">表示</strong>
            <label class="mobile-sidebar-waypoint-toggle">
                <input type="checkbox" aria-label="Waypointを表示">
                <span>Waypointを表示</span>
            </label>
            <button class="mobile-sidebar-clear" type="button">
                表示をクリア
            </button>
        `;

        section.querySelector("input").addEventListener("change", event => {
            const visible = event.target.checked;

            this.element.querySelector(".waypoint-toggle input").checked = visible;
            this.eventBus.emit(
                "map:waypoint-visibility-toggled",
                { visible }
            );
        });
        section.querySelector("button").addEventListener(
            "click",
            () => this.eventBus.emit("map:clear-requested")
        );

        return section;
    }

    #syncMobileMapControls(root = this.element) {

        const baseButton = root.querySelector?.(".mobile-base-map-toggle");
        const modeButton = root.querySelector?.(".mobile-map-mode-toggle");
        const isGsi = this.baseMap === "gsiStandard";
        const isMonochrome = this.mapDisplayMode === "monochrome";

        if (baseButton) {
            const next = isGsi ? "OSM" : "地理院標準";
            const current = isGsi ? "地理院標準" : "OSM";

            baseButton.dataset.state = this.baseMap;
            baseButton.setAttribute("aria-pressed", String(isGsi));
            baseButton.setAttribute(
                "aria-label",
                `背景地図: ${current}。${next}へ切り替え`
            );
            baseButton.title = `${next}へ切り替え`;
        }

        if (modeButton) {
            const next = isMonochrome ? "Color" : "Monochrome";
            const current = isMonochrome ? "Monochrome" : "Color";

            modeButton.dataset.state = this.mapDisplayMode;
            modeButton.setAttribute("aria-pressed", String(isMonochrome));
            modeButton.setAttribute(
                "aria-label",
                `地図表示: ${current}。${next}へ切り替え`
            );
            modeButton.title = `${next}へ切り替え`;
        }
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

export { BASE_MAPS, DEFAULT_BASE_MAP };
