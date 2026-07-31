/**
 * A file-level GPX parsing error that cannot be recovered from.
 */
export default class GPXParseError extends Error {

    /**
     * @param {string} code
     * @param {string} message
     * @param {string|null} sourceFileName
     */
    constructor(code, message, sourceFileName = null) {

        super(message);

        this.name = "GPXParseError";

        this.code = code;

        this.sourceFileName = sourceFileName;
    }

}