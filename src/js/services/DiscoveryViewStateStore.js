const MODES = new Set(["folder", "date"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUERY_LENGTH = 500;
const MAX_LIBRARY_FILTERS = 100;

function cleanFilter(value = {}) {

    return {
        query: typeof value.query === "string"
            ? value.query.slice(0, MAX_QUERY_LENGTH)
            : "",
        from: DATE_PATTERN.test(value.from) ? value.from : "",
        to: DATE_PATTERN.test(value.to) ? value.to : ""
    };
}

function defaultStorage() {

    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/**
 * Persists device-local Discovery view mode and per-Library filter state.
 */
export default class DiscoveryViewStateStore {

    constructor({
        storage = defaultStorage(),
        storageKey = "trailbook.discoveryView",
        schemaVersion = 1
    } = {}) {

        this.storage = storage;
        this.storageKey = storageKey;
        this.schemaVersion = schemaVersion;
        this.mode = "folder";
        this.activeLibraryId = null;
        this.filters = new Map();
        this.#load();
    }

    getMode() {

        return this.mode;
    }

    setMode(mode) {

        if (!MODES.has(mode) || mode === this.mode) {
            return false;
        }

        this.mode = mode;
        this.#save();

        return true;
    }

    setActiveLibrary(libraryId) {

        this.activeLibraryId = typeof libraryId === "string" && libraryId
            ? libraryId
            : null;

        return this.getFilter();
    }

    getFilter() {

        return cleanFilter(this.filters.get(this.activeLibraryId));
    }

    setFilter(filter) {

        if (!this.activeLibraryId) {
            return false;
        }

        const normalized = cleanFilter(filter);

        if (normalized.query || normalized.from || normalized.to) {
            this.filters.delete(this.activeLibraryId);
            this.filters.set(this.activeLibraryId, normalized);
        } else {
            this.filters.delete(this.activeLibraryId);
        }

        while (this.filters.size > MAX_LIBRARY_FILTERS) {
            this.filters.delete(this.filters.keys().next().value);
        }

        this.#save();
        return true;
    }

    #save() {

        try {
            this.storage?.setItem(this.storageKey, JSON.stringify({
                version: this.schemaVersion,
                mode: this.mode,
                filters: Object.fromEntries(this.filters)
            }));
        } catch {
            this.storage = null;
        }
    }

    #load() {

        try {
            const raw = this.storage?.getItem(this.storageKey);

            if (!raw) {
                return;
            }

            const value = JSON.parse(raw);

            if (
                value?.version === this.schemaVersion &&
                MODES.has(value.mode)
            ) {
                this.mode = value.mode;
                Object.entries(value.filters || {}).forEach(([id, filter]) => {
                    if (this.filters.size >= MAX_LIBRARY_FILTERS) return;
                    if (id && filter && typeof filter === "object") {
                        const normalized = cleanFilter(filter);
                        if (normalized.query || normalized.from || normalized.to) {
                            this.filters.set(id, normalized);
                        }
                    }
                });
            }
        } catch {
            this.storage = null;
        }
    }
}
