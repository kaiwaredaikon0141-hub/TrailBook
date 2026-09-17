const PACKAGE_STATUSES = new Set([
    "downloading", "partial", "verifying", "ready", "failed"
]);
const TILE_TYPES = new Set(["mvt", "png", "jpeg", "webp", "avif"]);
const MUTABLE_FIELDS = new Set([
    "sourceId", "version", "status", "opfsPath", "byteLength",
    "downloadedBytes", "checksum", "bounds", "minZoom", "maxZoom",
    "tileType", "attribution", "stylePackageId"
]);

function nonnegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0;
}

function optionalString(value) {
    return value === null || (typeof value === "string" && value.length > 0);
}

function validBounds(bounds) {
    return bounds &&
        [bounds.west, bounds.south, bounds.east, bounds.north]
            .every(Number.isFinite) &&
        bounds.west >= -180 && bounds.west <= 180 &&
        bounds.east >= -180 && bounds.east <= 180 &&
        bounds.south >= -90 && bounds.south <= 90 &&
        bounds.north >= -90 && bounds.north <= 90 &&
        bounds.south <= bounds.north;
}

function validatePackage(value) {
    if (typeof value?.packageId !== "string" || !value.packageId ||
        typeof value.sourceId !== "string" || !value.sourceId ||
        typeof value.version !== "string" || !value.version ||
        !PACKAGE_STATUSES.has(value.status) ||
        typeof value.opfsPath !== "string" || !value.opfsPath ||
        !(value.byteLength === null || nonnegativeInteger(value.byteLength)) ||
        !nonnegativeInteger(value.downloadedBytes) ||
        (value.byteLength !== null &&
            value.downloadedBytes > value.byteLength) ||
        !optionalString(value.checksum) || !validBounds(value.bounds) ||
        !Number.isInteger(value.minZoom) || value.minZoom < 0 ||
        !Number.isInteger(value.maxZoom) || value.maxZoom > 30 ||
        value.minZoom > value.maxZoom || !TILE_TYPES.has(value.tileType) ||
        typeof value.attribution !== "string" || !value.attribution ||
        !optionalString(value.stylePackageId)) {
        throw new TypeError("Invalid offline map package metadata.");
    }
}

function copyPackage(value) {
    return value ? { ...value, bounds: { ...value.bounds } } : value;
}

/**
 * Derives usable package state without treating IndexedDB metadata as proof
 * that an OPFS archive exists.
 */
export function evaluatePackageLifecycle(metadata, files) {
    if (!metadata) {
        return { status: "missing", ready: false, recoverable: false,
            reason: "metadata-missing", metadata: null, files };
    }
    if (metadata.status === "failed") {
        return { status: "failed", ready: false,
            recoverable: Boolean(files?.partial?.exists),
            reason: "metadata-failed", metadata, files };
    }
    if (metadata.status === "ready") {
        if (!files?.final?.exists) {
            return {
                status: files?.partial?.exists ? "partial" : "missing",
                ready: false,
                recoverable: Boolean(files?.partial?.exists),
                reason: files?.partial?.exists
                    ? "final-missing-partial-present" : "archive-missing",
                metadata, files
            };
        }
        if (metadata.byteLength !== null &&
            files.final.size !== metadata.byteLength) {
            return { status: "invalid", ready: false,
                recoverable: Boolean(files?.partial?.exists),
                reason: "archive-size-mismatch", metadata, files };
        }
        return { status: "ready", ready: true, recoverable: false,
            reason: null, metadata, files };
    }
    if (files?.partial?.exists) {
        return { status: "partial", ready: false, recoverable: true,
            reason: null, metadata, files };
    }
    return { status: "missing", ready: false, recoverable: false,
        reason: "archive-missing", metadata, files };
}

/** Stores only Offline Map Package metadata in a dedicated IndexedDB. */
export default class OfflineMapPackageRepository {

    constructor({
        databaseName = "trailbook.offlineMapPackages",
        databaseVersion = 1,
        indexedDBFactory = globalThis.indexedDB
    } = {}) {
        this.databaseName = databaseName;
        this.databaseVersion = databaseVersion;
        this.indexedDB = indexedDBFactory;
    }

    async open() {
        if (!this.indexedDB?.open) {
            throw new Error("IndexedDB is not available.");
        }
        return new Promise((resolve, reject) => {
            const request = this.indexedDB.open(
                this.databaseName, this.databaseVersion
            );
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains("packages")) {
                    request.result.createObjectStore("packages", {
                        keyPath: "packageId"
                    });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(
                new Error("Offline Map Packages IndexedDB upgrade is blocked.")
            );
        });
    }

    async #transaction(mode, operation) {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            let result;
            let failure;
            let transaction;
            try {
                transaction = database.transaction("packages", mode);
                const store = transaction.objectStore("packages");
                const abort = error => {
                    failure = error;
                    transaction.abort();
                };
                transaction.oncomplete = () => {
                    database.close();
                    resolve(result);
                };
                transaction.onabort = () => {
                    database.close();
                    reject(failure || transaction.error ||
                        new Error("Offline Map Packages transaction aborted."));
                };
                operation(store, value => { result = value; }, abort);
            } catch (error) {
                database.close();
                reject(error);
            }
        });
    }

    createPackage(value) {
        const record = copyPackage(value);
        validatePackage(record);
        return this.#transaction("readwrite", (store, done) => {
            store.add(record);
            done(record);
        }).then(copyPackage);
    }

    getPackage(packageId) {
        return this.#transaction("readonly", (store, done) => {
            const request = store.get(packageId);
            request.onsuccess = () => done(request.result ?? null);
        }).then(copyPackage);
    }

    listPackages() {
        return this.#transaction("readonly", (store, done) => {
            const request = store.getAll();
            request.onsuccess = () => done(request.result);
        }).then(values => values.map(copyPackage));
    }

    updatePackage(packageId, changes) {
        if (!changes || Object.keys(changes).some(key =>
            !MUTABLE_FIELDS.has(key))) {
            throw new TypeError("Invalid offline map package update.");
        }
        return this.#transaction("readwrite", (store, done, abort) => {
            const request = store.get(packageId);
            request.onsuccess = () => {
                if (!request.result) {
                    abort(new Error("Offline map package is missing."));
                    return;
                }
                const updated = copyPackage({ ...request.result, ...changes,
                    bounds: changes.bounds ?? request.result.bounds });
                try {
                    validatePackage(updated);
                } catch (error) {
                    abort(error);
                    return;
                }
                store.put(updated);
                done(updated);
            };
        }).then(copyPackage);
    }

    deletePackage(packageId) {
        return this.#transaction("readwrite", (store, done) => {
            const request = store.get(packageId);
            request.onsuccess = () => {
                if (!request.result) {
                    done(false);
                    return;
                }
                store.delete(packageId);
                done(true);
            };
        });
    }
}
