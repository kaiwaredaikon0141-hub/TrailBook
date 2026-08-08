import {
    MAX_SEARCH_RESULTS,
    normalizeSearchText
} from "./SearchService.js";

const MAX_FILTER_RESULTS = MAX_SEARCH_RESULTS;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value) {

    const candidate = String(value || "").trim();
    const match = DATE_PATTERN.exec(candidate);

    if (!match) return "";

    const [year, month, day] = candidate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
        ? candidate
        : "";
}

function localDateKey(date) {

    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        return null;
    }

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

/**
 * Applies text and inclusive local-calendar date filters to Discovery entries.
 */
export default class DiscoveryFilterService {

    normalize(filter = {}) {

        const from = normalizeDate(filter.from);
        const to = normalizeDate(filter.to);

        return Object.freeze({
            query: String(filter.query || ""),
            from,
            to
        });
    }

    isActive(filter = {}) {

        const normalized = this.normalize(filter);

        return Boolean(
            normalizeSearchText(normalized.query) || normalized.from || normalized.to
        );
    }

    filter(entries = [], filter = {}) {

        const normalized = this.normalize(filter);
        const query = normalizeSearchText(normalized.query);
        if (normalized.from && normalized.to && normalized.from > normalized.to) {
            return {
                filter: normalized,
                totalCount: 0,
                entries: [],
                results: []
            };
        }
        const matches = entries.filter(entry => {
            const textMatches = !query || this.#getTextRank(entry, query) >= 0;

            if (!textMatches) {
                return false;
            }

            if (!normalized.from && !normalized.to) {
                return true;
            }

            const dateKey = localDateKey(entry.resolvedDate);

            return Boolean(
                dateKey &&
                (!normalized.from || dateKey >= normalized.from) &&
                (!normalized.to || dateKey <= normalized.to)
            );
        });

        matches.sort((first, second) => {
            const firstName = normalizeSearchText(first.displayName);
            const secondName = normalizeSearchText(second.displayName);
            const firstRank = query ? this.#getTextRank(first, query) : 0;
            const secondRank = query ? this.#getTextRank(second, query) : 0;

            return firstRank - secondRank ||
                firstName.localeCompare(secondName) ||
                first.relativePath.localeCompare(second.relativePath);
        });

        return {
            filter: normalized,
            totalCount: matches.length,
            entries: matches,
            results: matches.slice(0, MAX_FILTER_RESULTS)
        };
    }

    #getTextRank(entry, query) {

        const names = [entry.displayName, ...(entry.trackNames || [])]
            .map(normalizeSearchText);

        if (names.some(name => name === query)) return 0;
        if (names.some(name => name.startsWith(query))) return 1;
        if (names.some(name => name.includes(query))) return 2;

        return normalizeSearchText(entry.folderPath).includes(query) ? 3 : -1;
    }
}

export { MAX_FILTER_RESULTS, localDateKey };
