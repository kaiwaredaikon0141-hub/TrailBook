const EMPTY_VALUE = "—";

/**
 * Stateless human-readable formatting for simplification metrics.
 */
export default class TrackEditingMetricsFormatter {

    format(metrics) {

        return {
            points: `${this.#integer(metrics.sourcePointCount)} → ` +
                this.#integer(metrics.retainedPointCount),
            reduction: `${(metrics.reductionRatio * 100).toFixed(1)}%`,
            sourceDistance: this.#distance(metrics.sourceDistanceMeters),
            simplifiedDistance: this.#distance(
                metrics.simplifiedDistanceMeters
            ),
            distanceDifference: this.#signedDistance(
                metrics.distanceDifferenceMeters
            ),
            maxDeviation: this.#distance(metrics.maxDeviationMeters)
        };
    }

    #integer(value) {

        return Number.isInteger(value)
            ? value.toLocaleString("ja-JP")
            : EMPTY_VALUE;
    }

    #distance(value) {

        if (!Number.isFinite(value)) return EMPTY_VALUE;
        if (Math.abs(value) < 1000) return `${value.toFixed(1)} m`;
        return `${(value / 1000).toFixed(2)} km`;
    }

    #signedDistance(value) {

        if (!Number.isFinite(value)) return EMPTY_VALUE;
        return `${value > 0 ? "+" : ""}${this.#distance(value)}`;
    }
}

export { EMPTY_VALUE };
