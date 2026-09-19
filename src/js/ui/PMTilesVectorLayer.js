import PMTilesArchiveReader from "../services/PMTilesArchiveReader.js";
import PMTilesArchiveSource from "../services/PMTilesArchiveSource.js";

/** Leaflet vector layer adapter for a ready local OPFS PMTiles package. */
export default class PMTilesVectorLayer {

    constructor({
        leaflet = globalThis.L,
        archiveStore,
        archiveReader = new PMTilesArchiveReader(),
        renderer = globalThis.protomapsL
    } = {}) {
        if (!leaflet?.GridLayer || !archiveStore ||
            typeof renderer?.leafletLayer !== "function") {
            throw new TypeError("PMTiles vector layer dependencies are invalid.");
        }
        this.leaflet = leaflet;
        this.archiveStore = archiveStore;
        this.archiveReader = archiveReader;
        this.renderer = renderer;
    }

    create(provider, layerOptions = {}) {
        if (provider?.sourceType !== "pmtiles" || !provider.packageId ||
            provider.tileType !== "mvt") {
            throw new TypeError("A ready vector PMTiles source is required.");
        }
        if (globalThis.L !== this.leaflet) {
            throw new Error(
                "Protomaps Leaflet adapter requires the active Leaflet global."
            );
        }
        const source = new PMTilesArchiveSource(
            this.archiveStore, provider.packageId
        );
        const archive = this.archiveReader.createArchive(source);
        return this.renderer.leafletLayer({
            ...layerOptions,
            url: archive,
            flavor: "light",
            lang: "ja",
            attribution: provider.attribution,
            minZoom: provider.minZoom,
            maxZoom: provider.maxZoom,
            maxDataZoom: provider.maxZoom
        });
    }
}
