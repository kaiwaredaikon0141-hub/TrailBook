import Folder from "../models/Folder.js";
import Library from "../models/Library.js";

const GPX_EXTENSION = ".gpx";

/**
 * Opens a directory picker without treating cancellation as an error.
 *
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export async function pickFolder() {

    if (!window.showDirectoryPicker) {

        alert("このブラウザはFile System Access APIに対応していません。");

        return null;
    }

    return window.showDirectoryPicker();
}

/**
 * Builds a library model from a directory handle.
 */
export default class FolderScanner {

    /**
     * @param {FileSystemDirectoryHandle} rootHandle
     * @returns {Promise<Library>}
     */
    async scan(rootHandle) {

        const rootFolder = await this.#scanFolder(
            rootHandle.name,
            rootHandle
        );

        const counts = this.#countFolder(rootFolder);

        return new Library(
            rootFolder.name,
            rootFolder,
            counts.folderCount,
            counts.gpxFileCount
        );
    }

    async #scanFolder(name, handle) {

        const folder = new Folder(name, handle);

        for await (const entry of handle.values()) {

            if (entry.kind === "directory") {

                folder.folders.push(
                    await this.#scanFolder(entry.name, entry)
                );

                continue;
            }

            if (
                entry.kind === "file" &&
                entry.name.toLowerCase().endsWith(GPX_EXTENSION)
            ) {
                folder.gpxFiles.push(entry);
            }
        }

        return folder;
    }

    #countFolder(folder) {

        return folder.folders.reduce(
            (counts, childFolder) => {

                const childCounts = this.#countFolder(childFolder);

                return {
                    folderCount: counts.folderCount + childCounts.folderCount,
                    gpxFileCount: counts.gpxFileCount + childCounts.gpxFileCount
                };
            },
            {
                folderCount: 1,
                gpxFileCount: folder.gpxFiles.length
            }
        );
    }

}