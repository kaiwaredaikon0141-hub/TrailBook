const MISSING_TILE_URL = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ' +
    'viewBox="0 0 256 256"><rect width="256" height="256" ' +
    'fill="#e5e7eb"/><path d="M0 0L256 256M256 0L0 256" ' +
    'stroke="#cbd5e1" stroke-width="1"/></svg>'
);

/** Leaflet TileLayer adapter for explicit device-local tile read-through. */
export default class OfflineTileLayer {

    constructor({
        leaflet,
        provider,
        resolver,
        objectUrlApi = globalThis.URL,
        imageFactory = () => document.createElement("img"),
        onStatus = () => {}
    }) {
        if (!leaflet?.TileLayer?.extend ||
            provider?.offlineDownloadAllowed !== true ||
            !resolver?.resolveTile ||
            typeof objectUrlApi?.createObjectURL !== "function" ||
            typeof objectUrlApi?.revokeObjectURL !== "function") {
            throw new TypeError("Offline TileLayer dependencies are invalid.");
        }
        this.leaflet = leaflet;
        this.provider = provider;
        this.resolver = resolver;
        this.objectUrlApi = objectUrlApi;
        this.imageFactory = imageFactory;
        this.onStatus = onStatus;
        this.objectUrls = new WeakMap();
        this.unloadedTiles = new WeakSet();
    }

    create(options = {}) {
        const adapter = this;
        const Layer = this.leaflet.TileLayer.extend({
            createTile(coords, done) {
                return adapter.createTile(this, coords, done);
            }
        });
        const layer = new Layer(this.provider.tileUrl, options);
        layer.on?.("tileunload", event => this.release(event.tile));
        return layer;
    }

    createTile(layer, coords, done) {
        const tile = this.imageFactory();
        tile.alt = "";
        tile.setAttribute?.("role", "presentation");
        if (layer.options?.crossOrigin || layer.options?.crossOrigin === "") {
            tile.crossOrigin = layer.options.crossOrigin === true
                ? "" : layer.options.crossOrigin;
        }
        if (layer.options?.referrerPolicy) {
            tile.referrerPolicy = layer.options.referrerPolicy;
        }

        this.#resolve(layer, tile, coords, done);
        return tile;
    }

    release(tile) {
        this.unloadedTiles.add(tile);
        this.#revokeObjectUrl(tile);
    }

    #revokeObjectUrl(tile) {
        const objectUrl = this.objectUrls.get(tile);
        if (!objectUrl) return;
        this.objectUrlApi.revokeObjectURL(objectUrl);
        this.objectUrls.delete(tile);
    }

    async #resolve(layer, tile, coords, done) {
        const result = await this.resolver.resolveTile(this.provider, coords);
        if (this.unloadedTiles.has(tile)) return;
        this.#publish(tile, result);

        if (result.status === "local-hit") {
            this.#showLocal(layer, tile, coords, result.blob, done);
            return;
        }
        this.#showNetwork(layer, tile, coords, done);
    }

    #showLocal(layer, tile, coords, blob, done) {
        const objectUrl = this.objectUrlApi.createObjectURL(blob);
        this.objectUrls.set(tile, objectUrl);
        tile.onload = () => {
            this.#revokeObjectUrl(tile);
            done?.(null, tile);
        };
        tile.onerror = () => {
            this.#revokeObjectUrl(tile);
            this.#showNetwork(layer, tile, coords, done);
        };
        tile.src = objectUrl;
    }

    #showNetwork(layer, tile, coords, done) {
        tile.onload = () => {
            this.#publish(tile, { status: "network-fallback" });
            done?.(null, tile);
        };
        tile.onerror = () => {
            tile.onload = null;
            tile.onerror = null;
            tile.classList?.add("offline-tile-missing");
            tile.src = MISSING_TILE_URL;
            this.#publish(tile, {
                status: "unavailable",
                reason: "network-error"
            });
            done?.(null, tile);
        };
        tile.src = layer.getTileUrl(coords);
    }

    #publish(tile, result) {
        if (tile.dataset) tile.dataset.offlineTileStatus = result.status;
        this.onStatus(result);
    }
}

export { MISSING_TILE_URL };
