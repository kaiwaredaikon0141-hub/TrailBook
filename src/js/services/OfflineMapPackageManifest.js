const MANIFEST_VERSION = 1;
const RASTER_TILE_TYPES = new Set(["png", "jpeg", "webp", "avif"]);

export const BUNDLED_OFFLINE_MAP_PACKAGE_MANIFEST = Object.freeze({
    manifestVersion: MANIFEST_VERSION,
    generatedAt: null,
    packages: Object.freeze([])
});

function requireText(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${label} is required.`);
    }
    return value.trim();
}

function optionalText(value, label) {
    return value == null ? null : requireText(value, label);
}

function normalizeUrl(value) {
    let url;
    try {
        url = new URL(requireText(value, "Package URL"));
    } catch {
        throw new TypeError("Package URL is invalid.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new TypeError("Package URL protocol is unsupported.");
    }
    return url.href;
}

function normalizeBounds(value) {
    const bounds = {
        west: value?.west,
        south: value?.south,
        east: value?.east,
        north: value?.north
    };
    if (!Object.values(bounds).every(Number.isFinite) ||
        bounds.west < -180 || bounds.east > 180 ||
        bounds.south < -90 || bounds.north > 90 ||
        bounds.west > bounds.east || bounds.south > bounds.north) {
        throw new TypeError("Package bounds are invalid.");
    }
    return Object.freeze(bounds);
}

function normalizePackage(value) {
    const packageId = requireText(value?.packageId, "Package ID");
    if (packageId.length > 128 ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(packageId)) {
        throw new TypeError("Package ID is invalid.");
    }
    const version = requireText(value?.version, "Package version");
    if (!Number.isSafeInteger(value?.byteLength) || value.byteLength <= 0) {
        throw new TypeError("Package byte length is invalid.");
    }
    if (!Number.isInteger(value?.minZoom) || value.minZoom < 0 ||
        !Number.isInteger(value?.maxZoom) || value.maxZoom > 30 ||
        value.minZoom > value.maxZoom) {
        throw new TypeError("Package zoom range is invalid.");
    }
    if (!RASTER_TILE_TYPES.has(value?.tileType)) {
        throw new TypeError("Package tile type is unsupported.");
    }
    const checksum = optionalText(value.checksum, "Package checksum");
    const checksumAlgorithm = optionalText(
        value.checksumAlgorithm, "Package checksum algorithm"
    );
    if (Boolean(checksum) !== Boolean(checksumAlgorithm)) {
        throw new TypeError(
            "Package checksum and algorithm must be supplied together."
        );
    }
    return Object.freeze({
        identity: `${packageId}@${version}`,
        packageId,
        sourceId: requireText(value.sourceId, "Package source ID"),
        version,
        displayName: requireText(value.displayName, "Package display name"),
        region: requireText(value.region, "Package region"),
        url: normalizeUrl(value.url),
        byteLength: value.byteLength,
        checksum,
        checksumAlgorithm,
        bounds: normalizeBounds(value.bounds),
        minZoom: value.minZoom,
        maxZoom: value.maxZoom,
        tileType: value.tileType,
        attribution: requireText(value.attribution, "Package attribution"),
        etag: optionalText(value.etag, "Package ETag"),
        lastModified: optionalText(
            value.lastModified, "Package Last-Modified"
        ),
        description: optionalText(value.description, "Package description")
    });
}

/** Validates untrusted package-manifest data without performing I/O. */
export function parseOfflineMapPackageManifest(value) {
    if (value?.manifestVersion !== MANIFEST_VERSION ||
        !Array.isArray(value?.packages) ||
        !(value.generatedAt == null ||
            (typeof value.generatedAt === "string" &&
                Number.isFinite(Date.parse(value.generatedAt))))) {
        throw new TypeError("Offline map package manifest is invalid.");
    }
    const packages = value.packages.map(normalizePackage);
    const identities = new Set();
    for (const entry of packages) {
        if (identities.has(entry.identity)) {
            throw new TypeError(
                `Duplicate offline map package identity: ${entry.identity}`
            );
        }
        identities.add(entry.identity);
    }
    return Object.freeze({
        manifestVersion: MANIFEST_VERSION,
        generatedAt: value.generatedAt ?? null,
        packages: Object.freeze(packages)
    });
}

export { MANIFEST_VERSION as OFFLINE_MAP_PACKAGE_MANIFEST_VERSION };
