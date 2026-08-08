const EMPTY_ROOT_NAME = "unnamed";
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function createLibraryId(rootFolderName) {

    const trimmedName = typeof rootFolderName === "string"
        ? rootFolderName.trim()
        : "";

    return `root-name:${encodeURIComponent(trimmedName || EMPTY_ROOT_NAME)}`;
}

export function isValidLibraryId(libraryId) {

    return typeof libraryId === "string" &&
        libraryId.startsWith("root-name:") &&
        libraryId.length > "root-name:".length &&
        !DANGEROUS_KEYS.has(libraryId) &&
        !CONTROL_CHARACTER_PATTERN.test(libraryId);
}
