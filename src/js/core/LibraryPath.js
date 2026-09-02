export function normalizeLibraryRelativePath(path) {

    if (typeof path !== "string") return null;
    const normalized = path.replaceAll("\\", "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+|\/+$/g, "")
        .replace(/\/{2,}/g, "/");

    if (!normalized || normalized.split("/").some(
        segment => !segment || segment === "." || segment === ".."
    )) return null;
    return normalized;
}

export function folderPathFromLibraryTrackPath(path) {

    const normalized = normalizeLibraryRelativePath(path);

    if (!normalized) return null;
    const separator = normalized.lastIndexOf("/");

    return separator < 0 ? "" : normalized.slice(0, separator);
}
