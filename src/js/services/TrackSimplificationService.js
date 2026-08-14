import TrackSimplificationMetrics, {
    isValidCoordinate,
    pointToSegmentDistanceMeters
} from "./TrackSimplificationMetrics.js";

const DEFAULT_YIELD_EVERY = 4096;

/**
 * Creates Segment-local Ramer-Douglas-Peucker preview masks.
 */
export default class TrackSimplificationService {

    constructor({ metrics = new TrackSimplificationMetrics() } = {}) {

        this.metrics = metrics;
    }

    async createPreview(source, toleranceMeters, {
        signal = null,
        onProgress = null,
        yieldEvery = DEFAULT_YIELD_EVERY,
        yieldControl = defaultYieldControl
    } = {}) {

        this.#validateTolerance(toleranceMeters);

        if (!Number.isInteger(yieldEvery) || yieldEvery < 1) {
            throw new TypeError("yieldEvery must be a positive integer");
        }

        if (typeof yieldControl !== "function") {
            throw new TypeError("yieldControl must be a function");
        }

        if (onProgress !== null && typeof onProgress !== "function") {
            throw new TypeError("onProgress must be a function or null");
        }

        const context = {
            signal,
            yieldEvery,
            yieldControl,
            operations: 0
        };
        const totalSegments = source.tracks.reduce(
            (total, track) => total + track.segments.length,
            0
        );
        let processedSegments = 0;
        const retainedPointMasks = [];

        for (const track of source.tracks) {
            const trackMasks = [];

            for (const segment of track.segments) {
                this.#throwIfAborted(signal);
                trackMasks.push(await this.#simplifySegment(
                    segment.points,
                    toleranceMeters,
                    context
                ));
                processedSegments += 1;
                onProgress?.({ processedSegments, totalSegments });
            }

            retainedPointMasks.push(trackMasks);
        }

        const frozenMasks = freezeMasks(retainedPointMasks);
        const calculated = this.metrics.calculate(source, frozenMasks);

        return Object.freeze({
            source,
            toleranceMeters,
            retainedPointMasks: frozenMasks,
            trackMetrics: calculated.tracks,
            metrics: calculated.total
        });
    }

    async #simplifySegment(points, toleranceMeters, context) {

        const retained = points.map(() => false);

        if (points.length === 0) return retained;

        retained[0] = true;
        retained[points.length - 1] = true;

        let index = 0;

        while (index < points.length) {
            if (!isValidCoordinate(points[index])) {
                retained[index] = true;
                index += 1;
                continue;
            }

            const runStart = index;

            while (
                index + 1 < points.length &&
                isValidCoordinate(points[index + 1])
            ) {
                index += 1;
            }

            await this.#simplifyValidRun(
                points,
                retained,
                runStart,
                index,
                toleranceMeters,
                context
            );
            index += 1;
        }

        return retained;
    }

    async #simplifyValidRun(
        points,
        retained,
        runStart,
        runEnd,
        toleranceMeters,
        context
    ) {

        retained[runStart] = true;
        retained[runEnd] = true;

        if (runEnd - runStart < 2) return;

        const stack = [[runStart, runEnd]];

        while (stack.length > 0) {
            this.#throwIfAborted(context.signal);

            const [startIndex, endIndex] = stack.pop();
            let maximumDistance = -1;
            let maximumIndex = -1;

            for (let index = startIndex + 1; index < endIndex; index += 1) {
                const distance = pointToSegmentDistanceMeters(
                    points[index],
                    points[startIndex],
                    points[endIndex]
                );

                if (distance > maximumDistance) {
                    maximumDistance = distance;
                    maximumIndex = index;
                }

                if (this.#shouldYield(context)) {
                    this.#throwIfAborted(context.signal);
                    await context.yieldControl();
                    this.#throwIfAborted(context.signal);
                }
            }

            if (maximumDistance <= toleranceMeters || maximumIndex < 0) {
                continue;
            }

            retained[maximumIndex] = true;
            stack.push([startIndex, maximumIndex]);
            stack.push([maximumIndex, endIndex]);
        }
    }

    #shouldYield(context) {

        context.operations += 1;
        return context.operations % context.yieldEvery === 0;
    }

    #validateTolerance(value) {

        if (!Number.isFinite(value) || value <= 0) {
            throw new TypeError("toleranceMeters must be a positive finite number");
        }
    }

    #throwIfAborted(signal) {

        if (!signal?.aborted) return;

        const error = new Error("Track simplification was cancelled");
        error.code = "SIMPLIFICATION_ABORTED";
        throw error;
    }
}

function freezeMasks(masks) {

    return Object.freeze(masks.map(
        track => Object.freeze(track.map(
            segment => Object.freeze([...segment])
        ))
    ));
}

function defaultYieldControl() {

    return new Promise(resolve => setTimeout(resolve, 0));
}

export { DEFAULT_YIELD_EVERY };
