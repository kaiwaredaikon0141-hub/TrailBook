import GPXEditingSourceLoader from "./GPXEditingSourceLoader.js";

/**
 * Verifies closed edited and Backup GPX files through the editing loader.
 */
export default class GPXEditingSaveVerifier {

    constructor({
        sourceLoader = new GPXEditingSourceLoader(),
        TextDecoderClass = globalThis.TextDecoder
    } = {}) {

        this.sourceLoader = sourceLoader;
        this.TextDecoderClass = TextDecoderClass;
    }

    async verify(fileHandle, source, retainedPointMasks, relativePath) {

        const file = await fileHandle.getFile();
        const bytes = new Uint8Array(await file.arrayBuffer());

        this.#verifyEncoding(bytes);

        const restored = await this.sourceLoader.load(fileHandle, relativePath);

        if (!restored.canSerialize) {
            throw this.#error("VERIFICATION_FAILED", "Saved GPX is not safely parseable");
        }

        this.#verifyStructure(restored, source, retainedPointMasks);

        return Object.freeze({ file, source: restored });
    }

    async verifyBackup(fileHandle, expectedBytes = null) {

        const file = await fileHandle.getFile();
        const actualBytes = new Uint8Array(await file.arrayBuffer());

        if (actualBytes.length === 0) {
            throw this.#error("BACKUP_VERIFICATION_FAILED", "Backup GPX is empty");
        }

        if (expectedBytes && !this.#bytesEqual(actualBytes, expectedBytes)) {
            throw this.#error(
                "BACKUP_VERIFICATION_FAILED",
                "Backup GPX does not match the immutable source bytes"
            );
        }

        const restored = await this.sourceLoader.load(fileHandle, fileHandle.name);

        if (!restored.canSerialize) {
            throw this.#error(
                "BACKUP_VERIFICATION_FAILED",
                "Backup GPX is not safely parseable"
            );
        }

        return Object.freeze({ file, source: restored, bytes: actualBytes });
    }

    #verifyEncoding(bytes) {

        if (!this.TextDecoderClass || bytes.length === 0) {
            throw this.#error("VERIFICATION_FAILED", "Saved GPX is empty or cannot be decoded");
        }

        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            throw this.#error("VERIFICATION_FAILED", "Saved GPX contains a UTF-8 BOM");
        }

        let text;

        try {
            text = new this.TextDecoderClass("utf-8", { fatal: true }).decode(bytes);
        } catch {
            throw this.#error("VERIFICATION_FAILED", "Saved GPX is not valid UTF-8");
        }

        if (
            !text.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n") ||
            text.includes("\r") ||
            !text.endsWith("\n") ||
            text.endsWith("\n\n")
        ) {
            throw this.#error("VERIFICATION_FAILED", "Saved GPX formatting is invalid");
        }
    }

    #verifyStructure(restored, source, masks) {

        if (
            restored.rootVersion !== source.rootVersion ||
            restored.namespaceURI !== source.namespaceURI ||
            restored.waypointCount !== source.waypointCount ||
            restored.routeCount !== source.routeCount ||
            restored.tracks.length !== source.tracks.length
        ) {
            throw this.#error("VERIFICATION_FAILED", "Saved GPX structure changed");
        }

        source.tracks.forEach((track, trackIndex) => {
            const restoredTrack = restored.tracks[trackIndex];

            if (restoredTrack?.segments.length !== track.segments.length) {
                throw this.#error("VERIFICATION_FAILED", "Saved TrackSegment count changed");
            }

            track.segments.forEach((segment, segmentIndex) => {
                const expected = masks[trackIndex][segmentIndex]
                    .filter(Boolean).length;
                const actual = restoredTrack.segments[segmentIndex]?.points.length;

                if (actual !== expected) {
                    throw this.#error("VERIFICATION_FAILED", "Saved TrackPoint count is invalid");
                }
            });
        });
    }

    #bytesEqual(first, second) {

        return first.length === second.length &&
            first.every((value, index) => value === second[index]);
    }

    #error(code, message) {

        const error = new Error(message);
        error.code = code;
        return error;
    }
}
