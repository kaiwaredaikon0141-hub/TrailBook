export const EDITING_HISTORY_LIMIT = 20;

/**
 * Session-only command history for compact editing-state snapshots.
 */
export default class EditingCommandHistory {

    #commands = [];
    #cursor = 0;

    constructor(limit = EDITING_HISTORY_LIMIT) {

        if (!Number.isInteger(limit) || limit < 1) {
            throw new TypeError("Editing history limit must be a positive integer");
        }

        this.limit = limit;
    }

    get length() {

        return this.#commands.length;
    }

    get canUndo() {

        return this.#cursor > 0;
    }

    get canRedo() {

        return this.#cursor < this.#commands.length;
    }

    record({ type, before, after }) {

        this.#commands.splice(this.#cursor);
        this.#commands.push(Object.freeze({
            type,
            before: this.#freezeState(before),
            after: this.#freezeState(after)
        }));

        if (this.#commands.length > this.limit) {
            this.#commands.shift();
        }

        this.#cursor = this.#commands.length;
    }

    undo() {

        if (!this.canUndo) return null;

        this.#cursor -= 1;
        return this.#cloneState(this.#commands[this.#cursor].before);
    }

    redo() {

        if (!this.canRedo) return null;

        const command = this.#commands[this.#cursor];
        this.#cursor += 1;
        return this.#cloneState(command.after);
    }

    clear() {

        this.#commands = [];
        this.#cursor = 0;
    }

    #freezeState(state) {

        return Object.freeze({
            retainedPointMasks: this.#freezeMasks(state.retainedPointMasks),
            timeOffsetMs: state.timeOffsetMs,
            desiredFileName: state.desiredFileName,
            translation: Object.freeze({ ...state.translation }),
            pointEdits: this.#freezePointEdits(state.pointEdits),
            deletedPoints: this.#freezePointEdits(state.deletedPoints),
            addedPoints: this.#freezePointEdits(state.addedPoints)
        });
    }

    #freezeMasks(masks) {

        return Object.freeze(masks.map(
            track => Object.freeze(track.map(
                segment => Object.freeze([...segment])
            ))
        ));
    }

    #cloneState(state) {

        return {
            retainedPointMasks: this.#cloneMasks(state.retainedPointMasks),
            timeOffsetMs: state.timeOffsetMs,
            desiredFileName: state.desiredFileName,
            translation: { ...state.translation },
            pointEdits: this.#clonePointEdits(state.pointEdits),
            deletedPoints: this.#clonePointEdits(state.deletedPoints),
            addedPoints: this.#clonePointEdits(state.addedPoints)
        };
    }

    #cloneMasks(masks) {

        return masks.map(track => track.map(segment => [...segment]));
    }

    #freezePointEdits(edits = []) {

        return Object.freeze(edits.map(edit => Object.freeze({ ...edit })));
    }

    #clonePointEdits(edits = []) {

        return edits.map(edit => ({ ...edit }));
    }
}
