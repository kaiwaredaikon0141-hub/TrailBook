import Folder from "../models/Folder.js";
import Library from "../models/Library.js";
import { isReservedLibraryFolderName } from "./LibraryReservedFolderPolicy.js";
import drivePerformance from "./DrivePerformanceMonitor.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GPX_MIME_FALLBACK = "application/gpx+xml";

export class DriveFileHandle {

    constructor(entry, service) {

        this.kind = "file";
        this.name = entry.name;
        this.driveEntry = Object.freeze({ ...entry });
        this.service = service;
    }

    getFile() {

        return this.service.downloadFile(this.driveEntry);
    }

    isSameEntry(other) {

        return Promise.resolve(other?.driveEntry?.fileId === this.driveEntry.fileId);
    }
}

export class DriveDirectoryHandle {

    constructor({ fileId, name, relativePath = "" }) {

        this.kind = "directory";
        this.name = name;
        this.driveEntry = Object.freeze({ fileId, name, relativePath });
        this.children = [];
    }

    async *values() {

        yield* this.children;
    }

    async getFileHandle(name, { create = false } = {}) {

        if (create) throw createDOMException("NotAllowedError", "Drive is read-only");
        const handle = this.children.find(entry =>
            entry.kind === "file" && entry.name === name
        );

        if (!handle) throw createDOMException("NotFoundError", "File not found");
        return handle;
    }

    queryPermission() {

        return Promise.resolve("granted");
    }

    requestPermission({ mode = "read" } = {}) {

        return Promise.resolve(mode === "read" ? "granted" : "denied");
    }

    isSameEntry(other) {

        return Promise.resolve(other?.driveEntry?.fileId === this.driveEntry.fileId);
    }
}

function createDOMException(name, message) {

    if (typeof DOMException === "function") return new DOMException(message, name);
    const error = new Error(message);

    error.name = name;
    return error;
}

/** Scans Drive metadata and exposes lazy, read-only File-like handles. */
export default class DriveLibraryService {

    constructor({
        getAccessToken,
        apiKey = "",
        fetchFunction = globalThis.fetch?.bind(globalThis),
        onAuthorizationInvalid = () => {}
    } = {}) {

        this.getAccessToken = getAccessToken;
        this.apiKey = apiKey;
        this.fetchFunction = fetchFunction;
        this.onAuthorizationInvalid = onAuthorizationInvalid;
        this.downloads = 0;
    }

    async scan({ id, name }) {

        drivePerformance.recordComponentCall("DriveLibraryService.scan");
        const endMetadataScan = drivePerformance.begin("metadataScanMs");
        const rootHandle = new DriveDirectoryHandle({ fileId: id, name });
        const rootFolder = new Folder(name, rootHandle);
        const queue = [{ id, path: "", folder: rootFolder, handle: rootHandle }];
        let folderCount = 1;
        let gpxFileCount = 0;

        while (queue.length > 0) {
            const current = queue.shift();
            const entries = await this.#listChildren(current.id);

            for (const entry of entries) {
                const relativePath = current.path
                    ? `${current.path}/${entry.name}`
                    : entry.name;

                if (entry.mimeType === FOLDER_MIME_TYPE) {
                    if (
                        isReservedLibraryFolderName(entry.name) ||
                        entry.name.startsWith(".")
                    ) continue;

                    const handle = new DriveDirectoryHandle({
                        fileId: entry.id,
                        name: entry.name,
                        relativePath
                    });
                    const folder = new Folder(entry.name, handle);

                    current.handle.children.push(handle);
                    current.folder.folders.push(folder);
                    queue.push({ id: entry.id, path: relativePath, folder, handle });
                    folderCount += 1;
                    continue;
                }

                const isRootSettings = current.path === "" &&
                    entry.name === "trailbook.json";
                const isGPX = entry.name.toLowerCase().endsWith(".gpx");

                if (!isGPX && !isRootSettings) continue;

                const handle = new DriveFileHandle({
                    fileId: entry.id,
                    relativePath,
                    name: entry.name,
                    mimeType: entry.mimeType || (isGPX ? GPX_MIME_FALLBACK : ""),
                    size: Number(entry.size) || 0,
                    modifiedTime: entry.modifiedTime || null,
                    parentId: current.id
                }, this);

                current.handle.children.push(handle);
                if (isGPX) {
                    current.folder.gpxFiles.push(handle);
                    gpxFileCount += 1;
                }
            }

            await Promise.resolve();
        }

        const library = new Library(name, rootFolder, folderCount, gpxFileCount);

        library.sourceType = "google-drive";
        library.readOnly = true;
        library.driveRootId = id;
        endMetadataScan();
        return library;
    }

