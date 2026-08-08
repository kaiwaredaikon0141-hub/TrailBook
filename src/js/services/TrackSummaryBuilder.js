import TrackDiscoveryEntry, {
    DATE_SOURCES
} from "../models/TrackDiscoveryEntry.js";
import { folderPathFromFilePath } from "../utils/PathUtils.js";
import { normalizeDiscoveryName } from "../utils/DiscoveryName.js";

const EARTH_RADIUS_METERS = 6371008.8;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const FILE_DATE_PATTERNS = [
    /(?:^|\D)(\d{4})-(\d{2})-(\d{2})(?=$|\D)/,
    /(?:^|\D)(\d{4})_(\d{2})_(\d{2})(?=$|\D)/,
    /(?:^|\D)(\d{4})(\d{2})(\d{2})(?=$|\D)/
];

function parseTime(value) {

    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    const match = ISO_DATE_TIME.exec(normalized);

    if (!match || !isCalendarDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3])
    )) {
        return null;
    }

    const date = new Date(normalized);

    return Number.isFinite(date.getTime()) ? date : null;
}

function isCalendarDate(year, month, day) {

    if (!Number.isInteger(year) || !Number.isInteger(month) ||
        !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
        return false;
    }

    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseFileNameDate(fileName) {

    for (const pattern of FILE_DATE_PATTERNS) {
        const match = pattern.exec(fileName);

        if (!match) {
            continue;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(0);

        date.setHours(0, 0, 0, 0);
        date.setFullYear(year, month - 1, day);

        if (isCalendarDate(year, month, day)) {
            return date;
        }
    }

    return null;
}

function radians(value) {

    return value * Math.PI / 180;
}

function distanceBetween(first, second) {

    const latitudeDelta = radians(second.latitude - first.latitude);
    const longitudeDelta = radians(second.longitude - first.longitude);
    const firstLatitude = radians(first.latitude);
    const secondLatitude = radians(second.latitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(firstLatitude) * Math.cos(secondLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(
        Math.min(1, Math.sqrt(haversine))
    );
}

function isCoordinate(point) {

    return Boolean(
        point &&
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        point.latitude >= -90 && point.latitude <= 90 &&
        point.longitude >= -180 && point.longitude <= 180
    );
}

/**
 * Builds one compact discovery summary from a GPX parser result.
 */
export default class TrackSummaryBuilder {

    build(relativePath, file, result, { status = "ready" } = {}) {

        const originalFileName = typeof file?.name === "string"
            ? file.name
            : relativePath.split("/").pop() || relativePath;
        const relativeFileName = relativePath.split("/").pop() || relativePath;
        const fallbackDisplayName = normalizeDiscoveryName(relativeFileName) ||
            normalizeDiscoveryName(originalFileName) || "Unnamed GPX";
        const tracks = Array.isArray(result?.tracks) ? result.tracks : [];
        const trackNames = [...new Set(
            tracks
                .map(track => normalizeDiscoveryName(track?.name))
                .filter(Boolean)
        )];
        const metadataName = normalizeDiscoveryName(result?.metadata?.name);
        let pointCount = 0;
        let distance = 0;
        let firstTrackPointDate = null;
        let startTimestamp = null;
        let endTimestamp = null;
        let elevationMin = null;
        let elevationMax = null;

        tracks.forEach(track => {
            const segments = Array.isArray(track?.segments) ? track.segments : [];

            segments.forEach(segment => {
                const points = Array.isArray(segment?.points)
                    ? segment.points
                    : [];
                let previousPoint = null;

                points.forEach(point => {
                    if (!isCoordinate(point)) {
                        return;
                    }

                    pointCount += 1;

                    if (previousPoint) {
                        distance += distanceBetween(previousPoint, point);
                    }

                    previousPoint = point;

                    const pointDate = parseTime(point.time);

                    if (pointDate) {
                        firstTrackPointDate ||= pointDate;
                        const timestamp = pointDate.getTime();

                        startTimestamp = startTimestamp === null
                            ? timestamp
                            : Math.min(startTimestamp, timestamp);
                        endTimestamp = endTimestamp === null
                            ? timestamp
                            : Math.max(endTimestamp, timestamp);
                    }

                    if (Number.isFinite(point.elevation)) {
                        elevationMin = elevationMin === null
                            ? point.elevation
                            : Math.min(elevationMin, point.elevation);
                        elevationMax = elevationMax === null
                            ? point.elevation
                            : Math.max(elevationMax, point.elevation);
                    }
                });
            });
        });

        const metadataDate = parseTime(result?.metadata?.time);
        const fileModifiedDate = Number.isFinite(file?.lastModified) &&
            file.lastModified >= 0
            ? new Date(file.lastModified)
            : null;
        const fileNameDate = parseFileNameDate(originalFileName);
        let resolvedDate = null;
        let dateSource = DATE_SOURCES.UNKNOWN;

        if (metadataDate) {
            resolvedDate = metadataDate;
            dateSource = DATE_SOURCES.METADATA;
        } else if (firstTrackPointDate) {
            resolvedDate = firstTrackPointDate;
            dateSource = DATE_SOURCES.TRACK_POINT;
        } else if (fileModifiedDate && Number.isFinite(fileModifiedDate.getTime())) {
            resolvedDate = fileModifiedDate;
            dateSource = DATE_SOURCES.FILE_MODIFIED;
        } else if (fileNameDate) {
            resolvedDate = fileNameDate;
            dateSource = DATE_SOURCES.FILE_NAME;
        }

        return new TrackDiscoveryEntry({
            relativePath,
            folderPath: folderPathFromFilePath(relativePath),
            originalFileName,
            displayName: metadataName || trackNames[0] || fallbackDisplayName,
            trackNames,
            resolvedDate,
            dateSource,
            pointCount,
            startTime: startTimestamp === null ? null : new Date(startTimestamp),
            endTime: endTimestamp === null ? null : new Date(endTimestamp),
            duration: startTimestamp === null || endTimestamp === null
                ? null
                : endTimestamp - startTimestamp,
            distance,
            elevationMin,
            elevationMax,
            fileSize: Number.isInteger(file?.size) && file.size >= 0
                ? file.size
                : null,
            lastModified: Number.isFinite(file?.lastModified) &&
                file.lastModified >= 0
                ? file.lastModified
                : null,
            status
        });
    }
}
