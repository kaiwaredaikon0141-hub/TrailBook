import TrackPointEditingService from "./TrackPointEditingService.js";
import TrackTranslationService, {
    ZERO_TRACK_TRANSLATION
} from "./TrackTranslationService.js";

const DEFAULT_ADD_HIT_TOLERANCE_PX = 15;

/**
 * Owns source-indexed deletion and source-independent added Track Points.
 */
export default class TrackPointMutationService {

    constructor({
        pointEditing = new TrackPointEditingService(),
        translation = new TrackTranslationService()
    } = {}) {

        this.pointEditing = pointEditing;
        this.translation = translation;
    }

    isAddedIdentity(identity) {

        return typeof identity?.addedPointId === "string" &&
            identity.addedPointId.length > 0;
    }

    normalizeIdentity(identity) {

        if (!this.isAddedIdentity(identity)) {
            return this.pointEditing.normalizeIdentity(identity);
        }

        const normalized = {
            addedPointId: identity.addedPointId,
            trackIndex: Number(identity.trackIndex),
            segmentIndex: Number(identity.segmentIndex)
        };

        if (
            !Number.isInteger(normalized.trackIndex) || normalized.trackIndex < 0 ||
            !Number.isInteger(normalized.segmentIndex) || normalized.segmentIndex < 0
        ) {
            throw new TypeError("Added Track Point identity is invalid");
        }

        return Object.freeze(normalized);
    }

    key(identity) {

        const normalized = this.normalizeIdentity(identity);

        return this.isAddedIdentity(normalized)
            ? `added:${normalized.addedPointId}`
            : `source:${this.pointEditing.key(normalized)}`;
    }

    normalizeAddedPoints(points = []) {

        if (!Array.isArray(points)) {
            throw new TypeError("Added Track Points must be an array");
        }

        const unique = new Map();

        points.forEach(point => {
            const identity = this.normalizeIdentity(point);

            if (!this.isAddedIdentity(identity)) {
                throw new TypeError("Added Track Point ID is required");
            }

            const insertionPosition = Number(point.insertionPosition);
            const coordinate = this.pointEditing.normalizeCoordinate(point);

            if (!Number.isFinite(insertionPosition) || insertionPosition < 0) {
                throw new TypeError("Added Track Point insertion position is invalid");
            }

            unique.set(identity.addedPointId, Object.freeze({
                ...identity,
                insertionPosition,
                ...coordinate
            }));
        });

        return Object.freeze([...unique.values()].sort((left, right) =>
            left.trackIndex - right.trackIndex ||
            left.segmentIndex - right.segmentIndex ||
            left.insertionPosition - right.insertionPosition ||
            left.addedPointId.localeCompare(right.addedPointId)
        ));
    }

    normalizeDeletedPoints(points = []) {

        if (!Array.isArray(points)) {
            throw new TypeError("Deleted Track Points must be an array");
        }

        const unique = new Map();

        points.forEach(point => {
            const identity = this.pointEditing.normalizeIdentity(point);

            unique.set(this.pointEditing.key(identity), identity);
        });

        return Object.freeze([...unique.values()].sort((left, right) =>
            left.trackIndex - right.trackIndex ||
            left.segmentIndex - right.segmentIndex ||
            left.pointIndex - right.pointIndex
        ));
    }

    getAddedPoint(points, identity) {

        const normalized = this.normalizeIdentity(identity);

        if (!this.isAddedIdentity(normalized)) return null;

        return this.normalizeAddedPoints(points).find(
            point => point.addedPointId === normalized.addedPointId
        ) || null;
    }

