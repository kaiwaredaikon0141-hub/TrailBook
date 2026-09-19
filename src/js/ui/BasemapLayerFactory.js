import OfflineTileLayer from "./OfflineTileLayer.js";
import PMTilesRasterLayer from "./PMTilesRasterLayer.js";
import PMTilesVectorLayer from "./PMTilesVectorLayer.js";

const RASTER_TYPES = new Set(["png", "jpeg", "webp", "avif"]);

/** Creates one Leaflet basemap layer without owning provider or storage state. */
export default class BasemapLayerFactory {

    constructor({
        leaflet = globalThis.L,
        offlineTileResolver = null,
        archiveStore = null,
        offlineLayerFactory = options =>
            new OfflineTileLayer(options).create(options.layerOptions),
        rasterPMTilesLayerFactory = options =>
            new PMTilesRasterLayer(options).create(
                options.provider, options.layerOptions
            ),
        vectorPMTilesLayerFactory = options =>
            new PMTilesVectorLayer(options).create(
                options.provider, options.layerOptions
            )
    } = {}) {
        if (typeof offlineLayerFactory !== "function" ||
            typeof rasterPMTilesLayerFactory !== "function" ||
            typeof vectorPMTilesLayerFactory !== "function") {
            throw new TypeError("Basemap layer factory dependencies are invalid.");
        }
        this.leaflet = leaflet;
        this.offlineTileResolver = offlineTileResolver;
        this.archiveStore = archiveStore;
        this.offlineLayerFactory = offlineLayerFactory;
        this.rasterPMTilesLayerFactory = rasterPMTilesLayerFactory;
        this.vectorPMTilesLayerFactory = vectorPMTilesLayerFactory;
    }

    setOfflineTileResolver(resolver) {
        if (resolver !== null && typeof resolver?.resolveTile !== "function") {
            throw new TypeError("Offline tile resolver is invalid.");
        }
        this.offlineTileResolver = resolver;
    }

    setArchiveStore(store) {
        if (store !== null && typeof store?.readRange !== "function") {
            throw new TypeError("PMTiles archive storage is invalid.");
        }
        this.archiveStore = store;
    }

    create(provider, layerOptions = {}) {
        if (!provider) {
            throw new TypeError("A basemap provider is required.");
        }
        const sourceType = provider.sourceType ??
            (provider.offlineDownloadAllowed === true
                ? "offline-xyz" : "xyz");
        const leaflet = this.leaflet ?? globalThis.L;
        if (!leaflet?.tileLayer) {
            throw new Error("Leaflet is unavailable.");
        }
        const dependencies = {
            leaflet,
            provider,
            archiveStore: this.archiveStore,
            layerOptions
        };

        if (sourceType === "pmtiles") {
            if (!this.archiveStore) {
                throw new Error("Offline PMTiles archive storage is unavailable.");
            }
            if (RASTER_TYPES.has(provider.tileType)) {
                return this.rasterPMTilesLayerFactory(dependencies);
            }
            if (provider.tileType === "mvt") {
                return this.vectorPMTilesLayerFactory(dependencies);
            }
            throw new TypeError("PMTiles provider tile type is unsupported.");
        }
        if (sourceType === "offline-xyz" && this.offlineTileResolver) {
            return this.offlineLayerFactory({
                ...dependencies,
                resolver: this.offlineTileResolver
            });
        }
        if (sourceType !== "xyz" && sourceType !== "offline-xyz") {
            throw new TypeError("Basemap provider source type is unsupported.");
        }
        return leaflet.tileLayer(provider.tileUrl, layerOptions);
    }
}
