import { evaluatePackageLifecycle } from "./OfflineMapPackageRepository.js";
import PMTilesArchiveReader from "./PMTilesArchiveReader.js";
import PMTilesArchiveSource from "./PMTilesArchiveSource.js";

function sourceId(metadata) {
    const checksum = metadata.checksum ?? "unverified";
    return `pmtiles:${encodeURIComponent(metadata.packageId)}@${
        encodeURIComponent(metadata.version)}#${encodeURIComponent(checksum)}`;
}

/** Derived composition of static basemaps and installed ready packages. */
export default class OfflineMapPackageCatalog {

    constructor({ staticProviders, repository, archiveStore,
        archiveReader = new PMTilesArchiveReader() }) {
        if (!staticProviders || !repository || !archiveStore) {
            throw new TypeError("Offline map package catalog dependencies are required.");
        }
        this.staticProviders = staticProviders;
        this.repository = repository;
        this.archiveStore = archiveStore;
        this.archiveReader = archiveReader;
        this.installed = new Map();
    }

    async refresh() {
        const next = new Map();
        for (const metadata of await this.repository.listPackages()) {
            const files = await this.archiveStore.inspectPackageFiles(
                metadata.packageId
            );
            if (!evaluatePackageLifecycle(metadata, files).ready) continue;
            try {
                const inspected = await this.archiveReader.inspectSource(
                    new PMTilesArchiveSource(
                        this.archiveStore, metadata.packageId
                    ),
                    { expectedSize: metadata.byteLength }
                );
                if (inspected.tileType !== metadata.tileType) continue;
            } catch {
                continue;
            }
            const id = sourceId(metadata);
            next.set(id, Object.freeze({
                id,
                name: metadata.sourceId,
                sourceType: "pmtiles",
                packageId: metadata.packageId,
                packageVersion: metadata.version,
                checksum: metadata.checksum,
                attribution: metadata.attribution,
                minZoom: metadata.minZoom,
                maxZoom: metadata.maxZoom,
                tileType: metadata.tileType,
                bounds: { ...metadata.bounds },
                offlineDownloadAllowed: false
            }));
        }
        this.installed = next;
        return this.list().filter(source => source.sourceType === "pmtiles");
    }

    get(id) {
        return this.installed.get(id) ?? this.staticProviders.get(id);
    }

    normalizeId(id) {
        return this.installed.has(id)
            ? id
            : this.staticProviders.normalizeId(id);
    }

    list() {
        return [...this.staticProviders.list(), ...this.installed.values()];
    }
}
