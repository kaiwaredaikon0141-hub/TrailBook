import { canonicalTileKey } from "./XYZTileEnumerator.js";

const AREA_STATUSES = new Set([
    "planned", "downloading", "partial", "complete"
]);
const AREA_UPDATES = new Set([
    "name", "status", "plannedTileCount", "estimatedBytes"
]);

function nonnegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0;
}

function validateArea(area) {
    if (typeof area?.id !== "string" || !area.id ||
        typeof area.name !== "string" || !area.name ||
        typeof area.providerId !== "string" || !area.providerId ||
        typeof area.providerTileSetVersion !== "string" ||
        !area.providerTileSetVersion ||
        !area.bbox || area.bbox.south > area.bbox.north ||
        ![area.bbox.west, area.bbox.south, area.bbox.east,
            area.bbox.north].every(Number.isFinite) ||
        !Number.isInteger(area.minZoom) ||
        !Number.isInteger(area.maxZoom) ||
        area.minZoom < 0 || area.maxZoom > 22 ||
        area.minZoom > area.maxZoom ||
        !Number.isFinite(area.createdAt) ||
        !AREA_STATUSES.has(area.status) ||
        !nonnegativeInteger(area.plannedTileCount) ||
        !nonnegativeInteger(area.estimatedBytes)) {
        throw new TypeError("Invalid offline area metadata.");
    }
}

/** Device-local area, tile, and membership storage in an independent DB. */
export default class OfflineMapsRepository {

