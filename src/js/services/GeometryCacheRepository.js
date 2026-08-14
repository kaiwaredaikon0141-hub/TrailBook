import TrackDiscoveryEntry from "../models/TrackDiscoveryEntry.js";
import { isUsableDiscoveryName } from "../utils/DiscoveryName.js";

class IndexedDBGeometryAdapter {

    constructor(config, indexedDBFactory) {

        this.config = config;
        this.indexedDB = indexedDBFactory;
        this.databasePromise = null;
    }

    async get(key) {

        return this.#request("readonly", store => store.get(key));
    }

    async set(key, value) {

        await this.#request("readwrite", store => store.put(value, key));
    }

    async delete(key) {

        await this.#request("readwrite", store => store.delete(key));
    }

    #open() {

        if (!this.indexedDB || typeof this.indexedDB.open !== "function") {
            return Promise.reject(new Error("IndexedDB is not available."));
        }

        if (!this.databasePromise) {
            this.databasePromise = new Promise((resolve, reject) => {
                const request = this.indexedDB.open(
                    this.config.databaseName,
                    this.config.databaseVersion
                );

                request.onupgradeneeded = () => {
                    const database = request.result;

                    if (!database.objectStoreNames.contains(
                        this.config.objectStoreName
                    )) {
                        database.createObjectStore(
                            this.config.objectStoreName
                        );
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                request.onblocked = () => reject(
                    new Error("IndexedDB upgrade is blocked.")
                );
            }).catch(error => {
                this.databasePromise = null;
                throw error;
            });
        }

        return this.databasePromise;
    }

    async #request(mode, operation) {

        const database = await this.#open();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(
                this.config.objectStoreName,
                mode
            );
            const request = operation(
                transaction.objectStore(this.config.objectStoreName)
            );
            let result = null;

            request.onsuccess = () => {
                result = request.result ?? null;
            };
            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(transaction.error);
        });
    }
}

function isCoordinate(point) {

    return Boolean(
        point &&
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        point.latitude >= -90 &&
        point.latitude <= 90 &&
        point.longitude >= -180 &&
        point.longitude <= 180
    );
}

function copyPoints(points) {

    if (!Array.isArray(points) || points.length === 0) {
        return null;
    }

    const copied = [];

    for (const point of points) {
        if (!isCoordinate(point)) {
            return null;
        }

        copied.push({
            latitude: point.latitude,
            longitude: point.longitude
        });
    }

    return copied;
}

function copyGeometry(result) {

    if (!result || !Array.isArray(result.tracks) ||
        !Array.isArray(result.waypoints)) {
        return null;
    }

    const tracks = [];

    for (const track of result.tracks) {
        if (!track || !Array.isArray(track.segments)) {
            return null;
        }

        const segments = [];

        for (const segment of track.segments) {
            const points = copyPoints(segment?.points);

            if (!points) {
                return null;
            }

            segments.push({ points });
        }

        if (segments.length === 0) {
            return null;
        }

        tracks.push({ segments });
    }

    const waypoints = [];

    for (const waypoint of result.waypoints) {
        if (!isCoordinate(waypoint)) {
            return null;
        }

        waypoints.push({
            latitude: waypoint.latitude,
            longitude: waypoint.longitude
        });
    }

    return { tracks, waypoints };
}

/**
 * Stores regenerable drawing geometry in origin-local IndexedDB.
 */
export default class GeometryCacheRepository {

    constructor(config, {
        indexedDBFactory = globalThis.indexedDB,
        adapter = null
    } = {}) {

        this.config = config;
        this.adapter = adapter ?? new IndexedDBGeometryAdapter(
            config,
            indexedDBFactory
        );
    }

    async get(namespace, path, file) {

        const bundle = await this.getWithSummary(namespace, path, file);

        return bundle?.result || null;
    }

