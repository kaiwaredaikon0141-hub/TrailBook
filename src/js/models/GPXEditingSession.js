import EditingCommandHistory from "../state/EditingCommandHistory.js";

/**
 * Owns one GPX editing working copy without mutating its source.
 */
export default class GPXEditingSession {

    #retainedPointMasks;
    #history;
    #preview = null;
    #isActive = true;

    constructor(source, { history = new EditingCommandHistory() } = {}) {

        if (!source?.tracks) {
            throw new TypeError("A mapped GPX editing source is required");
        }

        this.source = source;
        this.#history = history;
        this.#retainedPointMasks = this.#createSourceMasks();
    }

    get isActive() {

        return this.#isActive;
    }

    get isDirty() {

        return !this.#masksEqual(
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

        return this.#isActive && this.#preview !== null;
    }

    getRetainedPointMasks() {

        return this.#cloneMasks(this.#retainedPointMasks);
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
    }

    applyPreview() {

        this.#assertActive();

        if (!this.#preview) return false;

        const changed = this.applyRetainedPointMasks(
            this.#preview.retainedPointMasks,
            "simplify"
        );
        this.#preview = null;

        return changed;
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
            before: this.#retainedPointMasks,
            after: next
        });
        this.#retainedPointMasks = next;

        return true;
    }

    undo() {

        this.#assertActive();
        const previous = this.#history.undo();

        if (!previous) return false;

        this.#preview = null;
        this.#retainedPointMasks = previous;
        return true;
    }

    redo() {

        this.#assertActive();
        const next = this.#history.redo();

        if (!next) return false;

        this.#preview = null;
        this.#retainedPointMasks = next;
        return true;
    }

    cancel() {

        this.#preview = null;
        this.#retainedPointMasks = this.#createSourceMasks();
        this.#history.clear();
        this.#isActive = false;
    }

    #createSourceMasks() {

        return this.source.tracks.map(track => track.segments.map(
            segment => segment.points.map(() => true)
        ));
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