    constructor({
        databaseName = "trailbook.offlineMaps",
        databaseVersion = 1,
        indexedDBFactory = globalThis.indexedDB,
        keyRangeFactory = globalThis.IDBKeyRange
    } = {}) {
        this.databaseName = databaseName;
        this.databaseVersion = databaseVersion;
        this.indexedDB = indexedDBFactory;
        this.keyRange = keyRangeFactory;
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
                const database = request.result;

                if (!database.objectStoreNames.contains("areas")) {
                    database.createObjectStore("areas", { keyPath: "id" });
                }
                if (!database.objectStoreNames.contains("tiles")) {
                    database.createObjectStore("tiles", { keyPath: "key" });
                }
                const memberships = database.objectStoreNames.contains(
                    "areaTiles"
                ) ? request.transaction.objectStore("areaTiles") :
                    database.createObjectStore("areaTiles", {
                        keyPath: ["areaId", "tileKey"]
                    });
                if (!memberships.indexNames.contains("areaId")) {
                    memberships.createIndex("areaId", "areaId");
                }
                if (!memberships.indexNames.contains("tileKey")) {
                    memberships.createIndex("tileKey", "tileKey");
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(
                new Error("Offline Maps IndexedDB upgrade is blocked.")
            );
        });
    }

    async #transaction(names, mode, operation) {
        const database = await this.open();

        return new Promise((resolve, reject) => {
            let result;
            let failure;
            let transaction;

            try {
                transaction = database.transaction(names, mode);
                const stores = Object.fromEntries(names.map(name => [
                    name, transaction.objectStore(name)
                ]));
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
                        new Error("Offline Maps transaction aborted."));
                };
                operation(stores, value => { result = value; }, abort);
            } catch (error) {
                database.close();
                reject(error);
            }
        });
    }

    createArea(area) {
        const record = {
            ...area,
            bbox: { ...area?.bbox },
            storedTileCount: 0,
            storedBytes: 0
        };
        validateArea(record);

        return this.#transaction(["areas"], "readwrite", (stores, done) => {
            stores.areas.add(record);
            done(record);
        });
    }

    getArea(id) {
        return this.#transaction(["areas"], "readonly", (stores, done) => {
            const request = stores.areas.get(id);
            request.onsuccess = () => done(request.result ?? null);
        });
    }

    listAreas() {
        return this.#transaction(["areas"], "readonly", (stores, done) => {
            const request = stores.areas.getAll();
            request.onsuccess = () => done(request.result);
        });
    }

    updateArea(id, changes) {
        if (!changes || Object.keys(changes).some(key =>
            !AREA_UPDATES.has(key)) ||
            (changes.status && !AREA_STATUSES.has(changes.status)) ||
            (changes.plannedTileCount !== undefined &&
                !nonnegativeInteger(changes.plannedTileCount)) ||
            (changes.estimatedBytes !== undefined &&
                !nonnegativeInteger(changes.estimatedBytes))) {
            throw new TypeError("Invalid offline area update.");
        }

        return this.#transaction(["areas"], "readwrite",
            (stores, done, abort) => {
                const request = stores.areas.get(id);
                request.onsuccess = () => {
                    if (!request.result) {
                        abort(new Error("Offline area is missing."));
                        return;
                    }
                    const updated = { ...request.result, ...changes };
                    try {
                        validateArea(updated);
                    } catch (error) {
                        abort(error);
                        return;
                    }
                    stores.areas.put(updated);
                    done(updated);
                };
            });
    }

    putTile({ providerId, tileSetVersion, z, x, y, blob,
        mimeType = blob?.type || "application/octet-stream" } = {}) {
        if (!(blob instanceof Blob) || !nonnegativeInteger(blob.size)) {
            throw new TypeError("An offline tile needs a Blob.");
        }
        const key = canonicalTileKey(providerId, tileSetVersion,
            { z, x, y });
        const record = { key, providerId, tileSetVersion, z, x, y,
            blob, mimeType, bytes: blob.size };

        // A tile key is immutable. A changed source uses a new tileSetVersion.
        return this.#transaction(["tiles"], "readwrite", (stores, done) => {
            const request = stores.tiles.get(key);
            request.onsuccess = () => {
                if (!request.result) stores.tiles.add(record);
                done({ key, inserted: !request.result });
            };
        });
    }

    getTile(key) {
        return this.#transaction(["tiles"], "readonly", (stores, done) => {
            const request = stores.tiles.get(key);
            request.onsuccess = () => done(request.result ?? null);
        });
    }

    linkTile(areaId, tileKey) {
        return this.#transaction(["areas", "tiles", "areaTiles"],
            "readwrite", (stores, done, abort) => {
                const membership = stores.areaTiles.get([areaId, tileKey]);
                membership.onsuccess = () => {
                    if (membership.result) {
                        done(false);
                        return;
                    }
                    const area = stores.areas.get(areaId);
                    area.onsuccess = () => {
                        if (!area.result) {
                            abort(new Error("Offline area is missing."));
                            return;
                        }
                        const tile = stores.tiles.get(tileKey);
                        tile.onsuccess = () => {
                            if (!tile.result) {
                                abort(new Error("Offline tile is missing."));
                                return;
                            }
                            if (area.result.providerId !==
                                tile.result.providerId ||
                                area.result.providerTileSetVersion !==
                                    tile.result.tileSetVersion) {
                                abort(new Error(
                                    "Offline area and tile providers differ."
                                ));
                                return;
                            }
                            stores.areaTiles.add({ areaId, tileKey });
                            stores.areas.put({
                                ...area.result,
                                storedTileCount: area.result.storedTileCount + 1,
                                storedBytes: area.result.storedBytes +
                                    tile.result.bytes
                            });
                            done(true);
                        };
                    };
                };
            });
    }

    getAreaTileKeys(areaId) {
        return this.#transaction(["areaTiles"], "readonly",
            (stores, done) => {
                const request = stores.areaTiles.index("areaId").getAll(
                    this.keyRange.only(areaId)
                );
                request.onsuccess = () => done(
                    request.result.map(member => member.tileKey)
                );
            });
    }

    getTileReferenceCount(tileKey) {
        return this.#transaction(["areaTiles"], "readonly",
            (stores, done) => {
                const request = stores.areaTiles.index("tileKey").count(
                    this.keyRange.only(tileKey)
                );
                request.onsuccess = () => done(request.result);
            });
    }

    deleteArea(id) {
        return this.#transaction(["areas", "tiles", "areaTiles"],
            "readwrite", (stores, done) => {
                const area = stores.areas.get(id);
                area.onsuccess = () => {
                    if (!area.result) {
                        done({ deleted: false, orphanTilesRemoved: 0 });
                        return;
                    }
                    const memberships = stores.areaTiles.index("areaId")
                        .getAll(this.keyRange.only(id));
                    memberships.onsuccess = () => {
                        const deletion = {
                            deleted: true, orphanTilesRemoved: 0
                        };
                        for (const { tileKey } of memberships.result) {
                            const count = stores.areaTiles.index("tileKey")
                                .count(this.keyRange.only(tileKey));
                            count.onsuccess = () => {
                                if (count.result === 1) {
                                    stores.tiles.delete(tileKey);
                                    deletion.orphanTilesRemoved += 1;
                                }
                                stores.areaTiles.delete([id, tileKey]);
                            };
                        }
                        stores.areas.delete(id);
                        // The transaction completes only after each count and delete.
                        done(deletion);
                    };
                };
            });
    }
}
