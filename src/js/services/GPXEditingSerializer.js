import TrackDateCorrectionService from "./TrackDateCorrectionService.js";
import TrackTranslationService from "./TrackTranslationService.js";
import TrackPointEditingService from "./TrackPointEditingService.js";

/**
 * Serializes a GPX working mask by cloning the immutable source XML.
 */
export default class GPXEditingSerializer {

    constructor({
        DOMParserClass = globalThis.DOMParser,
        XMLSerializerClass = globalThis.XMLSerializer,
        dateCorrection = new TrackDateCorrectionService(),
        translation = new TrackTranslationService(),
        pointEditing = new TrackPointEditingService({
            translationService: translation
        })
    } = {}) {

        this.DOMParserClass = DOMParserClass;
        this.XMLSerializerClass = XMLSerializerClass;
        this.dateCorrection = dateCorrection;
        this.translation = translation;
        this.pointEditing = pointEditing;
    }

    serialize(source, retainedPointMasks, {
        timeOffsetMs = 0,
        trackNameFileName = null,
        translation = null,
        pointEdits = []
    } = {}) {

        if (!source?.canSerialize) {
            throw this.#error(
                "SOURCE_NOT_SERIALIZABLE",
                "The GPX editing source cannot be serialized safely"
            );
        }

        this.#validateMasks(source, retainedPointMasks);

        const document = source.cloneDocument?.();

        if (!document?.documentElement) {
            throw this.#error(
                "SOURCE_DOCUMENT_UNAVAILABLE",
                "The immutable source document is unavailable"
            );
        }
        const trackElements = this.#children(document.documentElement, "trk");

        this.dateCorrection.apply(document, timeOffsetMs);
        this.#synchronizeSingleTrackName(
            document,
            trackElements,
            trackNameFileName
        );
        this.pointEditing.apply(document, pointEdits, retainedPointMasks);
        this.translation.apply(document, translation);

        trackElements.forEach((trackElement, trackIndex) => {
            const segmentElements = this.#children(trackElement, "trkseg");

            segmentElements.forEach((segmentElement, segmentIndex) => {
                const pointElements = this.#children(segmentElement, "trkpt");
                const pointMask = retainedPointMasks[trackIndex][segmentIndex];

                pointElements.forEach((pointElement, pointIndex) => {
                    if (!pointMask[pointIndex]) pointElement.remove();
                });
            });
        });

        const serialized = new this.XMLSerializerClass()
            .serializeToString(document)
            .replace(/^\s*<\?xml[^?]*\?>\s*/i, "")
            .replaceAll("\r\n", "\n")
            .replaceAll("\r", "\n")
            .trim();
        const output = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`;

        this.#verify(source, retainedPointMasks, output);

        return output;
    }

    #verify(source, masks, output) {

        const document = this.#parse(output);
        const root = document.documentElement;
        const trackElements = this.#children(root, "trk");

        if (
            root.getAttribute("version") !== source.rootVersion ||
            root.namespaceURI !== source.namespaceURI ||
            trackElements.length !== source.tracks.length ||
            this.#children(root, "wpt").length !== source.waypointCount ||
            this.#children(root, "rte").length !== source.routeCount
        ) {
            throw this.#error(
                "SERIALIZATION_VERIFICATION_FAILED",
                "The serialized GPX structure does not match the source"
            );
        }

        trackElements.forEach((trackElement, trackIndex) => {
            const segmentElements = this.#children(trackElement, "trkseg");

            if (segmentElements.length !== source.tracks[trackIndex].segments.length) {
                throw this.#error(
                    "SERIALIZATION_VERIFICATION_FAILED",
                    "The serialized TrackSegment structure changed"
                );
            }

            segmentElements.forEach((segmentElement, segmentIndex) => {
                const expected = masks[trackIndex][segmentIndex]
                    .filter(Boolean).length;

                if (this.#children(segmentElement, "trkpt").length !== expected) {
                    throw this.#error(
                        "SERIALIZATION_VERIFICATION_FAILED",
                        "The serialized TrackPoint count is invalid"
                    );
                }
            });
        });
    }

    #parse(xmlText) {

        if (!this.DOMParserClass || !this.XMLSerializerClass) {
            throw this.#error(
                "XML_API_UNAVAILABLE",
                "The browser XML APIs are unavailable"
            );
        }

        const document = new this.DOMParserClass().parseFromString(
            xmlText,
            "application/xml"
        );

        if (
            !document.documentElement ||
            document.documentElement.localName === "parsererror" ||
            document.getElementsByTagName("parsererror").length > 0 ||
            document.documentElement.localName !== "gpx"
        ) {
            throw this.#error("XML_PARSE_FAILED", "GPX XML is not well formed");
        }

        return document;
    }

    #validateMasks(source, masks) {

        if (!Array.isArray(masks) || masks.length !== source.tracks.length) {
            throw new TypeError("Track mask structure does not match the source");
        }

        source.tracks.forEach((track, trackIndex) => {
            if (
                !Array.isArray(masks[trackIndex]) ||
                masks[trackIndex].length !== track.segments.length
            ) {
                throw new TypeError("Segment mask structure does not match the source");
            }

            track.segments.forEach((segment, segmentIndex) => {
                const pointMask = masks[trackIndex][segmentIndex];

                if (
                    !Array.isArray(pointMask) ||
                    pointMask.length !== segment.points.length ||
                    pointMask.some(value => typeof value !== "boolean")
                ) {
                    throw new TypeError("Point mask structure does not match the source");
                }
            });
        });
    }

    #synchronizeSingleTrackName(document, trackElements, fileName) {

        if (
            trackElements.length !== 1 ||
            typeof fileName !== "string" ||
            !fileName.toLowerCase().endsWith(".gpx")
        ) return;

        const track = trackElements[0];
        let name = this.#children(track, "name")[0];

        if (!name) {
            name = document.createElementNS(
                track.namespaceURI || document.documentElement.namespaceURI,
                "name"
            );
            track.insertBefore(name, track.firstElementChild);
        }

        name.textContent = fileName.slice(0, -4);
    }

    #children(element, localName) {

        return Array.from(element?.children || []).filter(
            child => child.localName === localName
        );
    }

    #error(code, message) {

        const error = new Error(message);
        error.code = code;
        return error;
    }
}
