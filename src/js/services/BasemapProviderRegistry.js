export const DEFAULT_BASE_MAP = "osm";

const GSI_STANDARD = Object.freeze({
    id: "gsiStandard",
    name: "GSI Standard",
    sourceType: "xyz",
    tileUrl: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    // Retain the MapView BASE_MAPS export contract for existing consumers.
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" ' +
        'target="_blank" rel="noopener noreferrer" ' +
        'style="text-decoration: underline;">国土地理院</a>',
    minZoom: 0,
    maxZoom: 18,
    tileSetVersion: "gsi-standard-v1",
    offlineDownloadAllowed: false,
    termsUrl: "https://maps.gsi.go.jp/development/ichiran.html"
});

export const BASE_MAPS = Object.freeze({ gsiStandard: GSI_STANDARD });

/** Metadata for ordinary basemap viewing; offline eligibility is explicit. */
export default class BasemapProviderRegistry {

    #providers;

    constructor(mapConfig, { additionalProviders = [] } = {}) {
        if (!mapConfig?.tileUrl || !mapConfig?.tileAttribution) {
            throw new TypeError("Current basemap configuration is required.");
        }

        const osm = Object.freeze({
            id: DEFAULT_BASE_MAP,
            name: "OpenStreetMap",
            sourceType: "xyz",
            tileUrl: mapConfig.tileUrl,
            url: mapConfig.tileUrl,
            attribution: mapConfig.tileAttribution,
            minZoom: 0,
            maxZoom: mapConfig.tileMaxZoom,
            tileSetVersion: "osm-standard-v1",
            offlineDownloadAllowed: false,
            termsUrl: "https://operations.osmfoundation.org/policies/tiles/"
        });

        this.#providers = new Map([
            [DEFAULT_BASE_MAP, osm],
            [GSI_STANDARD.id, GSI_STANDARD]
        ]);

        for (const provider of additionalProviders) {
            if (!provider?.id || this.#providers.has(provider.id)) {
                throw new TypeError("An additional basemap provider needs a unique id.");
            }
            this.#providers.set(provider.id, Object.freeze({ ...provider }));
        }
    }

    get(id) {
        return this.#providers.get(id) ?? null;
    }

    normalizeId(id) {
        return this.#providers.has(id) ? id : DEFAULT_BASE_MAP;
    }

    canDownloadOffline(id) {
        return this.get(id)?.offlineDownloadAllowed === true;
    }

    list() {
        return Array.from(this.#providers.values());
    }
}
