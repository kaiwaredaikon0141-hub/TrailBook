const ROOT_PATH = "";

/**
 * Builds path-based Tree metadata without owning UI or navigation state.
 */
export default class TreeMetadataBuilder {

    build(library) {

        const nodeMetadata = new Map();
        const fileHandlesByPath = new Map();
        const pathsByFileHandle = new Map();

        const visitFolder = (folder, path) => {

            nodeMetadata.set(path, {
                kind: "folder",
                path,
                parentPath: this.parentPath(path),
                name: folder.name,
                model: folder
            });

            folder.folders.forEach(childFolder => {
                visitFolder(childFolder, this.joinPath(path, childFolder.name));
            });

            folder.gpxFiles.forEach(fileHandle => {

                const filePath = this.joinPath(path, fileHandle.name);

                nodeMetadata.set(filePath, {
                    kind: "file",
                    path: filePath,
                    parentPath: path,
                    name: fileHandle.name,
                    model: fileHandle,
                    state: "idle",
                    checked: false,
                    color: null,
                    error: null
                });

                fileHandlesByPath.set(filePath, fileHandle);
                pathsByFileHandle.set(fileHandle, filePath);
            });
        };

        visitFolder(library.rootFolder, ROOT_PATH);

        return {
            library,
            rootHandle: library.rootFolder.handle,
            nodeMetadata,
            fileHandlesByPath,
            pathsByFileHandle
        };
    }

    filterExpandedPaths(paths, nodeMetadata) {

        return new Set(
            [...paths].filter(path => nodeMetadata.get(path)?.kind === "folder")
        );
    }

    findRestorableFocus(path, expandedPaths, nodeMetadata) {

        let candidate = path;

        while (candidate && !nodeMetadata.has(candidate)) {
            candidate = this.parentPath(candidate);
        }

        while (candidate && !expandedPaths.has(candidate)) {
            candidate = this.parentPath(candidate);
        }

        return candidate || ROOT_PATH;
    }

    collectDescendantFiles(folder, parentPath) {

        const entries = folder.gpxFiles.map(fileHandle => ({
            path: this.joinPath(parentPath, fileHandle.name),
            fileHandle
        }));

        folder.folders.forEach(childFolder => {
            entries.push(
                ...this.collectDescendantFiles(
                    childFolder,
                    this.joinPath(parentPath, childFolder.name)
                )
            );
        });

        return entries;
    }

    getFileEntries(nodeMetadata) {

        return [...nodeMetadata.values()]
            .filter(metadata => metadata.kind === "file")
            .map(metadata => ({
                path: metadata.path,
                fileHandle: metadata.model
            }));
    }

    getSearchSourceEntries(nodeMetadata) {

        return [...nodeMetadata.values()].map(metadata => ({
            kind: metadata.kind,
            path: metadata.path,
            name: metadata.name
        }));
    }

    parentPath(path) {

        if (!path) {
            return ROOT_PATH;
        }

        const separator = path.lastIndexOf("/");

        return separator < 0 ? ROOT_PATH : path.slice(0, separator);
    }

    joinPath(parentPath, name) {

        return parentPath ? `${parentPath}/${name}` : name;
    }

    isDescendant(path, parentPath) {

        return path.startsWith(`${parentPath}/`);
    }
}
