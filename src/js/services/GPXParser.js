import GPXParseError from "../errors/GPXParseError.js";
import Metadata from "../models/Metadata.js";
import Track from "../models/Track.js";
import TrackPoint from "../models/TrackPoint.js";
import TrackSegment from "../models/TrackSegment.js";
import Waypoint from "../models/Waypoint.js";

const GPX_ROOT = "gpx";
const TRACK = "trk";
const SEGMENT = "trkseg";
const TRACK_POINT = "trkpt";
const WAYPOINT = "wpt";

/**
 * Parses GPX XML into TrailBook models.
 */
export default class GPXParser {

    /**
     * @param {string} xmlText
     * @param {string|null} sourceFileName
     * @returns {{metadata: Metadata, tracks: Track[], waypoints: Waypoint[], warnings: object[]}}
     */
    parse(xmlText, sourceFileName = null) {

        const document = new DOMParser().parseFromString(
            xmlText,
            "application/xml"
        );

        if (
            !document.documentElement ||
            document.documentElement.localName === "parsererror" ||
            document.getElementsByTagName("parsererror").length > 0
        ) {
            throw new GPXParseError(
                "XML_PARSE_FAILED",
                "GPX XMLを解析できません",
                sourceFileName
            );
        }

        const root = document.documentElement;

        if (root.localName !== GPX_ROOT) {
            throw new GPXParseError(
                "GPX_ROOT_INVALID",
                "GPXルート要素がありません",
                sourceFileName
            );
        }

        const warnings = [];

        this.#warnAboutVersion(root, sourceFileName, warnings);

        return {
            metadata: this.#parseMetadata(root, sourceFileName),
            tracks: this.#parseTracks(root, sourceFileName, warnings),
            waypoints: this.#parseWaypoints(root, sourceFileName, warnings),
            warnings
        };
    }

    #warnAboutVersion(root, sourceFileName, warnings) {

        const version = root.getAttribute("version");

        if (!version) {
            warnings.push(this.#warning(
                "MISSING_VERSION",
                "GPX versionがありません",
                "gpx",
                sourceFileName
            ));

            return;
        }

        if (version !== "1.0" && version !== "1.1") {
            warnings.push(this.#warning(
                "UNKNOWN_VERSION",
                `未知のGPX versionです: ${version}`,
                "gpx",
                sourceFileName
            ));
        }
    }

    #parseMetadata(root, sourceFileName) {

        const metadata = new Metadata(sourceFileName);

        metadata.version = root.getAttribute("version") || null;

        const metadataElement = this.#child(root, "metadata");

        if (metadataElement) {

            metadata.name = this.#text(metadataElement, "name");
            metadata.description = this.#text(metadataElement, "desc");
            metadata.time = this.#text(metadataElement, "time");
            metadata.keywords = this.#text(metadataElement, "keywords");

            const author = this.#child(metadataElement, "author");

            if (author) {
                metadata.creator = this.#text(author, "name");
            }
        }

        metadata.creator = metadata.creator ||
            root.getAttribute("creator") ||
            null;

        return metadata;
    }

    #parseTracks(root, sourceFileName, warnings) {

        const tracks = [];

        this.#children(root, TRACK).forEach((trackElement, trackIndex) => {

            const track = new Track(this.#text(trackElement, "name"));

            this.#children(trackElement, SEGMENT).forEach(
                (segmentElement, segmentIndex) => {

                    const segment = new TrackSegment();

                    this.#children(segmentElement, TRACK_POINT).forEach(
                        (pointElement, pointIndex) => {

                            const point = this.#parseTrackPoint(
                                pointElement,
                                `trk[${trackIndex + 1}]/trkseg[${segmentIndex + 1}]/trkpt[${pointIndex + 1}]`,
                                sourceFileName,
                                warnings
                            );

                            if (point) {
                                segment.points.push(point);
                            }
                        }
                    );

                    if (segment.points.length === 0) {
                        warnings.push(this.#warning(
                            "EMPTY_TRACK_SEGMENT",
                            "有効なTrackPointがないためTrackSegmentを除外しました",
                            `trk[${trackIndex + 1}]/trkseg[${segmentIndex + 1}]`,
                            sourceFileName
                        ));

                        return;
                    }

                    track.segments.push(segment);
                }
            );

            if (track.segments.length === 0) {
                warnings.push(this.#warning(
                    "EMPTY_TRACK",
                    "有効なTrackSegmentがないためTrackを除外しました",
                    `trk[${trackIndex + 1}]`,
                    sourceFileName
                ));

                return;
            }

            tracks.push(track);
        });

        return tracks;
    }

    #parseTrackPoint(element, path, sourceFileName, warnings) {

        const coordinates = this.#coordinates(element);

        if (!coordinates) {
            warnings.push(this.#warning(
                "INVALID_TRACK_POINT",
                "TrackPointの緯度または経度が不正です",
                path,
                sourceFileName
            ));

            return null;
        }

        const point = new TrackPoint(
            coordinates.latitude,
            coordinates.longitude
        );

        this.#setOptionalValues(point, element, path, sourceFileName, warnings);

        return point;
    }

    #parseWaypoints(root, sourceFileName, warnings) {

        const waypoints = [];

        this.#children(root, WAYPOINT).forEach((element, index) => {

            const coordinates = this.#coordinates(element);
            const path = `wpt[${index + 1}]`;

            if (!coordinates) {
                warnings.push(this.#warning(
                    "INVALID_WAYPOINT",
                    "Waypointの緯度または経度が不正です",
                    path,
                    sourceFileName
                ));

                return;
            }

            const waypoint = new Waypoint(
                coordinates.latitude,
                coordinates.longitude
            );

            this.#setOptionalValues(
                waypoint,
                element,
                path,
                sourceFileName,
                warnings
            );

            waypoint.name = this.#text(element, "name");
            waypoint.description = this.#text(element, "desc");
            waypoint.symbol = this.#text(element, "sym");
            waypoint.type = this.#text(element, "type");

            waypoints.push(waypoint);
        });

        return waypoints;
    }

    #setOptionalValues(model, element, path, sourceFileName, warnings) {

        const elevation = this.#text(element, "ele");

        if (elevation !== null) {

            const value = Number(elevation);

            if (Number.isFinite(value)) {
                model.elevation = value;
            } else {
                warnings.push(this.#warning(
                    "INVALID_ELEVATION",
                    "elevationが不正なためnullとして扱いました",
                    path,
                    sourceFileName
                ));
            }
        }

        model.time = this.#text(element, "time");
    }

    #coordinates(element) {

        const latitudeText = element.getAttribute("lat");
        const longitudeText = element.getAttribute("lon");

        if (latitudeText === null || longitudeText === null) {
            return null;
        }

        const latitude = Number(latitudeText);
        const longitude = Number(longitudeText);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        return { latitude, longitude };
    }

    #children(element, localName) {

        return Array.from(element.children).filter(
            child => child.localName === localName
        );
    }

    #child(element, localName) {

        return this.#children(element, localName)[0] || null;
    }

    #text(element, localName) {

        const child = this.#child(element, localName);

        return child ? child.textContent.trim() || null : null;
    }

    #warning(code, message, path, sourceFileName) {

        return { code, message, path, sourceFileName };
    }

}