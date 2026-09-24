import { normalizeLibraryRelativePath } from "../core/LibraryPath.js";
import Folder from "../models/Folder.js";
import Library from "../models/Library.js";
import { isReservedLibraryFolderName } from "./LibraryReservedFolderPolicy.js";

const GPX_EXTENSION = ".gpx";
let fallbackSessionSequence = 0;

function namedError(name, message) {

    const error = new Error(message);

    error.name = name;
    return error;
}

function createFileHandle(file, relativePath) {

    return Object.freeze({
        kind: "file",
        name: file.name,
        relativePath,
        readOnly: true,
        getFile: async () => file
    });
}

function createDirectoryHandle(name, files = new Map()) {

    return Object.freeze({
        kind: "directory",
        name,
        readOnly: true,
        async getFileHandle(fileName, { create = false } = {}) {
            if (create) {
                throw namedError(
                    "NotAllowedError",
                    "The selected Folder is read-only."
                );
            }
            const handle = files.get(fileName);

            if (!handle) {
                throw namedError("NotFoundError", `${fileName} was not selected.`);
            }
            return handle;
        }
    });
}

function defaultSessionId() {

    return globalThis.crypto?.randomUUID?.() ||
        `${Date.now().toString(36)}-${++fallbackSessionSequence}`;
}

function normalizeSelectedPath(file) {

    const rawPath = typeof file?.webkitRelativePath === "string"
        ? file.webkitRelativePath.replaceAll("\\", "/")
        : "";
    const segments = rawPath.split("/");

    if (
        segments.length < 2 ||
        segments.some(segment => !segment || segment === "." || segment === "..")
    ) {
        throw namedError(
            "DataError",
            "The selected Folder contains an invalid relative path."
        );
    }
    const rootName = segments.shift();
    const relativePath = normalizeLibraryRelativePath(segments.join("/"));

    if (!rootName || !relativePath) {
        throw namedError(
            "DataError",
            "The selected Folder contains an empty relative path."
        );
    }
    return { rootName, relativePath };
}

/**
 * Reconstructs a session-only, read-only Library from a directory FileList.
 */
export default class FileListDirectorySource {

    constructor({ createSessionId = defaultSessionId } = {}) {

        this.createSessionId = createSessionId;
        this.lastScanDiagnostic = null;
    }

    getLastScanDiagnostic() {

        return this.lastScanDiagnostic;
    }

    async scan(fileList) {

        const files = Array.from(fileList || []);

        if (files.length === 0) {
            throw namedError("AbortError", "No Folder files were selected.");
        }

        let rootName = null;
        const selected = [];
        const canonicalPaths = new Set();

        files.forEach(file => {
            const normalized = normalizeSelectedPath(file);

            rootName ??= normalized.rootName;
            if (normalized.rootName !== rootName) {
                throw namedError(
                    "DataError",
                    "The selection contains files from more than one root Folder."
                );
            }
            if (canonicalPaths.has(normalized.relativePath)) {
                throw namedError(
                    "DataError",
                    `The selected Folder contains a path collision: ${normalized.relativePath}`
                );
            }
            canonicalPaths.add(normalized.relativePath);
            selected.push({ file, ...normalized });
        });

        const sessionId = String(this.createSessionId());
        const rootFiles = new Map();
        const rootHandle = createDirectoryHandle(rootName, rootFiles);
        const rootFolder = new Folder(rootName, rootHandle);
        const folders = new Map([["", rootFolder]]);
        let gpxFileCount = 0;
        let totalFileCount = 0;

        selected.sort((left, right) =>
            left.relativePath.localeCompare(right.relativePath));
        selected.forEach(({ file, relativePath }) => {
            const segments = relativePath.split("/");
            const fileName = segments.pop();

            if (segments.some(isReservedLibraryFolderName)) return;
            totalFileCount += 1;

            let folderPath = "";
            let folder = rootFolder;

            segments.forEach(name => {
                const nextPath = folderPath ? `${folderPath}/${name}` : name;

                if (!folders.has(nextPath)) {
                    const child = new Folder(name, createDirectoryHandle(name));

                    folder.folders.push(child);
                    folders.set(nextPath, child);
                }
                folder = folders.get(nextPath);
                folderPath = nextPath;
            });

            const handle = createFileHandle(file, relativePath);

            if (!folderPath) rootFiles.set(fileName, handle);
            if (fileName.toLowerCase().endsWith(GPX_EXTENSION)) {
                folder.gpxFiles.push(handle);
                gpxFileCount += 1;
            }
        });

        const library = new Library(
            rootName,
            rootFolder,
            folders.size,
            gpxFileCount
        );

        library.sourceType = "file-list";
        library.readOnly = true;
        library.identityName = `file-list-session-${sessionId}`;
        library.cacheNamespace = `file-list-session:${sessionId}`;
        library.capabilities = Object.freeze({
            sourceType: "file-list",
            readOnly: true,
            persistent: false,
            refreshMode: "reselect",
            sharedSettingsWritable: false
        });
        this.lastScanDiagnostic = Object.freeze({
            directoryEntryCount: selected.length,
            gpxCandidateCount: gpxFileCount,
            totalFileCount,
            totalDirectoryCount: Math.max(0, folders.size - 1),
            rootHandleName: rootName,
            rootHandleKind: "file-list",
            enumerationStartedAt: null,
            enumerationFinishedAt: new Date().toISOString(),
            gpxTailPaths: Object.freeze(selected
                .map(entry => entry.relativePath)
                .filter(path => path.toLowerCase().endsWith(GPX_EXTENSION))
                .slice(-10))
        });

        return library;
    }
}
