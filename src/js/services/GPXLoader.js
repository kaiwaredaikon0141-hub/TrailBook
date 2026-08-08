/**
 * Loads GPX text from a FileSystemFileHandle without parsing it.
 */
export default class GPXLoader {

    constructor({ TextDecoderClass = globalThis.TextDecoder } = {}) {

        this.TextDecoderClass = TextDecoderClass;
    }

    async getFile(fileHandle) {

        return fileHandle.getFile();
    }

    /**
     * @param {FileSystemFileHandle} fileHandle
     * @returns {Promise<{text: string, sourceFileName: string}>}
     */
    async load(fileHandle) {

        const file = await this.getFile(fileHandle);

        return {
            text: await this.decode(file),
            sourceFileName: fileHandle.name
        };
    }

    async decode(file) {

        const bytes = new Uint8Array(await file.arrayBuffer());
        const detected = this.#detectEncoding(bytes);

        if (detected !== undefined) {
            if (detected === null) {
                return this.#decode(bytes, "utf-8", false);
            }
            return this.#decodeWithFallback(bytes, detected);
        }

        try {
            return this.#decode(bytes, "utf-8", true);
        } catch {
            try {
                return this.#decode(bytes, "shift_jis", true);
            } catch {
                return this.#decode(bytes, "utf-8", false);
            }
        }
    }

    #detectEncoding(bytes) {

        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            return "utf-8";
        }

        if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
        if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
        if (bytes[0] === 0x3c && bytes[1] === 0x00 &&
            bytes[2] === 0x3f && bytes[3] === 0x00) {
            return "utf-16le";
        }
        if (bytes[0] === 0x00 && bytes[1] === 0x3c &&
            bytes[2] === 0x00 && bytes[3] === 0x3f) {
            return "utf-16be";
        }

        const prefix = String.fromCharCode(...bytes.subarray(0, 256));
        const declaration = prefix.match(
            /<\?xml\s[^>]*encoding\s*=\s*["']\s*([^"']+)\s*["']/i
        );

        return declaration ? this.#normalizeEncoding(declaration[1]) : undefined;
    }

    #normalizeEncoding(value) {

        const label = value.trim().toLowerCase().replaceAll("_", "-");
        const aliases = new Map([
            ["utf8", "utf-8"],
            ["utf-8", "utf-8"],
            ["utf-16", "utf-16le"],
            ["utf-16le", "utf-16le"],
            ["utf-16be", "utf-16be"],
            ["shift-jis", "shift_jis"],
            ["shiftjis", "shift_jis"],
            ["sjis", "shift_jis"],
            ["x-sjis", "shift_jis"],
            ["windows-31j", "shift_jis"],
            ["windows31j", "shift_jis"],
            ["cp932", "shift_jis"],
            ["ms932", "shift_jis"]
        ]);

        return aliases.get(label) ?? null;
    }

    #decodeWithFallback(bytes, encoding) {

        try {
            return this.#decode(bytes, encoding, true);
        } catch {
            return this.#decode(bytes, "utf-8", false);
        }
    }

    #decode(bytes, encoding, fatal) {

        return new this.TextDecoderClass(encoding, { fatal }).decode(bytes);
    }

}
