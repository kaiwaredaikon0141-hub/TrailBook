export class OfflineMapArchiveMissingError extends Error {

    constructor(packageId, kind) {
        super(`Offline map package archive is missing: ${packageId}.${kind}`);
        this.name = "OfflineMapArchiveMissingError";
        this.code = "OFFLINE_MAP_ARCHIVE_MISSING";
    }
}

function validRangeValue(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`Invalid PMTiles ${label}.`);
    }
}

/** PMTiles byte-range Source backed by the package OPFS boundary. */
export default class PMTilesArchiveSource {

    constructor(archiveStore, packageId, { kind = "final" } = {}) {
        if (typeof archiveStore?.readRange !== "function" ||
            typeof archiveStore?.getFileSize !== "function") {
            throw new TypeError("Offline map archive store is required.");
        }
        if (kind !== "partial" && kind !== "final") {
            throw new TypeError("Invalid PMTiles archive kind.");
        }
        this.archiveStore = archiveStore;
        this.packageId = packageId;
        this.kind = kind;
    }

    getKey() {
        return `opfs:trailbook/offline-map-packages/${
            this.packageId}.${this.kind === "final" ? "pmtiles" : "partial"}`;
    }

    async getSize() {
        const size = await this.archiveStore.getFileSize(this.packageId, {
            kind: this.kind
        });
        if (size === null) {
            throw new OfflineMapArchiveMissingError(
                this.packageId, this.kind
            );
        }
        return size;
    }

    async getBytes(offset, length, signal) {
        validRangeValue(offset, "range offset");
        validRangeValue(length, "range length");
        signal?.throwIfAborted?.();
        const size = await this.getSize();
        if (offset > size) {
            throw new RangeError("PMTiles range begins after archive end.");
        }
        const data = await this.archiveStore.readRange(this.packageId, {
            kind: this.kind,
            offset,
            length
        });
        signal?.throwIfAborted?.();
        return { data };
    }
}
