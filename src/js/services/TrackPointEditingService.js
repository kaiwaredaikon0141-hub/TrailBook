import TrackTranslationService, {
    ZERO_TRACK_TRANSLATION
} from "./TrackTranslationService.js";

const COORDINATE_EPSILON = 1e-12;

/**
 * Resolves source-indexed Track Point edits and their displayed coordinates.
 */
export default class TrackPointEditingService {

    constructor({
        translationService = new TrackTranslationService()
    } = {}) {

        this.translationService = translationService;
    }

    normalizeIdentity(identity) {

        const normalized = {
            trackIndex: Number(identity?.trackIndex),
            segmentIndex: Number(identity?.segmentIndex),
            pointIndex: Number(identity?.pointIndex)
        };

        if (Object.values(normalized).some(
            value => !Number.isInteger(value) || value < 0
        )) {
            throw new TypeError("Track Point identity is invalid");
        }

        return Object.freeze(normalized);
    }

    key(identity) {

        const value = this.normalizeIdentity(identity);

        return `${value.trackIndex}/${value.segmentIndex}/${value.pointIndex}`;
    }

    normalizeCoordinate(value) {

        const latitude = Number(value?.latitude ?? value?.lat);
        const longitude = Number(value?.longitude ?? value?.lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new TypeError("Track Point coordinate is invalid");
        }

        return Object.freeze({
            latitude: Math.max(-90, Math.min(90, latitude)),
            longitude: this.#wrapLongitude(longitude)
        });
    }

    normalizeEdits(edits = []) {

        if (!Array.isArray(edits)) {
            throw new TypeError("Track Point edits must be an array");
        }

        const normalized = new Map();

        edits.forEach(edit => {
            const identity = this.normalizeIdentity(edit);
            const coordinate = this.normalizeCoordinate(edit);

            normalized.set(this.key(identity), Object.freeze({
                ...identity,
                ...coordinate
            }));
        });

        return Object.freeze([...normalized.values()]);
    }

    getSourcePoint(source, identity) {

        const value = this.normalizeIdentity(identity);
        const point = source?.tracks?.[value.trackIndex]
            ?.segments?.[value.segmentIndex]?.points?.[value.pointIndex];

        if (!point) throw new TypeError("Track Point identity is out of range");

        return this.normalizeCoordinate(point);
    }

    getEditedCoordinate(source, edits, identity) {

        const key = this.key(identity);
        const edit = this.normalizeEdits(edits).find(
            candidate => this.key(candidate) === key
        );

        return edit
            ? this.normalizeCoordinate(edit)
            : this.getSourcePoint(source, identity);
    }

    getDisplayedCoordinate(
        source,
        edits,
        identity,
        translation = ZERO_TRACK_TRANSLATION
    ) {

        const sourceCoordinate = this.getEditedCoordinate(
            source,
            edits,
            identity
        );

        return this.translationService.translateCoordinate(
            sourceCoordinate.latitude,
            sourceCoordinate.longitude,
            translation
        );
    }

    toSourceCoordinate(displayedCoordinate, translation) {

        const displayed = this.normalizeCoordinate(displayedCoordinate);
        const offset = this.translationService.normalize(translation);

        return this.normalizeCoordinate({
            latitude: displayed.latitude - offset.latitudeDelta,
            longitude: displayed.longitude - offset.longitudeDelta
        });
    }

    calculateFromDrag(map, startPoint, endPoint, initialCoordinate) {

        if (!map?.project || !map?.unproject) {
            throw new TypeError("A project-capable Leaflet Map is required");
        }

        const start = this.#point(startPoint);
        const end = this.#point(endPoint);
        const coordinate = this.normalizeCoordinate(initialCoordinate);
        const zoom = map.getZoom?.();
        const projected = map.project({
            lat: coordinate.latitude,
            lng: coordinate.longitude
        }, zoom);
        const moved = map.unproject({
            x: projected.x + end.x - start.x,
            y: projected.y + end.y - start.y
        }, zoom);

        return this.normalizeCoordinate(moved);
    }

    coordinatesEqual(left, right) {

        const first = this.normalizeCoordinate(left);
        const second = this.normalizeCoordinate(right);

        return Math.abs(first.latitude - second.latitude) < COORDINATE_EPSILON &&
            Math.abs(first.longitude - second.longitude) < COORDINATE_EPSILON;
    }

    apply(document, edits, retainedPointMasks = null) {

        const normalized = this.normalizeEdits(edits);

        if (normalized.length === 0) return 0;

        const editsByKey = new Map(normalized.map(
            edit => [this.key(edit), edit]
        ));
        let changed = 0;

        this.#children(document?.documentElement, "trk").forEach(
            (track, trackIndex) => {
                this.#children(track, "trkseg").forEach(
                    (segment, segmentIndex) => {
                        this.#children(segment, "trkpt").forEach(
                            (point, pointIndex) => {
                                if (retainedPointMasks?.[trackIndex]
                                    ?.[segmentIndex]?.[pointIndex] === false) {
                                    return;
                                }
                                const edit = editsByKey.get(
                                    `${trackIndex}/${segmentIndex}/${pointIndex}`
                                );

                                if (!edit) return;

                                point.setAttribute(
                                    "lat",
                                    this.#formatCoordinate(
                                        edit.latitude,
                                        point.getAttribute("lat")
                                    )
                                );
                                point.setAttribute(
                                    "lon",
                                    this.#formatCoordinate(
                                        edit.longitude,
                                        point.getAttribute("lon")
                                    )
                                );
                                changed += 1;
                            }
                        );
                    }
                );
            }
        );

        return changed;
    }

    #formatCoordinate(value, original) {

        const match = /\.(\d+)/.exec(String(original || ""));
        const precision = Math.max(7, match?.[1]?.length || 0);

        return value.toFixed(Math.min(precision, 15));
    }

    #wrapLongitude(value) {

        let normalized = value;

        while (normalized > 180) normalized -= 360;
        while (normalized < -180) normalized += 360;
        return normalized;
    }

    #point(value) {

        if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) {
            throw new TypeError("Drag points must contain finite x/y values");
        }

        return value;
    }

    #children(element, localName) {

        return Array.from(element?.children || []).filter(
            child => child.localName === localName
        );
    }
}

export { COORDINATE_EPSILON };
