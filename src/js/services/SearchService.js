import SearchEntry from "../models/SearchEntry.js";

const MAX_SEARCH_RESULTS = 100;

/**
 * Searches library metadata without reading or parsing GPX files.
 */
class SearchService {

    constructor() {

        this.index = [];
    }

    /**
     * Replaces the current library search entries.
     *
     * @param {Array<{kind: string, path: string, name: string}>} sources
     * @returns {void}
     */
    setEntries(sources) {

        this.index = sources.map(source => {
            const entry = new SearchEntry(source);

            return {
                entry,
                normalizedName: this.#normalize(entry.name),
                normalizedPath: this.#normalize(entry.path)
            };
        });
    }

    /**
     * Clears entries from the previous library.
     *
     * @returns {void}
     */
    clear() {

        this.index = [];
    }

    /**
     * Finds folders and GPX files by name or relative path.
     *
     * @param {string} query
     * @returns {{totalCount: number, results: SearchEntry[]}}
     */
    search(query) {

        const normalizedQuery = this.#normalize(query);

        if (!normalizedQuery) {
            return { totalCount: 0, results: [] };
        }

        const matches = this.index
            .map(indexEntry => ({
                entry: indexEntry.entry,
                rank: this.#getRank(indexEntry, normalizedQuery)
            }))
            .filter(result => result.rank >= 0)
            .sort((first, second) => {
                return first.rank - second.rank ||
                    first.entry.path.localeCompare(second.entry.path);
            });

        return {
            totalCount: matches.length,
            results: matches
                .slice(0, MAX_SEARCH_RESULTS)
                .map(result => result.entry)
        };
    }

    #normalize(value) {

        return String(value || "")
            .normalize("NFKC")
            .trim()
            .toLocaleLowerCase();
    }

    #getRank(indexEntry, query) {

        const name = indexEntry.normalizedName;
        const path = indexEntry.normalizedPath;

        if (name === query) {
            return 0;
        }

        if (name.startsWith(query)) {
            return 1;
        }

        if (name.includes(query)) {
            return 2;
        }

        return path.includes(query) ? 3 : -1;
    }
}

export { MAX_SEARCH_RESULTS };
export default SearchService;
