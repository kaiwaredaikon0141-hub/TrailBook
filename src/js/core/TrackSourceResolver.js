import { normalizeLibraryRelativePath } from "./LibraryPath.js";

function unavailable(relativePath, reason) {

    return Object.freeze({
        status: "unavailable",
        relativePath,
        reason
    });
}

function isActualFileHandle(value) {

    return Boolean(
        value?.kind === "file" &&
        value.provisional !== true &&
        typeof value.getFile === "function"
    );
}

/** Resolves Viewer GPX sources exclusively from the active Library Catalog. */
export default class TrackSourceResolver {

    constructor({ catalog, getLibraryIdentity }) {

        if (!catalog || typeof catalog.get !== "function") {
            throw new TypeError("A Library Track Catalog is required.");
        }
        if (typeof getLibraryIdentity !== "function") {
            throw new TypeError("A Library identity provider is required.");
        }
        this.catalog = catalog;
        this.getLibraryIdentity = getLibraryIdentity;
    }

    resolve(path) {

        let relativePath;

        try {
            relativePath = normalizeLibraryRelativePath(path);
        } catch {
            return unavailable("", "missing");
        }
        let libraryIdentity;

        try {
            libraryIdentity = this.getLibraryIdentity();
        } catch {
            return unavailable(relativePath, "library-mismatch");
        }

        if (!relativePath) return unavailable(relativePath, "missing");
        if (
            typeof libraryIdentity !== "string" || !libraryIdentity ||
            this.catalog.libraryIdentity !== libraryIdentity
        ) return unavailable(relativePath, "library-mismatch");

        let entry;

        try {
            entry = this.catalog.get(libraryIdentity, relativePath);
        } catch {
            return unavailable(relativePath, "library-mismatch");
        }
        if (!entry) return unavailable(relativePath, "missing");
        if (!isActualFileHandle(entry.actualFileHandle)) {
            return unavailable(relativePath, "provisional-only");
        }
        return Object.freeze({
            status: "ready",
            relativePath,
            actualFileHandle: entry.actualFileHandle
        });
    }
}

export function isTrackSourceUnavailable(value) {

    return value?.status === "unavailable" &&
        ["provisional-only", "missing", "library-mismatch"]
            .includes(value.reason);
}
