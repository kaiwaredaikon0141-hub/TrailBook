import EditingCommandHistory from "../state/EditingCommandHistory.js";
import TrackTranslationService, {
    ZERO_TRACK_TRANSLATION
} from "../services/TrackTranslationService.js";
import TrackPointEditingService from "../services/TrackPointEditingService.js";

/**
 * Owns one GPX editing working copy without mutating its source.
 */
export default class GPXEditingSession {

    #retainedPointMasks;
    #history;
    #preview = null;
    #isActive = true;
    #timeOffsetMs = 0;
    #desiredFileName;
    #sourceFileName;
    #translation = ZERO_TRACK_TRANSLATION;
    #translationPreview = null;
    #translationService;
    #pointEdits = [];
    #pointEditingService;

    constructor(source, {
        history = new EditingCommandHistory(),
        desiredFileName = source?.sourceFileName,
        translationService = new TrackTranslationService(),
        pointEditingService = new TrackPointEditingService({
            translationService
        })
    } = {}) {

        if (!source?.tracks) {
            throw new TypeError("A mapped GPX editing source is required");
        }

        this.source = source;
        this.#history = history;
        this.#translationService = translationService;
        this.#pointEditingService = pointEditingService;
        this.#retainedPointMasks = this.#createSourceMasks();
        this.#sourceFileName = typeof source.sourceFileName === "string"
            ? source.sourceFileName
            : "source.gpx";
        const initialFileName = desiredFileName || this.#sourceFileName;

        this.#validateFileName(initialFileName);
        this.#desiredFileName = initialFileName;
    }

    get isActive() {

        return this.#isActive;
    }

