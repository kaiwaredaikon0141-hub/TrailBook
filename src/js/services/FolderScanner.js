import Folder from "../models/Folder.js";
import Library from "../models/Library.js";
import { isReservedLibraryFolderName } from "./LibraryReservedFolderPolicy.js";

const GPX_EXTENSION = ".gpx";

const MOBILE_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;
const CHROMIUM_PATTERN = /Chrome|Chromium|Edg\//i;

/**
 * Detects whether the current environment can open a Folder Library.
 * Capability and origin checks take priority over browser identification.
 *
 * @param {Window} browserWindow
 * @param {Navigator} browserNavigator
 * @returns {object}
 */
export function getFolderPickerSupport(
    browserWindow = window,
    browserNavigator = browserWindow.navigator || {}
) {

    const { protocol = "", hostname = "" } = browserWindow.location || {};
    const isSupportedOrigin = protocol === "https:" ||
        (protocol === "http:" &&
            (hostname === "localhost" || hostname === "127.0.0.1"));
    const isSecureContext = browserWindow.isSecureContext === true &&
        isSupportedOrigin;
    const hasDirectoryPicker =
        typeof browserWindow.showDirectoryPicker === "function";
    const userAgent = browserNavigator.userAgent || "";
    const isMobile = typeof browserNavigator.userAgentData?.mobile === "boolean"
        ? browserNavigator.userAgentData.mobile
        : MOBILE_PATTERN.test(userAgent);
    const isDesktopChromium = !isMobile &&
        CHROMIUM_PATTERN.test(userAgent);

    let reason = null;

    if (!isSecureContext) {
        reason = "insecure-context";
    } else if (!hasDirectoryPicker) {
        reason = "missing-api";
    }

    return {
        available: reason === null,
        reason,
        isSecureContext,
        hasDirectoryPicker,
        isDesktopChromium,
        isMobile
    };
}

/**
 * Opens the directory picker in read-only mode.
 * App handles the picker AbortError as a non-error cancellation.
 *
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function pickFolder(browserWindow = window) {

    const support = getFolderPickerSupport(
        browserWindow,
        browserWindow.navigator
    );

    if (!support.available) {
        const error = new Error("Folder picker is not available.");

        error.name = "NotSupportedError";
        throw error;
    }

    return browserWindow.showDirectoryPicker({ mode: "read" });
}

/**
 * Scans a directory and builds a library model.
 */
export default class FolderScanner {

    constructor() {

        this.lastScanDiagnostic = Object.freeze({
            directoryEntryCount: 0,
            gpxCandidateCount: 0,
            totalFileCount: 0,
            totalDirectoryCount: 0,
            rootHandleName: null,
            rootHandleKind: null,
            enumerationStartedAt: null,
            enumerationFinishedAt: null,
            gpxTailPaths: Object.freeze([])
        });
    }

    getLastScanDiagnostic() {

        return this.lastScanDiagnostic;
    }

    /**
     * Scans the selected directory recursively.
     *
     * @param {FileSystemDirectoryHandle} rootHandle
     * @returns {Promise<Library>}
     */
    async scan(rootHandle) {

        const diagnostic = {
            directoryEntryCount: 0,
            gpxCandidateCount: 0,
            totalFileCount: 0,
            totalDirectoryCount: 0,
            rootHandleName: rootHandle?.name || null,
            rootHandleKind: rootHandle?.kind || null,
            enumerationStartedAt: new Date().toISOString(),
            enumerationFinishedAt: null,
            gpxTailPaths: []
        };
        const rootFolder = await this.#scanFolder(
            rootHandle.name,
            rootHandle,
            diagnostic,
            ""
        );

        const counts = this.#countFolder(rootFolder);

        diagnostic.enumerationFinishedAt = new Date().toISOString();
        this.lastScanDiagnostic = Object.freeze({
            ...diagnostic,
            gpxTailPaths: Object.freeze([...diagnostic.gpxTailPaths])
        });
        return new Library(
            rootFolder.name,
            rootFolder,
            counts.folderCount,
            counts.gpxFileCount
        );
    }

    async #scanFolder(name, handle, diagnostic, relativeFolderPath) {

        const folder = new Folder(name, handle);

        for await (const entry of handle.values()) {

            diagnostic.directoryEntryCount += 1;
            const relativePath = relativeFolderPath
                ? `${relativeFolderPath}/${entry.name}`
                : entry.name;

            if (entry.kind === "directory") {

                diagnostic.totalDirectoryCount += 1;

                if (isReservedLibraryFolderName(entry.name)) {
                    continue;
                }

                folder.folders.push(
                    await this.#scanFolder(
                        entry.name,
                        entry,
                        diagnostic,
                        relativePath
                    )
                );

                continue;
            }

            if (entry.kind === "file") diagnostic.totalFileCount += 1;

            if (
                entry.kind === "file" &&
                entry.name.toLowerCase().endsWith(GPX_EXTENSION)
            ) {
                diagnostic.gpxCandidateCount += 1;
                diagnostic.gpxTailPaths.push(relativePath);
                if (diagnostic.gpxTailPaths.length > 10) {
                    diagnostic.gpxTailPaths.shift();
                }
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
