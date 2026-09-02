import {
    folderPathFromLibraryTrackPath,
    normalizeLibraryRelativePath
} from "./LibraryPath.js";

export { normalizeLibraryRelativePath as normalizeTrackRelativePath };

const PROVISIONAL_FIELDS = Object.freeze([
    "originalFileName", "displayName", "trackNames", "resolvedDate",
    "dateSource", "pointCount", "startTime", "endTime", "duration",
    "distance", "elevationMin", "elevationMax", "fileSize", "size",
    "lastModified", "status"
]);

export class LibraryPathCollisionError extends Error {

    constructor(canonicalPath, firstPath, secondPath) {
        super(`Library path collision: ${firstPath} / ${secondPath}`);
        this.name = "LibraryPathCollisionError";
        this.canonicalPath = canonicalPath;
        this.rawPaths = Object.freeze([firstPath, secondPath]);
    }
}

function requireLibraryIdentity(value) {

    if (typeof value !== "string" || !value) {
        throw new TypeError("Library identity is required.");
    }
    return value;
}

function requireActualFileHandle(value) {

    if (
        value?.kind !== "file" ||
        value.provisional === true ||
        typeof value.getFile !== "function"
    ) {
        throw new TypeError("An actual FileSystemFileHandle is required.");
    }
    return value;
}

function copyPlainValue(value) {

    if (
        value === null || typeof value === "string" ||
        typeof value === "number" || typeof value === "boolean"
    ) return value;
    if (Array.isArray(value) && value.every(item =>
        item === null || ["string", "number", "boolean"].includes(typeof item)
    )) return Object.freeze([...value]);
    return undefined;
}

function createProvisionalMetadata(value, relativePath) {

    const result = {
        relativePath,
        folderPath: folderPathFromLibraryTrackPath(relativePath)
    };

    if (value && typeof value === "object") {
        PROVISIONAL_FIELDS.forEach(field => {
            const copied = copyPlainValue(value[field]);

            if (copied !== undefined) result[field] = copied;
        });
    }
    return Object.freeze(result);
}

function createEntry({
    relativePath,
    actualFileHandle = null,
    provisionalMetadata = null,
    actualMetadata = null
}) {

    const metadataSource = actualMetadata
        ? "actual"
        : provisionalMetadata
            ? "provisional"
            : "none";

    return Object.freeze({
        relativePath,
        folderPath: folderPathFromLibraryTrackPath(relativePath),
        exists: Boolean(actualFileHandle || provisionalMetadata),
        actualFileHandle,
        provisionalMetadata,
        actualMetadata,
        metadata: actualMetadata || provisionalMetadata,
        metadataSource
    });
}

function normalizeBatch(entries, project) {

    const normalized = new Map();
    const rawPaths = new Map();

    entries.forEach(source => {
        const rawPath = source?.relativePath ?? source?.path;
        const relativePath = normalizeLibraryRelativePath(rawPath);

        if (!relativePath) throw new TypeError("A valid relativePath is required.");
        const previousRawPath = rawPaths.get(relativePath);

        if (previousRawPath !== undefined && previousRawPath !== rawPath) {
            throw new LibraryPathCollisionError(
                relativePath,
                previousRawPath,
                rawPath
            );
        }
        rawPaths.set(relativePath, rawPath);
        normalized.set(relativePath, project(source, relativePath));
    });
    return normalized;
}

/** Shadow owner of Library-scoped Track identity and source binding. */
export default class LibraryTrackCatalog {

    constructor() {
        this.libraryIdentity = null;
        this.records = new Map();
    }

    resetForLibrary(libraryIdentity) {

        this.libraryIdentity = requireLibraryIdentity(libraryIdentity);
        this.records = new Map();
        return true;
    }

    replaceProvisional(libraryIdentity, entries = []) {

        const identity = requireLibraryIdentity(libraryIdentity);
        const next = normalizeBatch(entries, (source, relativePath) =>
            createEntry({
                relativePath,
                provisionalMetadata: createProvisionalMetadata(
                    source?.provisionalMetadata ?? source?.metadata ?? source,
                    relativePath
                )
            }));

        this.libraryIdentity = identity;
        this.records = next;
        return next.size;
    }

