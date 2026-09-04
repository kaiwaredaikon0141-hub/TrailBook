import {
    normalizeLibraryRelativePath,
    folderPathFromLibraryTrackPath
} from "./LibraryPath.js";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function canonicalTrackFolderPath(relativePath, folderPath = undefined) {

    const normalizedPath = normalizeLibraryRelativePath(relativePath);

    if (!normalizedPath) {
        throw new TypeError("A canonical Library Track path is required.");
    }
    const derivedFolderPath = folderPathFromLibraryTrackPath(normalizedPath);

    if (folderPath === undefined) return derivedFolderPath;
    const normalizedFolderPath = folderPath === "" || folderPath === "/"
        ? ""
        : normalizeLibraryRelativePath(folderPath);

    if (normalizedFolderPath === null) {
        throw new TypeError("A canonical Library Folder path is required.");
    }
    if (normalizedFolderPath !== derivedFolderPath) {
        throw new RangeError("Track and Folder paths do not identify the same Folder.");
    }
    return normalizedFolderPath;
}

/** Resolves a Track color only through its canonical Folder membership. */
export default class TrackColorResolver {

    constructor({ resolveFolderColor } = {}) {

        if (typeof resolveFolderColor !== "function") {
            throw new TypeError("A Folder color resolver is required.");
        }
        this.resolveFolderColor = resolveFolderColor;
    }

    resolve(relativePath, folderPath = undefined) {

        const canonicalFolderPath = canonicalTrackFolderPath(
            relativePath,
            folderPath
        );
        const color = this.resolveFolderColor(canonicalFolderPath);

        if (!HEX_COLOR_PATTERN.test(color)) {
            throw new TypeError("The resolved Folder color must be hexadecimal.");
        }
        return color;
    }
}

export { canonicalTrackFolderPath };
