export const EDITING_HISTORY_LIMIT = 20;

/**
 * Session-only command history for immutable retained-point snapshots.
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
            before: this.#freezeMasks(before),
            after: this.#freezeMasks(after)
        }));

        if (this.#commands.length > this.limit) {
            this.#commands.shift();
        }

        this.#cursor = this.#commands.length;
    }

    undo() {

        if (!this.canUndo) return null;

        this.#cursor -= 1;
        return this.#cloneMasks(this.#commands[this.#cursor].before);
    }

    redo() {

        if (!this.canRedo) return null;

        const command = this.#commands[this.#cursor];
        this.#cursor += 1;
        return this.#cloneMasks(command.after);
    }

    clear() {

        this.#commands = [];
        this.#cursor = 0;
    }

    #freezeMasks(masks) {

        return Object.freeze(masks.map(
            track => Object.freeze(track.map(
                segment => Object.freeze([...segment])
            ))
        ));
    }

    #cloneMasks(masks) {

        return masks.map(track => track.map(segment => [...segment]));
    }
}