    replaceFromCompleteScan(
        libraryIdentity,
        entries = [],
        { metadataByPath = new Map() } = {}
    ) {

        const identity = requireLibraryIdentity(libraryIdentity);
        const sameLibrary = this.libraryIdentity === identity;
        const next = normalizeBatch(entries, (source, relativePath) => {
            const actualFileHandle = requireActualFileHandle(
                source?.actualFileHandle ?? source?.fileHandle
            );
            const previous = sameLibrary
                ? this.records.get(relativePath)
                : null;
            const hasMetadata = metadataByPath.has(relativePath);
            const actualMetadata = hasMetadata
                ? metadataByPath.get(relativePath)
                : previous?.actualFileHandle === actualFileHandle
                    ? previous.actualMetadata
                    : null;

            return createEntry({
                relativePath,
                actualFileHandle,
                provisionalMetadata: previous?.provisionalMetadata ?? null,
                actualMetadata
            });
        });

        this.libraryIdentity = identity;
        this.records = next;
        return next.size;
    }

    mergeActual(
        libraryIdentity,
        entries = [],
        { metadataByPath = new Map() } = {}
    ) {

        const identity = this.#requireCurrentLibrary(libraryIdentity, {
            allowInitialize: true
        });
        const updates = normalizeBatch(entries, (source, relativePath) => ({
            relativePath,
            actualFileHandle: requireActualFileHandle(
                source?.actualFileHandle ?? source?.fileHandle
            ),
            hasMetadata: metadataByPath.has(relativePath),
            actualMetadata: metadataByPath.get(relativePath)
        }));
        const next = new Map(this.records);

        updates.forEach(update => {
            const previous = next.get(update.relativePath);
            const actualMetadata = update.hasMetadata
                ? update.actualMetadata
                : previous?.actualFileHandle === update.actualFileHandle
                    ? previous.actualMetadata
                    : null;

            next.set(update.relativePath, createEntry({
                relativePath: update.relativePath,
                actualFileHandle: update.actualFileHandle,
                provisionalMetadata: previous?.provisionalMetadata ?? null,
                actualMetadata
            }));
        });
        this.libraryIdentity = identity;
        this.records = next;
        return updates.size;
    }

    bindActualHandle(libraryIdentity, path, handle, metadata = undefined) {

        this.#requireCurrentLibrary(libraryIdentity);
        const relativePath = normalizeLibraryRelativePath(path);
        const previous = this.records.get(relativePath);

        if (!relativePath || !previous) return false;
        const actualFileHandle = requireActualFileHandle(handle);

        this.records.set(relativePath, createEntry({
            relativePath,
            actualFileHandle,
            provisionalMetadata: previous.provisionalMetadata,
            actualMetadata: metadata === undefined ? null : metadata
        }));
        return true;
    }

    clearActualHandle(libraryIdentity, path) {

        this.#requireCurrentLibrary(libraryIdentity);
        const relativePath = normalizeLibraryRelativePath(path);
        const previous = this.records.get(relativePath);

        if (!previous?.actualFileHandle) return false;
        this.records.set(relativePath, createEntry({
            relativePath,
            provisionalMetadata: previous.provisionalMetadata
        }));
        return true;
    }

    remove(libraryIdentity, path) {
        this.#requireCurrentLibrary(libraryIdentity);
        return this.records.delete(normalizeLibraryRelativePath(path));
    }

    get(libraryIdentity, path) {
        this.#requireCurrentLibrary(libraryIdentity);
        return this.records.get(normalizeLibraryRelativePath(path)) || null;
    }

    has(libraryIdentity, path) {
        this.#requireCurrentLibrary(libraryIdentity);
        return this.records.has(normalizeLibraryRelativePath(path));
    }

    paths(libraryIdentity) {
        this.#requireCurrentLibrary(libraryIdentity);
        return [...this.records.keys()];
    }

    entries(libraryIdentity) {
        this.#requireCurrentLibrary(libraryIdentity);
        return [...this.records.values()];
    }

    getDiagnostics(libraryIdentity, libraryPaths = []) {

        this.#requireCurrentLibrary(libraryIdentity);
        const expected = new Set(libraryPaths
            .map(normalizeLibraryRelativePath)
            .filter(Boolean));
        const paths = new Set(this.records.keys());
        const entries = [...this.records.values()];

        return Object.freeze({
            libraryIdentity: this.libraryIdentity,
            pathCount: paths.size,
            actualHandleCount: entries.filter(
                item => Boolean(item.actualFileHandle)
            ).length,
            provisionalCount: entries.filter(
                item => Boolean(item.provisionalMetadata)
            ).length,
            missingFromCatalog: [...expected].filter(path => !paths.has(path)),
            extraInCatalog: [...paths].filter(path => !expected.has(path))
        });
    }

    #requireCurrentLibrary(libraryIdentity, { allowInitialize = false } = {}) {

        const identity = requireLibraryIdentity(libraryIdentity);

        if (this.libraryIdentity === null && allowInitialize) return identity;
        if (this.libraryIdentity !== identity) {
            throw new Error("Catalog update does not match the active Library.");
        }
        return identity;
    }
}