    async getSummary(namespace, path, file) {

        const key = this.#key(namespace, path);

        if (!key || !this.#isFileIdentity(file)) {
            return null;
        }

        try {
            const record = await this.adapter.get(key);

            if (!this.#isValidRecord(record, namespace, path, file)) {
                if (record) {
                    await this.#deleteQuietly(key);
                }
                return null;
            }

            const summary = TrackDiscoveryEntry.fromRecord(record.summary);

            if (!this.#isValidSummary(summary, path, file)) {
                await this.#deleteQuietly(key);
                return null;
            }

            return summary;
        } catch {
            return null;
        }
    }

    async getWithSummary(namespace, path, file) {

        const key = this.#key(namespace, path);

        if (!key || !this.#isFileIdentity(file)) {
            return null;
        }

        try {
            const record = await this.adapter.get(key);

            if (!this.#isValidRecord(record, namespace, path, file)) {
                if (record) {
                    await this.#deleteQuietly(key);
                }
                return null;
            }

            const geometry = copyGeometry(record.geometry);

            if (!geometry) {
                await this.#deleteQuietly(key);
                return null;
            }

            const summary = TrackDiscoveryEntry.fromRecord(record.summary);

            if (!this.#isValidSummary(summary, path, file)) {
                await this.#deleteQuietly(key);
                return null;
            }

            return {
                result: {
                    metadata: null,
                    tracks: geometry.tracks,
                    waypoints: geometry.waypoints,
                    warnings: []
                },
                summary
            };
        } catch {
            return null;
        }
    }

    async set(namespace, path, file, result, summary) {

        const key = this.#key(namespace, path);
        const geometry = copyGeometry(result);
        const summaryRecord = summary instanceof TrackDiscoveryEntry
            ? summary.toRecord()
            : TrackDiscoveryEntry.fromRecord(summary)?.toRecord();

        if (
            !key ||
            !this.#isFileIdentity(file) ||
            !geometry ||
            !summaryRecord ||
            summaryRecord.relativePath !== path
        ) {
            return false;
        }

        const record = {
            cacheSchemaVersion: this.config.cacheSchemaVersion,
            parserSchemaVersion: this.config.parserSchemaVersion,
            textDecoderSchemaVersion: this.config.textDecoderSchemaVersion,
            namespace,
            path,
            size: file.size,
            lastModified: file.lastModified,
            geometry,
            summary: summaryRecord
        };

        try {
            await this.adapter.set(key, record);
            return true;
        } catch {
            return false;
        }
    }

    async invalidate(namespace, path) {

        const key = this.#key(namespace, path);

        if (!key) return false;

        try {
            await this.adapter.delete(key);
            return true;
        } catch {
            return false;
        }
    }

    #key(namespace, path) {

        if (typeof namespace !== "string" || namespace.length === 0 ||
            typeof path !== "string" || path.length === 0) {
            return null;
        }

        return JSON.stringify([namespace, path]);
    }

    #isFileIdentity(file) {

        return Boolean(
            file &&
            Number.isFinite(file.size) &&
            file.size >= 0 &&
            Number.isFinite(file.lastModified) &&
            file.lastModified >= 0
        );
    }

    #isValidRecord(record, namespace, path, file) {

        return Boolean(
            record &&
            record.cacheSchemaVersion === this.config.cacheSchemaVersion &&
            record.parserSchemaVersion === this.config.parserSchemaVersion &&
            record.textDecoderSchemaVersion ===
                this.config.textDecoderSchemaVersion &&
            record.namespace === namespace &&
            record.path === path &&
            record.size === file.size &&
            record.lastModified === file.lastModified
        );
    }

    #isValidSummary(summary, path, file) {

        return Boolean(
            summary &&
            summary.relativePath === path &&
            summary.fileSize === file.size &&
            summary.lastModified === file.lastModified &&
            isUsableDiscoveryName(summary.displayName) &&
            summary.trackNames.every(isUsableDiscoveryName)
        );
    }

    async #deleteQuietly(key) {

        try {
            await this.adapter.delete(key);
        } catch {
            // A broken cache entry remains non-fatal and is ignored.
        }
    }
}
