import {
    FileSource,
    PMTiles,
    TileType
} from "../../vendor/pmtiles/pmtiles.js";

const RASTER_TILE_TYPES = new Map([
    [TileType.Png, "png"],
    [TileType.Jpeg, "jpeg"],
    [TileType.Webp, "webp"],
    [TileType.Avif, "avif"]
]);
const SUPPORTED_TILE_TYPES = new Map([
    [TileType.Mvt, "mvt"],
    ...RASTER_TILE_TYPES
]);

function assertHeader(header) {
    if (header.specVersion !== 3) {
        throw new Error(
            `Unsupported PMTiles archive version: ${header.specVersion}`
        );
    }
    if (!SUPPORTED_TILE_TYPES.has(header.tileType)) {
        throw new Error(
            `Unsupported PMTiles tile type: ${header.tileType}`
        );
    }
    const numbers = [
        header.minLon, header.minLat, header.maxLon, header.maxLat,
        header.centerLon, header.centerLat, header.centerZoom,
        header.minZoom, header.maxZoom
    ];
    if (!numbers.every(Number.isFinite) ||
        header.minLat > header.maxLat || header.minLon > header.maxLon ||
        header.minZoom > header.maxZoom) {
        throw new Error("Invalid PMTiles header bounds or zoom range.");
    }
}

function archiveEnd(header) {
    return Math.max(
        header.rootDirectoryOffset + header.rootDirectoryLength,
        header.jsonMetadataOffset + header.jsonMetadataLength,
        header.leafDirectoryOffset + (header.leafDirectoryLength ?? 0),
        header.tileDataOffset + (header.tileDataLength ?? 0)
    );
}

/** Validates supported PMTiles v3 archives without reading the entire source. */
export default class PMTilesArchiveReader {

    createArchive(source) {
        return new PMTiles(source);
    }

    async inspectFile(file) {
        if (!file || !Number.isSafeInteger(file.size) || file.size < 0 ||
            typeof file.slice !== "function") {
            throw new TypeError("A File-compatible PMTiles source is required.");
        }
        return this.inspectSource(new FileSource(file), {
            expectedSize: file.size
        });
    }

    async inspectSource(source, { expectedSize = null } = {}) {
        if (typeof source?.getBytes !== "function" ||
            typeof source?.getKey !== "function") {
            throw new TypeError("A PMTiles byte-range source is required.");
        }
        try {
            const archive = this.createArchive(source);
            const header = await archive.getHeader();
            assertHeader(header);
            const size = expectedSize ??
                (typeof source.getSize === "function"
                    ? await source.getSize()
                    : null);
            if (size !== null && archiveEnd(header) > size) {
                throw new Error("PMTiles archive is truncated.");
            }
            const metadata = await archive.getMetadata();
            return {
                archive,
                archiveVersion: header.specVersion,
                tileType: SUPPORTED_TILE_TYPES.get(header.tileType),
                minZoom: header.minZoom,
                maxZoom: header.maxZoom,
                bounds: {
                    west: header.minLon,
                    south: header.minLat,
                    east: header.maxLon,
                    north: header.maxLat
                },
                center: {
                    longitude: header.centerLon,
                    latitude: header.centerLat,
                    zoom: header.centerZoom
                },
                metadata,
                header
            };
        } catch (error) {
            if (error?.message?.startsWith("Unsupported PMTiles") ||
                error?.message === "PMTiles archive is truncated." ||
                error?.message === "Invalid PMTiles header bounds or zoom range.") {
                throw error;
            }
            throw new Error(`Invalid PMTiles archive: ${error?.message ?? error}`,
                { cause: error });
        }
    }
}

export { RASTER_TILE_TYPES, SUPPORTED_TILE_TYPES };
