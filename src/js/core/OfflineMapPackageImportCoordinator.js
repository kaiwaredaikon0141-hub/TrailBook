import PMTilesArchiveSource from "../services/PMTilesArchiveSource.js";

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

function requireText(value, label) {
    if (typeof value !== "string" || !value) {
        throw new TypeError(`${label} is required.`);
    }
    return value;
}

/** Streams user-selected PMTiles Files into the package storage boundaries. */
export default class OfflineMapPackageImportCoordinator {

    constructor({ repository, archiveStore, archiveReader,
        chunkSize = DEFAULT_CHUNK_SIZE }) {
        if (!repository || !archiveStore || !archiveReader ||
            !Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
            throw new TypeError("Offline map package importer dependencies are invalid.");
        }
        this.repository = repository;
        this.archiveStore = archiveStore;
        this.archiveReader = archiveReader;
        this.chunkSize = chunkSize;
    }

    async importFile(file, {
        packageId,
        sourceId,
        version,
        checksum = null,
        attribution = null,
        stylePackageId = null
    } = {}) {
        packageId = requireText(packageId, "Package ID");
        sourceId = requireText(sourceId, "Package source ID");
        version = requireText(version, "Package version");
        const inspected = await this.archiveReader.inspectFile(file);
        const paths = this.archiveStore.getPaths(packageId);
        const packageAttribution = attribution ??
            inspected.metadata?.attribution ?? "Offline map package";
        let created = false;
        try {
            await this.repository.createPackage({
                packageId,
                sourceId,
                version,
                status: "downloading",
                opfsPath: paths.final,
                byteLength: file.size,
                downloadedBytes: 0,
                checksum,
                bounds: inspected.bounds,
                minZoom: inspected.minZoom,
                maxZoom: inspected.maxZoom,
                tileType: inspected.tileType,
                attribution: packageAttribution,
                stylePackageId
            });
            created = true;
            await this.archiveStore.createPartial(packageId, { truncate: true });
            for (let offset = 0; offset < file.size; offset += this.chunkSize) {
                const chunk = file.slice(
                    offset, Math.min(file.size, offset + this.chunkSize)
                );
                const downloadedBytes = await this.archiveStore.writePartial(
                    packageId, chunk, { offset }
                );
                await this.repository.updatePackage(packageId, {
                    status: downloadedBytes < file.size
                        ? "downloading" : "verifying",
                    downloadedBytes
                });
            }
            const partialSize = await this.archiveStore.getFileSize(packageId, {
                kind: "partial"
            });
            if (partialSize !== file.size) {
                throw new Error("Imported PMTiles byte length mismatch.");
            }
            await this.archiveReader.inspectSource(
                new PMTilesArchiveSource(this.archiveStore, packageId, {
                    kind: "partial"
                }),
                { expectedSize: file.size }
            );
            const finalized = await this.archiveStore.finalize(packageId);
            if (finalized.size !== file.size) {
                throw new Error("Final PMTiles byte length mismatch.");
            }
            await this.archiveReader.inspectSource(
                new PMTilesArchiveSource(this.archiveStore, packageId),
                { expectedSize: file.size }
            );
            return await this.repository.updatePackage(packageId, {
                status: "ready",
                opfsPath: finalized.path,
                downloadedBytes: finalized.size
            });
        } catch (error) {
            if (created) {
                try {
                    const partialSize = await this.archiveStore.getFileSize(
                        packageId, { kind: "partial" }
                    );
                    await this.repository.updatePackage(packageId, {
                        status: partialSize === null ? "failed" : "partial",
                        downloadedBytes: partialSize ?? 0
                    });
                } catch (statusError) {
                    console.error("Unable to preserve PMTiles import state.",
                        statusError);
                }
            }
            throw error;
        }
    }

    async deletePackage(packageId) {
        await this.archiveStore.deleteArchive(packageId);
        return this.repository.deletePackage(packageId);
    }
}
