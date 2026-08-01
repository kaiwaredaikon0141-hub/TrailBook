/**
 * Future SearchEntry candidates, intentionally not instantiated in Release 0.9.
 *
 * @typedef {object} FutureSearchEntryFields
 * @property {string|null} displayName
 * @property {Date|null} recordedAt
 * @property {string|null} originalFileName
 * @property {string|null} trackName
 * @property {string|null} vehicleId
 * @property {string|null} vehicleName
 * @property {string|null} vehicleType
 * @property {string|null} vehicleColor
 */

/**
 * Searchable library metadata without FileHandle or parsed GPX content.
 */
export default class SearchEntry {

    /**
     * @param {{kind: string, path: string, name: string}} source
     */
    constructor({ kind, path, name }) {

        this.kind = kind;
        this.path = path;
        this.name = name;
    }
}
