import {
    canonicalTileKey,
    enumerateXYZTiles
} from "../services/XYZTileEnumerator.js";

const DEFAULT_TILE_BYTES = 50000;

function tileUrl(template, { z, x, y }) {
    return template.replaceAll("{z}", String(z))
        .replaceAll("{x}", String(x))
        .replaceAll("{y}", String(y))
        .replaceAll("{s}", "a");
}

function sameBbox(left, right) {
    return ["west", "south", "east", "north"].every(key =>
        left?.[key] === right?.[key]
    );
}

/** Coordinates explicit, policy-approved offline area downloads. */
export default class OfflineDownloadCoordinator {

    constructor({
        providerRegistry,
        repository,
        fetchImpl = globalThis.fetch?.bind(globalThis),
        storageEstimate = () => globalThis.navigator?.storage?.estimate?.(),
        concurrency = 4,
        averageTileBytes = DEFAULT_TILE_BYTES,
        now = () => Date.now(),
        abortControllerFactory = () => new AbortController()
    }) {
        if (!providerRegistry?.get || !providerRegistry?.canDownloadOffline ||
            !repository?.getArea || !repository?.createArea ||
            !repository?.updateArea || !repository?.getTile ||
            !repository?.putTile || !repository?.linkTile ||
            !repository?.getAreaTileKeys || typeof fetchImpl !== "function" ||
            !Number.isInteger(concurrency) || concurrency < 1 ||
            !Number.isSafeInteger(averageTileBytes) || averageTileBytes < 1) {
            throw new TypeError("Offline download dependencies are invalid.");
        }
        this.providerRegistry = providerRegistry;
        this.repository = repository;
        this.fetchImpl = fetchImpl;
        this.storageEstimate = storageEstimate;
        this.concurrency = concurrency;
        this.averageTileBytes = averageTileBytes;
        this.now = now;
        this.abortControllerFactory = abortControllerFactory;
        this.listeners = new Set();
        this.active = null;
        this.abortController = null;
    }

