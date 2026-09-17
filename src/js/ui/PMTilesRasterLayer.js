import { leafletRasterLayer } from "../../vendor/pmtiles/pmtiles.js";
import PMTilesArchiveReader from "../services/PMTilesArchiveReader.js";
import PMTilesArchiveSource from "../services/PMTilesArchiveSource.js";

const RASTER_TYPES = new Set(["png", "jpeg", "webp", "avif"]);

/** Leaflet raster layer adapter for a ready local OPFS PMTiles package. */
export default class PMTilesRasterLayer {

    constructor({
        leaflet = globalThis.L,
        archiveStore,
        archiveReader = new PMTilesArchiveReader(),
        layerFactory = leafletRasterLayer
    } = {}) {
        if (!leaflet?.GridLayer || !archiveStore ||
            typeof layerFactory !== "function") {
            throw new TypeError("PMTiles raster layer dependencies are invalid.");
        }
        this.leaflet = leaflet;
        this.archiveStore = archiveStore;
        this.archiveReader = archiveReader;
        this.layerFactory = layerFactory;
    }

    create(provider, layerOptions = {}) {
        if (provider?.sourceType !== "pmtiles" || !provider.packageId ||
            !RASTER_TYPES.has(provider.tileType)) {
            throw new TypeError("A ready raster PMTiles source is required.");
        }
        if (globalThis.L !== this.leaflet) {
            throw new Error("PMTiles Leaflet adapter requires the active Leaflet global.");
        }
        const source = new PMTilesArchiveSource(
            this.archiveStore, provider.packageId
        );
        const archive = this.archiveReader.createArchive(source);
        return this.layerFactory(archive, {
            ...layerOptions,
            attribution: provider.attribution,
            minZoom: provider.minZoom,
            maxZoom: provider.maxZoom
        });
    }
}
