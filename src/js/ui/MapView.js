import LayerManager from "../map/LayerManager.js";

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

            this.layerManager = new LayerManager(this.map, this.config.map);

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
    displayGPX(result) {

        if (!this.layerManager) {

            throw new Error("MapView is not initialized.");
        }

        this.layerManager.display(result);

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
                <button class="map-clear" type="button">表示をクリア</button>
            </div>
            <div class="map-canvas" role="application" aria-label="GPX地図"></div>
            <div class="map-state" aria-live="polite"></div>
        `;

        section.querySelector(".map-clear").addEventListener(
            "click",
            () => this.eventBus.emit("map:clear-requested")
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