    subscribe(listener) {
        if (typeof listener !== "function") {
            throw new TypeError("Offline download listener must be a function.");
        }
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async planDownload(input) {
        const plan = this.#buildPlan(input);
        let quota = {
            available: false,
            availableBytes: null,
            sufficient: null
        };

        try {
            const estimate = await this.storageEstimate?.();
            if (Number.isFinite(estimate?.quota) &&
                Number.isFinite(estimate?.usage)) {
                const availableBytes = Math.max(0,
                    estimate.quota - estimate.usage);
                quota = {
                    available: true,
                    quota: estimate.quota,
                    usage: estimate.usage,
                    availableBytes,
                    sufficient: plan.estimatedBytes <= availableBytes
                };
            }
        } catch (error) {
            quota = { ...quota, error };
        }

        return { ...plan, quota };
    }

    async startDownload(input) {
        if (this.active) {
            throw new Error("An offline download is already active.");
        }
        const plan = this.#buildPlan(input);
        const controller = this.abortControllerFactory();
        this.abortController = controller;
        this.active = this.#run(plan, controller);

        try {
            return await this.active;
        } finally {
            this.active = null;
            if (this.abortController === controller) {
                this.abortController = null;
            }
        }
    }

    async resume(areaId) {
        const area = await this.repository.getArea(areaId);
        if (!area) throw new Error("Offline area is missing.");
        return this.startDownload({
            id: area.id,
            name: area.name,
            providerId: area.providerId,
            bbox: area.bbox,
            minZoom: area.minZoom,
            maxZoom: area.maxZoom,
            estimatedTileBytes: area.plannedTileCount > 0
                ? Math.max(1, Math.ceil(
                    area.estimatedBytes / area.plannedTileCount
                ))
                : this.averageTileBytes
        });
    }

    cancel() {
        if (!this.abortController || this.abortController.signal.aborted) {
            return false;
        }
        this.abortController.abort();
        return true;
    }

    #buildPlan({
        id,
        name,
        providerId,
        bbox,
        minZoom,
        maxZoom,
        estimatedTileBytes = this.averageTileBytes
    } = {}) {
        const provider = this.providerRegistry.get(providerId);
        if (!provider ||
            !this.providerRegistry.canDownloadOffline(providerId) ||
            provider.offlineDownloadAllowed !== true) {
            throw new Error("Provider is not enabled for offline download.");
        }
        if (typeof id !== "string" || !id ||
            typeof name !== "string" || !name ||
            !Number.isSafeInteger(estimatedTileBytes) ||
            estimatedTileBytes < 1 ||
            minZoom < provider.minZoom || maxZoom > provider.maxZoom) {
            throw new TypeError("Invalid offline download plan.");
        }
        const enumeration = enumerateXYZTiles({
            ...bbox, minZoom, maxZoom
        });
        const estimatedBytes = enumeration.count * estimatedTileBytes;
        if (!Number.isSafeInteger(estimatedBytes)) {
            throw new RangeError("Offline area estimate is too large.");
        }
        return {
            id,
            name,
            providerId: provider.id,
            providerTileSetVersion: provider.tileSetVersion,
            tileUrl: provider.tileUrl,
            bbox: { ...bbox },
            minZoom,
            maxZoom,
            tiles: enumeration.tiles,
            tileCount: enumeration.count,
            estimatedTileBytes,
            estimatedBytes
        };
    }

    async #run(plan, controller) {
        const provider = this.providerRegistry.get(plan.providerId);
        if (!provider || provider.tileSetVersion !==
            plan.providerTileSetVersion ||
            !this.providerRegistry.canDownloadOffline(plan.providerId)) {
            throw new Error("Offline provider changed after planning.");
        }

        let area = await this.repository.getArea(plan.id);
        if (!area) {
            area = await this.repository.createArea({
                id: plan.id,
                name: plan.name,
                providerId: plan.providerId,
                providerTileSetVersion: plan.providerTileSetVersion,
                bbox: plan.bbox,
                minZoom: plan.minZoom,
                maxZoom: plan.maxZoom,
                createdAt: this.now(),
                status: "planned",
                plannedTileCount: plan.tileCount,
                estimatedBytes: plan.estimatedBytes
            });
        } else if (area.providerId !== plan.providerId ||
            area.providerTileSetVersion !== plan.providerTileSetVersion ||
            area.minZoom !== plan.minZoom || area.maxZoom !== plan.maxZoom ||
            !sameBbox(area.bbox, plan.bbox)) {
            throw new Error("Offline area plan does not match stored metadata.");
        }

        area = await this.repository.updateArea(plan.id, {
            name: plan.name,
            status: "downloading",
            plannedTileCount: plan.tileCount,
            estimatedBytes: plan.estimatedBytes
        });
        const requiredKeys = new Set(plan.tiles.map(tile => canonicalTileKey(
            plan.providerId, plan.providerTileSetVersion, tile
        )));
        const memberships = new Set(
            await this.repository.getAreaTileKeys(plan.id)
        );
        let completedCount = [...requiredKeys].filter(key =>
            memberships.has(key)
        ).length;
        let failedCount = 0;
        let skippedCount = completedCount;
        let fetchedCount = 0;
        let storedBytes = area.storedBytes;
        const errors = [];
        let cursor = 0;

        this.#publish({
            status: "downloading",
            areaId: plan.id,
            totalCount: plan.tileCount,
            completedCount,
            failedCount,
            skippedCount,
            fetchedCount,
            storedBytes
        });

        const worker = async () => {
            while (!controller.signal.aborted) {
                const index = cursor;
                cursor += 1;
                if (index >= plan.tiles.length) return;
                const tile = plan.tiles[index];
                const key = canonicalTileKey(
                    plan.providerId, plan.providerTileSetVersion, tile
                );
                if (memberships.has(key)) continue;

                try {
                    let stored = await this.repository.getTile(key);
                    if (controller.signal.aborted) return;
                    if (!stored) {
                        const response = await this.fetchImpl(
                            tileUrl(plan.tileUrl, tile),
                            { signal: controller.signal }
                        );
                        if (!response?.ok) {
                            throw new Error(
                                `Tile request failed: ${response?.status ?? 0}`
                            );
                        }
                        const blob = await response.blob();
                        if (controller.signal.aborted) return;
                        await this.repository.putTile({
                            providerId: plan.providerId,
                            tileSetVersion: plan.providerTileSetVersion,
                            ...tile,
                            blob,
                            mimeType: response.headers?.get?.("content-type") ||
                                blob.type || "application/octet-stream"
                        });
                        stored = await this.repository.getTile(key);
                        fetchedCount += 1;
                    } else {
                        skippedCount += 1;
                    }
                    if (controller.signal.aborted) return;
                    const linked = await this.repository.linkTile(plan.id, key);
                    if (linked) {
                        memberships.add(key);
                        completedCount += 1;
                        storedBytes += stored?.bytes ?? 0;
                    }
                } catch (error) {
                    if (controller.signal.aborted ||
                        error?.name === "AbortError") return;
                    failedCount += 1;
                    errors.push({ key, error });
                }

                this.#publish({
                    status: "downloading",
                    areaId: plan.id,
                    totalCount: plan.tileCount,
                    completedCount,
                    failedCount,
                    skippedCount,
                    fetchedCount,
                    storedBytes
                });
            }
        };

        await Promise.all(Array.from(
            { length: Math.min(this.concurrency, plan.tiles.length) },
            worker
        ));

        const finalMemberships = new Set(
            await this.repository.getAreaTileKeys(plan.id)
        );
        const missingCount = [...requiredKeys].filter(key =>
            !finalMemberships.has(key)
        ).length;
        const cancelled = controller.signal.aborted;
        const status = !cancelled && failedCount === 0 && missingCount === 0
            ? "complete" : "partial";
        area = await this.repository.updateArea(plan.id, { status });
        const result = {
            status,
            areaId: plan.id,
            totalCount: plan.tileCount,
            completedCount: plan.tileCount - missingCount,
            failedCount,
            missingCount,
            skippedCount,
            fetchedCount,
            storedBytes: area.storedBytes,
            cancelled,
            errors
        };
        this.#publish(result);
        return result;
    }

    #publish(snapshot) {
        const value = Object.freeze({ ...snapshot });
        for (const listener of this.listeners) {
            try {
                listener(value);
            } catch (error) {
                console.error("Offline download listener failed.", error);
            }
        }
    }
}
