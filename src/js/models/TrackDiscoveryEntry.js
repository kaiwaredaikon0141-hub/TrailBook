export const DATE_SOURCES = Object.freeze({
    METADATA: "metadata.time",
    TRACK_POINT: "trackPoint.time",
    FILE_MODIFIED: "file.lastModified",
    FILE_NAME: "originalFileName",
    UNKNOWN: "unknown"
});

const VALID_DATE_SOURCES = new Set(Object.values(DATE_SOURCES));

function copyDate(value, fieldName) {

    if (value === null || value === undefined) {
        return null;
    }

    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

    if (!Number.isFinite(date.getTime())) {
        throw new TypeError(`${fieldName} must be a valid Date or null.`);
    }

    return date;
}

function nonNegativeNumber(value, fieldName, { integer = false } = {}) {

    if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
        throw new TypeError(`${fieldName} must be a non-negative number.`);
    }

    return value;
}

function optionalNonNegativeNumber(value, fieldName, options) {

    return value === null || value === undefined
        ? null
        : nonNegativeNumber(value, fieldName, options);
}

function optionalFiniteNumber(value, fieldName) {

    if (value === null || value === undefined) {
        return null;
    }

    if (!Number.isFinite(value)) {
        throw new TypeError(`${fieldName} must be finite or null.`);
    }

    return value;
}

/**
 * Compact, immutable discovery data for one GPX relative path.
 */
export default class TrackDiscoveryEntry {

    constructor({
        relativePath,
        folderPath = "",
        originalFileName,
        displayName,
        trackNames = [],
        resolvedDate = null,
        dateSource = DATE_SOURCES.UNKNOWN,
        pointCount = 0,
        startTime = null,
        endTime = null,
        duration = null,
        distance = 0,
        elevationMin = null,
        elevationMax = null,
        fileSize = null,
        lastModified = null,
        status = "ready"
    }) {

        if (typeof relativePath !== "string" || relativePath.length === 0) {
            throw new TypeError("relativePath is required.");
        }

        if (typeof folderPath !== "string" ||
            typeof originalFileName !== "string" ||
            typeof displayName !== "string" || displayName.length === 0) {
            throw new TypeError("Discovery path and display fields are invalid.");
        }

        if (!Array.isArray(trackNames) ||
            trackNames.some(name => typeof name !== "string" || name.length === 0)) {
            throw new TypeError("trackNames must contain non-empty strings.");
        }

        if (!VALID_DATE_SOURCES.has(dateSource)) {
            throw new TypeError("dateSource is invalid.");
        }

        if (status !== "ready" && status !== "error") {
            throw new TypeError("status is invalid.");
        }

        this.relativePath = relativePath;
        this.folderPath = folderPath;
        this.originalFileName = originalFileName;
        this.displayName = displayName;
        this.trackNames = Object.freeze([...new Set(trackNames)]);
        this.resolvedDate = copyDate(resolvedDate, "resolvedDate");
        this.dateSource = dateSource;
        this.pointCount = nonNegativeNumber(pointCount, "pointCount", {
            integer: true
        });
        this.startTime = copyDate(startTime, "startTime");
        this.endTime = copyDate(endTime, "endTime");
        this.duration = optionalNonNegativeNumber(duration, "duration");
        this.distance = nonNegativeNumber(distance, "distance");
        this.elevationMin = optionalFiniteNumber(elevationMin, "elevationMin");
        this.elevationMax = optionalFiniteNumber(elevationMax, "elevationMax");
        this.fileSize = optionalNonNegativeNumber(fileSize, "fileSize", {
            integer: true
        });
        this.lastModified = optionalNonNegativeNumber(
            lastModified,
            "lastModified"
        );
        this.status = status;

        Object.freeze(this);
    }

    toRecord() {

        return {
            relativePath: this.relativePath,
            folderPath: this.folderPath,
            originalFileName: this.originalFileName,
            displayName: this.displayName,
            trackNames: [...this.trackNames],
            resolvedDate: this.resolvedDate?.getTime() ?? null,
            dateSource: this.dateSource,
            pointCount: this.pointCount,
            startTime: this.startTime?.getTime() ?? null,
            endTime: this.endTime?.getTime() ?? null,
            duration: this.duration,
            distance: this.distance,
            elevationMin: this.elevationMin,
            elevationMax: this.elevationMax,
            fileSize: this.fileSize,
            lastModified: this.lastModified,
            status: this.status
        };
    }

    static fromRecord(record) {

        try {
            return new TrackDiscoveryEntry(record || {});
        } catch {
            return null;
        }
    }
}
