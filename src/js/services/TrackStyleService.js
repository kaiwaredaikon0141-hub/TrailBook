/**
 * Calculates normal track styles from configuration and the current zoom.
 * This service has no knowledge of paths, folders, UI state, or Leaflet.
 */
export default class TrackStyleService {

    constructor(config = {}) {

        this.config = config;
    }

    getZoomBucket(zoomLevel) {

        const zoom = Number.isFinite(zoomLevel)
            ? zoomLevel
            : this.getFallbackZoom();
        const buckets = Array.isArray(this.config.zoomBuckets)
            ? this.config.zoomBuckets
            : [];
        const rangedBuckets = buckets
            .filter(bucket => (
                Number.isFinite(bucket?.minZoom)
                && this.isValidWeight(bucket?.weight)
            ))
            .sort((left, right) => right.minZoom - left.minZoom);
        const matchedBucket = rangedBuckets.find(
            bucket => zoom >= bucket.minZoom
        );

        if (matchedBucket) {
            return this.createBucketResult(matchedBucket);
        }

        const fallbackBucket = buckets.find(bucket => (
            bucket?.minZoom == null
            && this.isValidWeight(bucket?.weight)
        ));

        if (fallbackBucket) {
            return this.createBucketResult(fallbackBucket);
        }

        return {
            name: "fallback",
            weight: this.getFallbackWeight()
        };
    }

    getNormalWeight(zoomLevel) {

        return this.getZoomBucket(zoomLevel).weight;
    }

    getNormalStyle({ color, zoomLevel } = {}) {

        const fallbackColor = typeof this.config.lineColor === "string"
            ? this.config.lineColor
            : "#e53935";
        const resolvedColor = typeof color === "string" && color.length > 0
            ? color
            : fallbackColor;
        const opacity = Number.isFinite(this.config.lineOpacity)
            && this.config.lineOpacity >= 0
            && this.config.lineOpacity <= 1
            ? this.config.lineOpacity
            : 0.85;

        return {
            color: resolvedColor,
            lineColor: resolvedColor,
            weight: this.getNormalWeight(zoomLevel),
            opacity
        };
    }

    createBucketResult(bucket) {

        return {
            name: typeof bucket.name === "string" && bucket.name.length > 0
                ? bucket.name
                : "unnamed",
            weight: bucket.weight
        };
    }

    getFallbackZoom() {

        return Number.isFinite(this.config.fallbackZoom)
            ? this.config.fallbackZoom
            : 0;
    }

    getFallbackWeight() {

        if (this.isValidWeight(this.config.fallbackWeight)) {
            return this.config.fallbackWeight;
        }

        if (this.isValidWeight(this.config.lineWeight)) {
            return this.config.lineWeight;
        }

        return 1;
    }

    isValidWeight(weight) {

        return Number.isFinite(weight) && weight > 0;
    }
}