    async downloadFile(entry) {

        const isSettings = entry.relativePath === "trailbook.json";
        if (!isSettings) {
        }
        drivePerformance.recordComponentCall(
            isSettings
                ? "DriveLibraryService.settingsDownload"
                : "DriveLibraryService.gpxDownload"
        );
        const endDownload = drivePerformance.begin(
            isSettings ? "settingsDownloadMs" : "gpxDownloadMs",
            isSettings ? "settingsDownloadCount" : "gpxDownloadCount"
        );
        this.downloads += 1;
        let bytes;

        try {
            const response = await this.#request(
                `${DRIVE_API}/${encodeURIComponent(entry.fileId)}?alt=media`
            );
            bytes = await response.arrayBuffer();
        } finally {
            endDownload();
        }
        const options = {
            type: entry.mimeType || "application/octet-stream",
            lastModified: Date.parse(entry.modifiedTime) || 0
        };

        if (typeof File === "function") {
            return new File([bytes], entry.name, options);
        }

        const blob = new Blob([bytes], options);

        Object.defineProperties(blob, {
            name: { value: entry.name },
            lastModified: { value: options.lastModified }
        });
        return blob;
    }

    getDownloadCount() {

        return this.downloads;
    }

    async #listChildren(folderId) {

        const entries = [];
        let pageToken = "";

        do {
            drivePerformance.increment("filesListRequests");
            const parameters = new URLSearchParams({
                q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
                fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,trashed)",
                pageSize: "1000",
                supportsAllDrives: "true",
                includeItemsFromAllDrives: "true"
            });

            if (pageToken) parameters.set("pageToken", pageToken);
            if (this.apiKey) parameters.set("key", this.apiKey);
            const response = await this.#request(`${DRIVE_API}?${parameters}`);
            const page = await response.json();

            entries.push(...(Array.isArray(page.files) ? page.files : []));
            pageToken = page.nextPageToken || "";
        } while (pageToken);

        return entries;
    }

    async #request(url) {

        const token = this.getAccessToken?.();

        if (!token) throw this.#error("token-expired", "Drive authorization expired");

        let response;
        const requestType = url.includes("alt=media")
            ? "files.get"
            : "files.list";
        const requestOptions = {
            headers: { Authorization: `Bearer ${token}` }
        };

        try {
            response = await this.fetchFunction(url, requestOptions);
        } catch (cause) {
            console.error("[TrailBook Drive] Drive API fetch rejected", {
                requestType,
                name: cause?.name || "Error",
                message: cause?.message || "Unknown fetch error"
            });
            const error = this.#error(
                "network-error",
                "Google Drive network request failed"
            );

            error.fetchExceptionName = cause?.name || "Error";
            error.fetchExceptionMessage = cause?.message ||
                "Unknown fetch error";
            throw error;
        }

        let apiError = null;

        if (!response.ok) {
            try {
                apiError = (await response.clone().json())?.error || null;
            } catch {
                apiError = null;
            }
        }

        if (response.status === 401) {
            this.onAuthorizationInvalid();
            throw this.#error(
                "api-unauthorized",
                "Google Drive authorization expired",
                response.status,
                apiError
            );
        }
        if (response.status === 403 || response.status === 404) {
            throw this.#error(
                "folder-inaccessible",
                "Google Drive folder is inaccessible",
                response.status,
                apiError
            );
        }
        if (!response.ok) {
            throw this.#error(
                "network-error",
                `Google Drive request failed (${response.status})`,
                response.status,
                apiError
            );
        }
        return response;
    }

    #error(code, message, httpStatus = null, apiError = null) {

        const error = new Error(message);

        error.code = code;
        error.httpStatus = httpStatus;
        error.apiErrorCode = apiError?.code || null;
        error.apiErrorMessage = apiError?.message || null;
        return error;
    }
}
