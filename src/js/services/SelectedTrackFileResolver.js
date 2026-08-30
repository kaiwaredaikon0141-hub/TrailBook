export function normalizeSelectedTrackPath(relativePath) {

    return typeof relativePath === "string"
        ? relativePath.replaceAll("\\", "/")
        : null;
}

function splitRelativePath(relativePath) {

    const normalized = normalizeSelectedTrackPath(relativePath);

    if (normalized === null) return null;

    const parts = normalized.split("/");

    if (
        parts.length === 0 ||
        parts.some(part => !part || part === "." || part === "..")
    ) return null;

    return parts;
}

/**
 * Resolves one selected GPX against the actual File System Access handles.
 * This deliberately does not enumerate or reconcile the whole Library.
 */
export default class SelectedTrackFileResolver {

    async resolve(rootDirectoryHandle, relativePath) {

        const parts = splitRelativePath(relativePath);

        if (
            !parts || rootDirectoryHandle?.kind !== "directory" ||
            typeof rootDirectoryHandle.getDirectoryHandle !== "function" ||
            typeof rootDirectoryHandle.getFileHandle !== "function"
        ) return null;

        let parentFolderHandle = rootDirectoryHandle;
        try {
            for (const folderName of parts.slice(0, -1)) {
                parentFolderHandle = await parentFolderHandle
                    .getDirectoryHandle(folderName, { create: false });
            }

            const fileHandle = await parentFolderHandle.getFileHandle(
                parts.at(-1),
                { create: false }
            );

            if (
                fileHandle?.kind !== "file" ||
                typeof fileHandle.createWritable !== "function"
            ) {
                return null;
            }

            return Object.freeze({
                path: relativePath,
                relativePath,
                parentPath: parts.slice(0, -1).join("/"),
                parentFolderHandle,
                fileHandle
            });
        } catch {
            return null;
        }
    }
}
