/**
 * Metadata extracted from a GPX document.
 */
export default class Metadata {

    /**
     * @param {string|null} sourceFileName
     */
    constructor(sourceFileName = null) {

        this.name = null;
        this.description = null;
        this.time = null;
        this.keywords = null;
        this.creator = null;
        this.version = null;
        this.sourceFileName = sourceFileName;
    }

}