    getSegmentVertices({
        source,
        retainedPointMasks,
        pointEdits = [],
        deletedPoints = [],
        addedPoints = [],
        trackIndex,
        segmentIndex,
        translation = null
    }) {

        const segment = source?.tracks?.[trackIndex]?.segments?.[segmentIndex];

        if (!segment) return Object.freeze([]);

        const mask = retainedPointMasks?.[trackIndex]?.[segmentIndex] || null;
        const deleted = new Set(this.normalizeDeletedPoints(deletedPoints).map(
            identity => this.pointEditing.key(identity)
        ));
        const vertices = [];

        segment.points.forEach((point, pointIndex) => {
            const identity = { trackIndex, segmentIndex, pointIndex };

            if (mask && !mask[pointIndex]) return;
            if (deleted.has(this.pointEditing.key(identity))) return;

            let coordinate = null;

            try {
                coordinate = this.pointEditing.getEditedCoordinate(
                    source,
                    pointEdits,
                    identity
                );
            } catch {
                coordinate = null;
            }

            vertices.push(Object.freeze({
                identity: Object.freeze(identity),
                insertionPosition: pointIndex,
                coordinate: this.#translate(coordinate, translation)
            }));
        });

        this.normalizeAddedPoints(addedPoints)
            .filter(point => point.trackIndex === trackIndex &&
                point.segmentIndex === segmentIndex)
            .forEach(point => vertices.push(Object.freeze({
                identity: this.normalizeIdentity(point),
                insertionPosition: point.insertionPosition,
                coordinate: this.#translate(point, translation)
            })));

        return Object.freeze(vertices.sort((left, right) =>
            left.insertionPosition - right.insertionPosition ||
            this.key(left.identity).localeCompare(this.key(right.identity))
        ));
    }

    canDelete(source, masks, deletedPoints, addedPoints, identity) {

        const normalized = this.normalizeIdentity(identity);
        const vertices = this.getSegmentVertices({
            source,
            retainedPointMasks: masks,
            deletedPoints,
            addedPoints,
            trackIndex: normalized.trackIndex,
            segmentIndex: normalized.segmentIndex
        });
        const present = vertices.some(vertex =>
            this.key(vertex.identity) === this.key(normalized)
        );

        return !present || vertices.length > 2;
    }

    expectedPointCount(masks, deletedPoints, addedPoints, trackIndex, segmentIndex) {

        const deleted = new Set(this.normalizeDeletedPoints(deletedPoints)
            .filter(point => point.trackIndex === trackIndex &&
                point.segmentIndex === segmentIndex)
            .map(point => point.pointIndex));
        const retained = (masks?.[trackIndex]?.[segmentIndex] || [])
            .filter((included, pointIndex) => included && !deleted.has(pointIndex))
            .length;
        const added = this.normalizeAddedPoints(addedPoints).filter(
            point => point.trackIndex === trackIndex &&
                point.segmentIndex === segmentIndex
        ).length;

        return retained + added;
    }

    findInsertion(containerPoint, screenVertices, {
        maxDistancePixels = DEFAULT_ADD_HIT_TOLERANCE_PX,
        onDiagnostics = null
    } = {}) {

        const totalEdges = Math.max(0, (screenVertices?.length || 0) - 1);
        const stats = {
            totalEdges,
            evaluatedEdges: 0,
            finiteDistanceEdges: 0,
            nanDistanceEdges: 0,
            bestUpdateCount: 0
        };
        const report = () => onDiagnostics?.(Object.freeze({ ...stats }));

        if (
            !containerPoint || !Number.isFinite(containerPoint.x) ||
            !Number.isFinite(containerPoint.y) || totalEdges === 0
        ) {
            report();
            return null;
        }

        let best = null;

        for (let index = 0; index < screenVertices.length - 1; index += 1) {
            const left = screenVertices[index];
            const right = screenVertices[index + 1];

            stats.evaluatedEdges += 1;
            if (!left.containerPoint || !right.containerPoint ||
                !left.latLng || !right.latLng) {
                stats.nanDistanceEdges += 1;
                continue;
            }
            if (![left.containerPoint.x, left.containerPoint.y,
                right.containerPoint.x, right.containerPoint.y]
                .every(Number.isFinite)) {
                stats.nanDistanceEdges += 1;
                continue;
            }

            const nearest = this.#nearestPoint(
                containerPoint,
                left.containerPoint,
                right.containerPoint
            );

            if (!Number.isFinite(nearest.distance)) {
                stats.nanDistanceEdges += 1;
                continue;
            }
            stats.finiteDistanceEdges += 1;
            // Compare with the nested measurement retained by the candidate.
            if (!best || nearest.distance < best.nearest.distance) {
                best = { nearest, left, right, edgeIndex: index };
                stats.bestUpdateCount += 1;
            }
        }

