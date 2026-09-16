import { canonicalTileKey } from "./XYZTileEnumerator.js";

/** Resolves explicitly enabled provider tiles from device-local storage. */
export default class OfflineTileResolver {

    constructor(repository) {
        if (!repository?.getTile) {
            throw new TypeError("An Offline Maps repository is required.");
        }
        this.repository = repository;
    }

    async resolveTile(provider, { z, x, y }) {
        if (!provider || provider.offlineDownloadAllowed !== true) {
            return {
                status: "unavailable",
                reason: "provider-not-enabled"
            };
        }

        let key;
        try {
            key = canonicalTileKey(
                provider.id,
                provider.tileSetVersion,
                { z, x, y }
            );
        } catch (error) {
            return { status: "unavailable", reason: "invalid-tile", error };
        }

        try {
            const tile = await this.repository.getTile(key);
            if (!tile) return { status: "local-miss", key };
            if (tile.providerId !== provider.id ||
                tile.tileSetVersion !== provider.tileSetVersion ||
                !(tile.blob instanceof Blob)) {
                return {
                    status: "unavailable",
                    reason: "stored-tile-mismatch",
                    key
                };
            }
            return { status: "local-hit", key, blob: tile.blob };
        } catch (error) {
            return { status: "unavailable", reason: "storage-error", key,
                error };
        }
    }
}