    get isDirty() {

        return this.#timeOffsetMs !== 0 ||
            this.#desiredFileName !== this.#sourceFileName ||
            !this.#translationService.isZero(this.#translation) ||
            this.#pointEdits.length > 0 ||
            !this.#masksEqual(
            this.#retainedPointMasks,
            this.#createSourceMasks()
        );
    }

    get canUndo() {

        return this.#isActive && this.#history.canUndo;
    }

    get canRedo() {

        return this.#isActive && this.#history.canRedo;
    }

    get historyLength() {

        return this.#history.length;
    }

    get hasPreview() {

        return this.#isActive &&
            (this.#preview !== null || this.#translationPreview !== null);
    }

    getRetainedPointMasks() {

        return this.#cloneMasks(this.#retainedPointMasks);
    }

    getTimeOffsetMs() {

        return this.#timeOffsetMs;
    }

    getDesiredFileName() {

        return this.#desiredFileName;
    }

    getTranslation() {

        return this.#translationService.normalize(this.#translation);
    }

    getTranslationPreview() {

        return this.#translationPreview
            ? this.#translationService.normalize(this.#translationPreview)
            : null;
    }

    getPointEdits() {

        return this.#pointEditingService.normalizeEdits(this.#pointEdits);
    }

    getPreview() {

        return this.#preview;
    }

    setPreview(preview) {

        this.#assertActive();

        if (preview?.source !== this.source) {
            throw new TypeError("The preview belongs to a different GPX source");
        }

        this.#validateMasks(preview.retainedPointMasks);
        this.#preview = Object.freeze({
            ...preview,
            retainedPointMasks: this.#freezeMasks(
                preview.retainedPointMasks
            )
        });
    }

    clearPreview() {

        this.#preview = null;
        this.#translationPreview = null;
    }

    clearSimplificationPreview() {

        this.#preview = null;
    }

    setTranslationPreview(value) {

        this.#assertActive();
        const translation = this.#translationService.normalize(value);

        this.#translationPreview = this.#translationService.isZero({
            latitudeDelta: translation.latitudeDelta - this.#translation.latitudeDelta,
            longitudeDelta: translation.longitudeDelta - this.#translation.longitudeDelta
        }) ? null : translation;

        return this.#translationPreview !== null;
    }

    applyPreview() {

        this.#assertActive();

        if (!this.#preview && !this.#translationPreview) return false;

        const nextMasks = this.#preview?.retainedPointMasks ||
            this.#retainedPointMasks;
        const nextTranslation = this.#translationPreview || this.#translation;
        const masksChanged = !this.#masksEqual(
            this.#retainedPointMasks,
            nextMasks
        );
        const translationChanged = !this.#translationEqual(
            this.#translation,
            nextTranslation
        );

        if (!masksChanged && !translationChanged) {
            this.clearPreview();
            return false;
        }

        this.#history.record({
            type: masksChanged && translationChanged
                ? "simplify-translate"
                : masksChanged ? "simplify" : "translate",
            before: this.#snapshot(),
            after: this.#snapshot(
                nextMasks,
                this.#timeOffsetMs,
                this.#desiredFileName,
                nextTranslation
            )
        });
        this.#retainedPointMasks = this.#cloneMasks(nextMasks);
        this.#translation = this.#translationService.normalize(nextTranslation);
        this.#preview = null;
        this.#translationPreview = null;

        return true;
    }

    applyRetainedPointMasks(masks, type = "edit") {

        this.#assertActive();
        this.#validateMasks(masks);

        const next = this.#cloneMasks(masks);

        if (this.#masksEqual(this.#retainedPointMasks, next)) {
            return false;
        }

        this.#history.record({
            type,
            before: this.#snapshot(),
            after: this.#snapshot(next, this.#timeOffsetMs)
        });
        this.#retainedPointMasks = next;

        return true;
    }

    applyDateOffset(offsetMs, desiredFileName = this.#desiredFileName) {

        this.#assertActive();

        if (!Number.isFinite(offsetMs)) {
            throw new TypeError("Track time offset must be finite");
        }

        this.#validateFileName(desiredFileName);

        if (
            offsetMs === this.#timeOffsetMs &&
            desiredFileName === this.#desiredFileName
        ) return false;

        this.#history.record({
            type: "date-correction",
            before: this.#snapshot(),
            after: this.#snapshot(
                this.#retainedPointMasks,
                offsetMs,
                desiredFileName
            )
        });
        this.#timeOffsetMs = offsetMs;
        this.#desiredFileName = desiredFileName;
        this.#preview = null;
        return true;
    }

    applyDesiredFileName(fileName) {

        this.#assertActive();
        this.#validateFileName(fileName);

        if (fileName === this.#desiredFileName) return false;

        this.#history.record({
            type: "filename",
            before: this.#snapshot(),
            after: this.#snapshot(
                this.#retainedPointMasks,
                this.#timeOffsetMs,
                fileName
            )
        });
        this.#desiredFileName = fileName;
        this.#preview = null;
        return true;
    }

    applyPointEdit(identity, coordinate) {

        this.#assertActive();
        const normalizedIdentity = this.#pointEditingService
            .normalizeIdentity(identity);
        const nextCoordinate = this.#pointEditingService
            .normalizeCoordinate(coordinate);
        const currentCoordinate = this.#pointEditingService.getEditedCoordinate(
            this.source,
            this.#pointEdits,
            normalizedIdentity
        );

        if (this.#pointEditingService.coordinatesEqual(
            currentCoordinate,
            nextCoordinate
        )) return false;

        const sourceCoordinate = this.#pointEditingService.getSourcePoint(
            this.source,
            normalizedIdentity
        );
        const key = this.#pointEditingService.key(normalizedIdentity);
        const byKey = new Map(this.#pointEdits.map(
            edit => [this.#pointEditingService.key(edit), edit]
        ));

        if (this.#pointEditingService.coordinatesEqual(
            sourceCoordinate,
            nextCoordinate
        )) {
            byKey.delete(key);
        } else {
            byKey.set(key, Object.freeze({
                ...normalizedIdentity,
                ...nextCoordinate
            }));
        }

        const nextEdits = this.#pointEditingService.normalizeEdits(
            [...byKey.values()]
        );

        this.#history.record({
            type: "point-move",
            before: this.#snapshot(),
            after: this.#snapshot(
                this.#retainedPointMasks,
                this.#timeOffsetMs,
                this.#desiredFileName,
                this.#translation,
                nextEdits
            )
        });
        this.#pointEdits = nextEdits;
        this.clearPreview();
        return true;
    }

    undo() {

        this.#assertActive();
        const previous = this.#history.undo();

        if (!previous) return false;

        this.#preview = null;
        this.#restore(previous);
        return true;
    }

    redo() {

        this.#assertActive();
        const next = this.#history.redo();

        if (!next) return false;

        this.#preview = null;
        this.#restore(next);
        return true;
    }

    cancel() {

        this.#preview = null;
        this.#retainedPointMasks = this.#createSourceMasks();
        this.#timeOffsetMs = 0;
        this.#desiredFileName = this.#sourceFileName;
        this.#translation = ZERO_TRACK_TRANSLATION;
        this.#translationPreview = null;
        this.#pointEdits = [];
        this.#history.clear();
        this.#isActive = false;
    }

    #createSourceMasks() {

        return this.source.tracks.map(track => track.segments.map(
            segment => segment.points.map(() => true)
        ));
    }

    #snapshot(
        retainedPointMasks = this.#retainedPointMasks,
        timeOffsetMs = this.#timeOffsetMs,
        desiredFileName = this.#desiredFileName,
        translation = this.#translation,
        pointEdits = this.#pointEdits
    ) {

        return {
            retainedPointMasks: this.#cloneMasks(retainedPointMasks),
            timeOffsetMs,
            desiredFileName,
            translation: this.#translationService.normalize(translation),
            pointEdits: this.#pointEditingService.normalizeEdits(pointEdits)
        };
    }

    #restore(state) {

        this.#retainedPointMasks = this.#cloneMasks(state.retainedPointMasks);
        this.#timeOffsetMs = state.timeOffsetMs;
        this.#desiredFileName = state.desiredFileName;
        this.#translation = this.#translationService.normalize(state.translation);
        this.#pointEdits = this.#pointEditingService.normalizeEdits(
            state.pointEdits
        );
        this.#translationPreview = null;
    }

    #translationEqual(left, right) {

        const first = this.#translationService.normalize(left);
        const second = this.#translationService.normalize(right);

        return Math.abs(first.latitudeDelta - second.latitudeDelta) < 1e-12 &&
            Math.abs(first.longitudeDelta - second.longitudeDelta) < 1e-12;
    }

    #validateFileName(fileName) {

        if (
            typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".gpx") ||
            fileName.includes("/") || fileName.includes("\\")
        ) {
            throw new TypeError("Desired GPX filename is invalid");
        }
    }

    #validateMasks(masks) {

        if (!Array.isArray(masks) || masks.length !== this.source.tracks.length) {
            throw new TypeError("Track mask structure does not match the source");
        }

        this.source.tracks.forEach((track, trackIndex) => {
            const trackMasks = masks[trackIndex];

            if (!Array.isArray(trackMasks) || trackMasks.length !== track.segments.length) {
                throw new TypeError("Segment mask structure does not match the source");
            }

            track.segments.forEach((segment, segmentIndex) => {
                const pointMask = trackMasks[segmentIndex];

                if (
                    !Array.isArray(pointMask) ||
                    pointMask.length !== segment.points.length ||
                    pointMask.some(value => typeof value !== "boolean")
                ) {
                    throw new TypeError("Point mask structure does not match the source");
                }
            });
        });
    }

    #masksEqual(left, right) {

        return left.every((track, trackIndex) => track.every(
            (segment, segmentIndex) => segment.every(
                (value, pointIndex) =>
                    value === right[trackIndex][segmentIndex][pointIndex]
            )
        ));
    }

    #cloneMasks(masks) {

        return masks.map(track => track.map(segment => [...segment]));
    }

    #freezeMasks(masks) {

        return Object.freeze(masks.map(
            track => Object.freeze(track.map(
                segment => Object.freeze([...segment])
            ))
        ));
    }

    #assertActive() {

        if (!this.#isActive) {
            throw new Error("The GPX editing session is no longer active");
        }
    }
}
