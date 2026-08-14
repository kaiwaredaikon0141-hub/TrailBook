import GPXLoader from "./GPXLoader.js";
import GPXParser from "./GPXParser.js";

const LOSSY_DECODE = "LOSSY_DECODE";
const XML_PARSE_FAILED = "XML_PARSE_FAILED";
const GPX_PARSE_FAILED = "GPX_PARSE_FAILED";
const DOM_MAPPING_MISMATCH = "DOM_MAPPING_MISMATCH";

/**
 * Loads an immutable GPX editing source without changing Viewer state.
 */
export default class GPXEditingSourceLoader {

    constructor({
        loader = new GPXLoader(),
        parser = new GPXParser(),
        DOMParserClass = globalThis.DOMParser
    } = {}) {

        this.loader = loader;
        this.parser = parser;
        this.DOMParserClass = DOMParserClass;
    }

    /**
     * @param {FileSystemFileHandle} fileHandle
     * @param {string} relativePath
     * @returns {Promise<object>}
     */
    async load(fileHandle, relativePath) {

        const file = await this.loader.getFile(fileHandle);
        const sourceBytes = new Uint8Array(await file.arrayBuffer());
        const xmlText = this.loader.decodeBytes(sourceBytes);
        const reasons = [];

        if (xmlText.includes("\uFFFD")) {
            reasons.push(LOSSY_DECODE);
        }

        const document = this.#parseDocument(xmlText);
        let parsed = null;

        if (!document) {
            reasons.push(XML_PARSE_FAILED);
        } else {
            try {
                parsed = this.parser.parse(xmlText, file.name);
            } catch {
                reasons.push(GPX_PARSE_FAILED);
            }
        }

        const mapping = this.#createMapping(document, parsed);

        if (!mapping.isValid) {
            reasons.push(DOM_MAPPING_MISMATCH);
        }

        return Object.freeze({
            fileHandle,
            relativePath,
            sourceFileName: file.name || fileHandle.name,
            xmlText,
            fingerprint: Object.freeze({
                size: file.size,
                lastModified: file.lastModified
            }),
            getSourceBytes: () => sourceBytes.slice(),
            rootVersion: document?.documentElement?.getAttribute("version") || null,
            namespaceURI: document?.documentElement?.namespaceURI || null,
            tracks: mapping.tracks,
            waypointCount: document ? this.#children(document.documentElement, "wpt").length : 0,
            routeCount: document ? this.#children(document.documentElement, "rte").length : 0,
            cloneDocument: document ? () => document.cloneNode(true) : null,
            canSerialize: reasons.length === 0,
            saveBlockReasons: Object.freeze([...new Set(reasons)])
        });
    }

    #parseDocument(xmlText) {

        if (!this.DOMParserClass) return null;

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
            return null;
        }

        return document;
    }

    #createMapping(document, parsed) {

        if (!document || !parsed) {
            return { isValid: false, tracks: Object.freeze([]) };
        }

        const trackElements = this.#children(document.documentElement, "trk");
        const tracks = [];
        let isValid = trackElements.length === parsed.tracks.length;

        trackElements.forEach((trackElement, trackIndex) => {
            const segmentElements = this.#children(trackElement, "trkseg");
            const parsedTrack = parsed.tracks[trackIndex];
            const segments = [];

            if (!parsedTrack || segmentElements.length !== parsedTrack.segments.length) {
                isValid = false;
            }

            segmentElements.forEach((segmentElement, segmentIndex) => {
                const pointElements = this.#children(segmentElement, "trkpt");
                const parsedSegment = parsedTrack?.segments[segmentIndex];
                const points = pointElements.map((element, pointIndex) => {
                    const latitude = Number(element.getAttribute("lat"));
                    const longitude = Number(element.getAttribute("lon"));
                    const parsedPoint = parsedSegment?.points[pointIndex];

                    if (
                        !parsedPoint ||
                        parsedPoint.latitude !== latitude ||
                        parsedPoint.longitude !== longitude
                    ) {
                        isValid = false;
                    }

                    return Object.freeze({ latitude, longitude });
                });

                if (!parsedSegment || pointElements.length !== parsedSegment.points.length) {
                    isValid = false;
                }

                segments.push(Object.freeze({
                    trackIndex,
                    segmentIndex,
                    points: Object.freeze(points)
                }));
            });

            tracks.push(Object.freeze({
                trackIndex,
                name: parsedTrack?.name || null,
                segments: Object.freeze(segments)
            }));
        });

        return {
            isValid,
            tracks: Object.freeze(tracks)
        };
    }

    #children(element, localName) {

        return Array.from(element?.children || []).filter(
            child => child.localName === localName
        );
    }
}

export const GPX_EDITING_SOURCE_BLOCK_REASONS = Object.freeze({
    LOSSY_DECODE,
    XML_PARSE_FAILED,
    GPX_PARSE_FAILED,
    DOM_MAPPING_MISMATCH
});
