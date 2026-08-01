import {
    createEmptySharedSettingsSnapshot
} from "../utils/SharedSettingsSchema.js";

const SOURCES = new Set(["shared-json", "legacy-local", "auto"]);
const STATUSES = new Set([
    "idle",
    "loading",
    "loaded",
    "missing",
    "invalid",
    "read-failed"
]);

function cloneFolderColors(folderColors) {

    const clone = Object.create(null);

    Object.entries(folderColors || {}).forEach(([path, color]) => {
        clone[path] = color;
    });

    return clone;
}

function cloneSnapshot(snapshot, schemaVersion) {

    return {
        schemaVersion: snapshot?.schemaVersion ?? schemaVersion,
        folderColors: cloneFolderColors(snapshot?.folderColors)
    };
}

/**
 * Owns the active Library shared-settings load result without filesystem or UI.
 */
export default class LibrarySettingsState {

    constructor({ schemaVersion } = {}) {

        this.schemaVersion = schemaVersion;
        this.requestId = 0;
        this.reset();
    }

    reset() {

        this.requestId += 1;
        this.source = "auto";
        this.status = "idle";
        this.dirty = false;
        this.fileExists = false;
        this.snapshot = createEmptySharedSettingsSnapshot(this.schemaVersion);
        this.fingerprint = null;
        this.lastModified = null;
        this.size = null;
        this.errorCode = null;

        return this.requestId;
    }

    beginLoad() {

        const requestId = this.reset();

        this.status = "loading";

        return requestId;
    }

    isCurrentRequest(requestId) {

        return requestId === this.requestId;
    }

    applyLoad(requestId, result, legacyFolderColors = {}) {

        if (
            !this.isCurrentRequest(requestId) ||
            !STATUSES.has(result?.status) ||
            result.status === "idle" ||
            result.status === "loading" ||
            (result.status === "loaded" && !result.snapshot)
        ) {
            return false;
        }

        const hasLegacyColors = Object.keys(legacyFolderColors).length > 0;
        let source = "auto";
        let snapshot = createEmptySharedSettingsSnapshot(this.schemaVersion);

        if (result.status === "loaded" && result.snapshot) {
            source = "shared-json";
            snapshot = cloneSnapshot(result.snapshot, this.schemaVersion);
        } else if (
            result.fallbackAllowed === true &&
            hasLegacyColors
        ) {
            source = "legacy-local";
            snapshot.folderColors = cloneFolderColors(legacyFolderColors);
        }

        if (!SOURCES.has(source)) {
            return false;
        }

        this.source = source;
        this.status = result.status;
        this.dirty = false;
        this.fileExists = result.fileExists;
        this.snapshot = snapshot;
        this.fingerprint = result.fingerprint ?? null;
        this.lastModified = result.lastModified ?? null;
        this.size = result.size ?? null;
        this.errorCode = result.errorCode ?? null;

        return true;
    }

    getSnapshot() {

        return cloneSnapshot(this.snapshot, this.schemaVersion);
    }

    getStatus() {

        return {
            source: this.source,
            status: this.status,
            dirty: this.dirty,
            fileExists: this.fileExists,
            fingerprint: this.fingerprint,
            lastModified: this.lastModified,
            size: this.size,
            errorCode: this.errorCode
        };
    }
}
