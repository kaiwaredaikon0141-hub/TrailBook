/**
 * A GPX track containing independent segments.
 */
export default class Track {

    /**
     * @param {string|null} name
     */
    constructor(name = null) {

        this.name = name;
        this.segments = [];
    }

}