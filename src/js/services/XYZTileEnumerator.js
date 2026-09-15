export const MAX_MERCATOR_LATITUDE = 85.0511287798066;

export function normalizeLongitude(longitude) {
    if (!Number.isFinite(longitude)) {
        throw new TypeError("Longitude must be finite.");
    }
    const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
    return Object.is(normalized, -0) ? 0 : normalized;
}

function tileY(latitude, tileAxisLength) {
    const clamped = Math.max(
        -MAX_MERCATOR_LATITUDE,
        Math.min(MAX_MERCATOR_LATITUDE, latitude)
    );
    const radians = clamped * Math.PI / 180;
    return (1 - Math.asinh(Math.tan(radians)) / Math.PI) *
        tileAxisLength / 2;
}

function longitudeSpan(west, east) {
    let span = east - west;
    if (span < 0) {
        span = ((span % 360) + 360) % 360;
        if (span === 0) span = 360;
    }
    return Math.min(span, 360);
}

/** Pure, ordered XYZ enumeration for a half-open geographic bbox. */
export function enumerateXYZTiles({
    west, south, east, north, minZoom, maxZoom
}, { maxTiles = 100000 } = {}) {
    if (![west, south, east, north].every(Number.isFinite) ||
        south > north ||
        !Number.isInteger(minZoom) || !Number.isInteger(maxZoom) ||
        minZoom < 0 || maxZoom > 22 || minZoom > maxZoom ||
        !Number.isSafeInteger(maxTiles) || maxTiles < 1) {
        throw new RangeError("Invalid bbox, zoom range, or tile limit.");
    }

    const startLongitude = normalizeLongitude(west);
    const span = longitudeSpan(west, east);
    const tiles = [];

    for (let z = minZoom; z <= maxZoom; z += 1) {
        const axisLength = 2 ** z;
        const xCoordinates = new Set();

        if (span === 360) {
            for (let x = 0; x < axisLength; x += 1) {
                xCoordinates.add(x);
            }
        } else {
            const westX = (startLongitude + 180) * axisLength / 360;
            const eastX = (startLongitude + span + 180) *
                axisLength / 360;
            const firstX = Math.floor(westX);
            const lastX = span === 0
                ? firstX
                : Math.max(firstX, Math.ceil(eastX) - 1);

            for (let x = firstX; x <= lastX; x += 1) {
                xCoordinates.add((x % axisLength + axisLength) % axisLength);
            }
        }

        const northY = tileY(north, axisLength);
        const southY = tileY(south, axisLength);
        const firstY = Math.max(0, Math.min(axisLength - 1,
            Math.floor(northY)));
        const lastY = Math.max(firstY, Math.min(axisLength - 1,
            south === north ? Math.floor(southY) : Math.ceil(southY) - 1
        ));
        const xValues = [...xCoordinates].sort((a, b) => a - b);
        const zoomCount = xValues.length * (lastY - firstY + 1);

        if (tiles.length + zoomCount > maxTiles) {
            throw new RangeError("Selected area exceeds the tile limit.");
        }

        for (let y = firstY; y <= lastY; y += 1) {
            for (const x of xValues) {
                tiles.push({ z, x, y });
            }
        }
    }

    return { tiles, count: tiles.length };
}

/** Stable device-local tile identity, independent of Library paths. */
export function canonicalTileKey(providerId, tileSetVersion, { z, x, y }) {
    const validSegment = value =>
        typeof value === "string" && /^[A-Za-z0-9._-]+$/.test(value);
    const axisLength = 2 ** z;

    if (!validSegment(providerId) || !validSegment(tileSetVersion) ||
        !Number.isInteger(z) || z < 0 || z > 22 ||
        !Number.isInteger(x) || x < 0 || x >= axisLength ||
        !Number.isInteger(y) || y < 0 || y >= axisLength) {
        throw new RangeError("Invalid provider or XYZ tile identity.");
    }
    return `${providerId}/${tileSetVersion}/${z}/${x}/${y}`;
}
