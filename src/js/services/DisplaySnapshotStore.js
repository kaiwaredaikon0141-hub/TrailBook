import { normalizeLibrarySnapshot } from "./LibrarySnapshotService.js";

class IndexedDBSnapshotAdapter {

    constructor(config, indexedDBFactory) {

        this.config = config;
        this.indexedDB = indexedDBFactory;
    }

    async get(key) {

        return this.#request("readonly", store => store.get(key));
    }

    async set(key, value) {

        await this.#request("readwrite", store => store.put(value, key));
    }

    async #request(mode, operation) {

        if (!this.indexedDB?.open) {
            throw new Error("IndexedDB is not available.");
        }

        const database = await new Promise((resolve, reject) => {
            const request = this.indexedDB.open(
                this.config.databaseName,
                this.config.databaseVersion
            );

            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(
                    this.config.objectStoreName
                )) {
                    request.result.createObjectStore(
                        this.config.objectStoreName
                    );
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        try {
            return await new Promise((resolve, reject) => {
                const transaction = database.transaction(
                    this.config.objectStoreName,
                    mode
                );
                const request = operation(transaction.objectStore(
                    this.config.objectStoreName
                ));
                let result = null;

                request.onsuccess = () => {
                    result = request.result ?? null;
                };
                request.onerror = () => reject(request.error);
                transaction.oncomplete = () => resolve(result);
                transaction.onabort = () => reject(transaction.error);
            });
        } finally {
            database.close();
        }
    }
}

function isPath(value) {

    return typeof value === "string" && value.trim().length > 0;
}

function normalizeSnapshot(value, schemaVersion) {

    if (
        !value ||
        value.schemaVersion !== schemaVersion ||
        !isPath(value.libraryIdentity) ||
        !isPath(value.cacheNamespace) ||
        !Array.isArray(value.visibleTracks)
    ) {
        return null;
    }

    const visibleTracks = value.visibleTracks.filter(track =>
        isPath(track?.relativePath) &&
        track.geometryCacheKey?.namespace === value.cacheNamespace &&
        track.geometryCacheKey?.relativePath === track.relativePath
    ).map(track => ({
        relativePath: track.relativePath,
        trackIdentity: track.trackIdentity ?? null,
        geometryCacheKey: {
            namespace: value.cacheNamespace,
            relativePath: track.relativePath
        },
        displayStyle: {
            color: typeof track.displayStyle?.color === "string"
                ? track.displayStyle.color
                : null
        }
    }));

    return {
        schemaVersion,
        revision: Number.isInteger(value.revision) && value.revision >= 0
            ? value.revision
            : 0,
        libraryIdentity: value.libraryIdentity,
        cacheNamespace: value.cacheNamespace,
        savedAt: Number.isFinite(value.savedAt) ? value.savedAt : 0,
        map: value.map ?? null,
        visibleTracks,
        selectedTrack: isPath(value.selectedTrack?.relativePath)
            ? {
                relativePath: value.selectedTrack.relativePath,
                trackIdentity: value.selectedTrack.trackIdentity ?? null
            }
            : null,
        sidebarState: value.sidebarState ?? null,
        library: normalizeLibrarySnapshot(
            value.library,
            value.libraryIdentity
        )
    };
}

/** Stores the latest regenerable display snapshot in origin-local IndexedDB. */
export default class DisplaySnapshotStore {

    constructor(config, {
        indexedDBFactory = globalThis.indexedDB,
        adapter = null
    } = {}) {

        this.config = config;
        this.adapter = adapter ?? new IndexedDBSnapshotAdapter(
            config,
            indexedDBFactory
        );
    }

    async load() {

        try {
            return normalizeSnapshot(
                await this.adapter.get(this.config.recordKey),
                this.config.schemaVersion
            );
        } catch {
            return null;
        }
    }

    async save(snapshot) {

        const normalized = normalizeSnapshot(
            snapshot,
            this.config.schemaVersion
        );

        if (!normalized) return false;

        try {
            await this.adapter.set(this.config.recordKey, normalized);
            return true;
        } catch {
            return false;
        }
    }
}