        report();
        if (!best || best.nearest.distance > maxDistancePixels) return null;

        const latLng = {
            lat: best.left.latLng.lat +
                (best.right.latLng.lat - best.left.latLng.lat) *
                best.nearest.ratio,
            lng: best.left.latLng.lng +
                (best.right.latLng.lng - best.left.latLng.lng) *
                best.nearest.ratio
        };

        const insertionRatio = Math.max(
            0.000001,
            Math.min(0.999999, best.nearest.ratio)
        );

        return Object.freeze({
            trackIndex: best.left.identity.trackIndex,
            segmentIndex: best.left.identity.segmentIndex,
            nearestEdgeIndex: best.edgeIndex,
            insertionPosition: best.left.insertionPosition +
                (best.right.insertionPosition - best.left.insertionPosition) *
                insertionRatio,
            hitDistancePixels: best.nearest.distance,
            edgeStart: best.left,
            edgeEnd: best.right,
            ...this.pointEditing.normalizeCoordinate(latLng)
        });
    }

    apply(document, retainedPointMasks, deletedPoints, addedPoints) {

        const deleted = new Set(this.normalizeDeletedPoints(deletedPoints).map(
            identity => this.pointEditing.key(identity)
        ));
        const additions = this.normalizeAddedPoints(addedPoints);
        let addedCount = 0;
        let removedCount = 0;

        this.#children(document?.documentElement, "trk").forEach(
            (track, trackIndex) => {
                this.#children(track, "trkseg").forEach(
                    (segment, segmentIndex) => {
                        const sourcePoints = this.#children(segment, "trkpt");
                        const mask = retainedPointMasks[trackIndex][segmentIndex];

                        additions.filter(point => point.trackIndex === trackIndex &&
                            point.segmentIndex === segmentIndex).forEach(point => {
                            const element = document.createElementNS(
                                segment.namespaceURI || document.documentElement.namespaceURI,
                                "trkpt"
                            );
                            const referenceIndex = sourcePoints.findIndex(
                                (_, pointIndex) => pointIndex > point.insertionPosition
                            );

                            element.setAttribute("lat", this.#format(point.latitude));
                            element.setAttribute("lon", this.#format(point.longitude));
                            segment.insertBefore(
                                element,
                                referenceIndex >= 0 ? sourcePoints[referenceIndex] : null
                            );
                            addedCount += 1;
                        });

                        sourcePoints.forEach((element, pointIndex) => {
                            const key = `${trackIndex}/${segmentIndex}/${pointIndex}`;

                            if (!mask[pointIndex] || deleted.has(key)) {
                                element.remove();
                                removedCount += 1;
                            }
                        });
                    }
                );
            }
        );

        return Object.freeze({ addedCount, removedCount });
    }

    #translate(coordinate, translation) {

        if (!coordinate) return null;
        if (!translation) return this.pointEditing.normalizeCoordinate(coordinate);

        return this.translation.translateCoordinate(
            coordinate.latitude,
            coordinate.longitude,
            translation || ZERO_TRACK_TRANSLATION
        );
    }

    #nearestPoint(point, start, end) {

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
            lengthSquared
        ));
        const x = start.x + ratio * dx;
        const y = start.y + ratio * dy;

        return Object.freeze({
            x,
            y,
            ratio,
            distance: Math.hypot(point.x - x, point.y - y)
        });
    }

    #format(value) {

        return Number(value).toFixed(7);
    }

    #children(element, localName) {

        return Array.from(element?.children || []).filter(
            child => child.localName === localName
        );
    }
}

export { DEFAULT_ADD_HIT_TOLERANCE_PX };
