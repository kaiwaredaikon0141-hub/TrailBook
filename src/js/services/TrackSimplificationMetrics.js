const EARTH_RADIUS_METERS = 6371008.8;
const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Calculates Track simplification metrics without changing source points.
 */
export default class TrackSimplificationMetrics {

    calculate(source, retainedPointMasks) {

        const tracks = source.tracks.map((track, trackIndex) => {
            const segments = track.segments.map((segment, segmentIndex) =>
                this.#segment(
                    segment.points,
                    retainedPointMasks[trackIndex][segmentIndex]
                )
            );

            return Object.freeze({
                trackIndex,
                segments: Object.freeze(segments),
                ...this.#aggregate(segments)
            });
        });

        return Object.freeze({
            tracks: Object.freeze(tracks),
            total: Object.freeze(this.#aggregate(tracks))
        });
    }

    #segment(points, retainedMask) {

        const sourcePointCount = points.length;
        const retainedPointCount = retainedMask.filter(Boolean).length;
        const removedPointCount = sourcePointCount - retainedPointCount;
        const sourceDistanceMeters = pathDistanceMeters(
            points,
            points.map(() => true)
        );
        const simplifiedDistanceMeters = pathDistanceMeters(
            points,
            retainedMask
        );

        return Object.freeze({
            sourcePointCount,
            retainedPointCount,
            removedPointCount,
            reductionRatio: sourcePointCount === 0
                ? 0
                : removedPointCount / sourcePointCount,
            sourceDistanceMeters,
            simplifiedDistanceMeters,
            distanceDifferenceMeters:
                simplifiedDistanceMeters - sourceDistanceMeters,
            absoluteDistanceDifferenceMeters: Math.abs(
                simplifiedDistanceMeters - sourceDistanceMeters
            ),
            maxDeviationMeters: maximumDeviationMeters(points, retainedMask),
            invalidPointCount: points.filter(
                point => !isValidCoordinate(point)
            ).length
        });
    }

    #aggregate(items) {

        const sourcePointCount = this.#sum(items, "sourcePointCount");
        const retainedPointCount = this.#sum(items, "retainedPointCount");
        const removedPointCount = sourcePointCount - retainedPointCount;
        const sourceDistanceMeters = this.#sum(items, "sourceDistanceMeters");
        const simplifiedDistanceMeters = this.#sum(
            items,
            "simplifiedDistanceMeters"
        );

        return {
            sourcePointCount,
            retainedPointCount,
            removedPointCount,
            reductionRatio: sourcePointCount === 0
                ? 0
                : removedPointCount / sourcePointCount,
            sourceDistanceMeters,
            simplifiedDistanceMeters,
            distanceDifferenceMeters:
                simplifiedDistanceMeters - sourceDistanceMeters,
            absoluteDistanceDifferenceMeters: Math.abs(
                simplifiedDistanceMeters - sourceDistanceMeters
            ),
            maxDeviationMeters: items.reduce(
                (maximum, item) => Math.max(
                    maximum,
                    item.maxDeviationMeters || 0
                ),
                0
            ),
            invalidPointCount: this.#sum(items, "invalidPointCount")
        };
    }

    #sum(items, property) {

        return items.reduce((total, item) => total + (item[property] || 0), 0);
    }
}

export function isValidCoordinate(point) {

    return Boolean(point) &&
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        point.latitude >= -90 &&
        point.latitude <= 90 &&
        point.longitude >= -180 &&
        point.longitude <= 180;
}

export function pointToSegmentDistanceMeters(point, start, end) {

    if (
        !isValidCoordinate(point) ||
        !isValidCoordinate(start) ||
        !isValidCoordinate(end)
    ) {
        return 0;
    }

    const referenceLatitude = (
        point.latitude + start.latitude + end.latitude
    ) / 3 * DEGREES_TO_RADIANS;
    const scaleX = EARTH_RADIUS_METERS * Math.cos(referenceLatitude);
    const scaleY = EARTH_RADIUS_METERS;
    const pointX = normalizeLongitudeDelta(
        point.longitude - start.longitude
    ) * DEGREES_TO_RADIANS * scaleX;
    const pointY = (
        point.latitude - start.latitude
    ) * DEGREES_TO_RADIANS * scaleY;
    const endX = normalizeLongitudeDelta(
        end.longitude - start.longitude
    ) * DEGREES_TO_RADIANS * scaleX;
    const endY = (
        end.latitude - start.latitude
    ) * DEGREES_TO_RADIANS * scaleY;
    const lengthSquared = endX * endX + endY * endY;

    if (lengthSquared === 0) {
        return Math.hypot(pointX, pointY);
    }

    const projection = Math.max(0, Math.min(
        1,
        (pointX * endX + pointY * endY) / lengthSquared
    ));

    return Math.hypot(
        pointX - projection * endX,
        pointY - projection * endY
    );
}

export function pathDistanceMeters(points, retainedMask) {

    let distance = 0;
    let previous = null;

    points.forEach((point, index) => {
        if (!retainedMask[index]) return;

        if (!isValidCoordinate(point)) {
            previous = null;
            return;
        }

        if (previous) distance += haversineDistanceMeters(previous, point);
        previous = point;
    });

    return distance;
}

function maximumDeviationMeters(points, retainedMask) {

    const retainedIndexes = retainedMask
        .map((isRetained, index) => isRetained ? index : -1)
        .filter(index => index >= 0);
    let maximum = 0;

    for (let retainedIndex = 1;
        retainedIndex < retainedIndexes.length;
        retainedIndex += 1) {
        const startIndex = retainedIndexes[retainedIndex - 1];
        const endIndex = retainedIndexes[retainedIndex];
        const start = points[startIndex];
        const end = points[endIndex];

        if (!isValidCoordinate(start) || !isValidCoordinate(end)) continue;

        for (let index = startIndex + 1; index < endIndex; index += 1) {
            if (!isValidCoordinate(points[index])) continue;

            maximum = Math.max(
                maximum,
                pointToSegmentDistanceMeters(points[index], start, end)
            );
        }
    }

    return maximum;
}

function haversineDistanceMeters(start, end) {

    const startLatitude = start.latitude * DEGREES_TO_RADIANS;
    const endLatitude = end.latitude * DEGREES_TO_RADIANS;
    const latitudeDelta = endLatitude - startLatitude;
    const longitudeDelta = normalizeLongitudeDelta(
        end.longitude - start.longitude
    ) * DEGREES_TO_RADIANS;
    const sinLatitude = Math.sin(latitudeDelta / 2);
    const sinLongitude = Math.sin(longitudeDelta / 2);
    const value = sinLatitude * sinLatitude +
        Math.cos(startLatitude) * Math.cos(endLatitude) *
        sinLongitude * sinLongitude;

    return 2 * EARTH_RADIUS_METERS * Math.atan2(
        Math.sqrt(value),
        Math.sqrt(Math.max(0, 1 - value))
    );
}

function normalizeLongitudeDelta(value) {

    return ((value + 540) % 360) - 180;
}
