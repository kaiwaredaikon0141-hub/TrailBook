import { normalizeLibraryRelativePath } from "./LibraryPath.js";

const ROOT_SENTINEL = "/";
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function canonicalFolderKey(folderPath) {

    if (folderPath === "") return ROOT_SENTINEL;
    const normalized = normalizeLibraryRelativePath(folderPath);

    if (!normalized) {
        throw new TypeError("A canonical Library Folder path is required.");
    }
    return normalized;
}

function fnv1a32(value) {

    let hash = FNV_OFFSET_BASIS;
    const bytes = new TextEncoder().encode(value);

    bytes.forEach(byte => {
        hash ^= byte;
        hash = Math.imul(hash, FNV_PRIME) >>> 0;
    });
    return hash >>> 0;
}

/** Resolves an Auto Folder color from only its canonical path and palette. */
export default class FolderAutoColorResolver {

    constructor(palette) {

        if (!Array.isArray(palette) || palette.length === 0 ||
            palette.some(color => !HEX_COLOR_PATTERN.test(color))) {
            throw new TypeError("A non-empty hexadecimal color palette is required.");
        }
        this.palette = Object.freeze([...palette]);
    }

    resolve(folderPath) {

        const key = canonicalFolderKey(folderPath);

        return this.palette[fnv1a32(key) % this.palette.length];
    }
}

export { canonicalFolderKey, fnv1a32 };
