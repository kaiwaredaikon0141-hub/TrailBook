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
        this.saveRequestId = 0;
        this.reloadRequestId = 0;
        this.reset();
    }

    reset() {

        this.requestId += 1;
        this.saveRequestId += 1;
        this.reloadRequestId += 1;
        this.source = "auto";
        this.status = "idle";
        this.dirty = false;
        this.saving = false;
        this.reloading = false;
        this.saveOperation = null;
        this.saveStatus = "idle";
        this.saveErrorCode = null;
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

        return this.#applyResult(result, legacyFolderColors);
    }

    beginReload() {

        if (this.saving || this.reloading) {
            return null;
        }

        this.reloadRequestId += 1;
        this.reloading = true;

        return this.reloadRequestId;
    }

    isCurrentReload(reloadRequestId) {

        return reloadRequestId === this.reloadRequestId;
    }

    applyReload(reloadRequestId, result, legacyFolderColors = {}) {

        if (
            !this.isCurrentReload(reloadRequestId) ||
            !this.#applyResult(result, legacyFolderColors)
        ) {
            return false;
        }

        this.reloading = false;

        return true;
    }

    cancelReload(reloadRequestId) {

        if (!this.isCurrentReload(reloadRequestId)) {
            return false;
        }

        this.reloading = false;

        return true;
    }

    #applyResult(result, legacyFolderColors) {

        if (
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
        this.saving = false;
        this.saveOperation = null;
        this.saveStatus = "idle";
        this.saveErrorCode = null;
        this.fileExists = result.fileExists;
        this.snapshot = snapshot;
        this.fingerprint = result.fingerprint ?? null;
        this.lastModified = result.lastModified ?? null;
        this.size = result.size ?? null;
        this.errorCode = result.errorCode ?? null;

        return true;
    }

    markDirty(explicitFolderColors, currentFolderPaths) {

        const folderColors = cloneFolderColors(this.snapshot.folderColors);
        const currentPaths = new Set(
            [...(currentFolderPaths || [])]
                .filter(path => typeof path === "string")
        );

        currentPaths.forEach(path => delete folderColors[path]);
        Object.entries(explicitFolderColors || {}).forEach(([path, color]) => {
            if (currentPaths.has(path)) {
                folderColors[path] = color;
            }
        });

        this.snapshot = {
            schemaVersion: this.schemaVersion,
            folderColors
        };
        this.dirty = true;

        if (this.saveStatus !== "conflict") {
            this.saveStatus = "unsaved";
            this.saveErrorCode = null;
        }

        return true;
    }

    beginSave() {

        return this.#beginSave("save", this.dirty);
    }

    beginMigration() {

        return this.#beginSave("migration", this.canMigrate());
    }

    beginOverwrite() {

        return this.#beginSave(
            "overwrite",
            (
                this.saveStatus === "conflict" &&
                (this.dirty || this.source === "legacy-local")
            ) || (
                this.status === "invalid" && this.dirty
            )
        );
    }

    canMigrate() {

        return !this.dirty &&
            !this.saving &&
            !this.reloading &&
            this.saveStatus !== "conflict" &&
            this.fileExists === false &&
            this.status === "missing" &&
            this.source === "legacy-local" &&
            Object.keys(this.snapshot.folderColors).length > 0;
    }

    #beginSave(operation, allowed) {

        if (!allowed || this.saving || this.reloading) {
            return null;
        }

        this.saveRequestId += 1;
        this.saving = true;
        this.saveOperation = operation;
        this.saveStatus = "saving";
        this.saveErrorCode = null;

        return this.saveRequestId;
    }

    isCurrentSave(saveRequestId) {

        return saveRequestId === this.saveRequestId;
    }

    applySaveSuccess(saveRequestId, loadResult) {

        if (
            !this.isCurrentSave(saveRequestId) ||
            loadResult?.status !== "loaded" ||
            !loadResult.snapshot
        ) {
            return false;
        }

        this.source = "shared-json";
        this.status = "loaded";
        this.dirty = false;
        this.saving = false;
        this.saveOperation = null;
        this.saveStatus = "saved";
        this.saveErrorCode = null;
        this.fileExists = true;
        this.snapshot = cloneSnapshot(loadResult.snapshot, this.schemaVersion);
        this.fingerprint = loadResult.fingerprint ?? null;
        this.lastModified = loadResult.lastModified ?? null;
        this.size = loadResult.size ?? null;
        this.errorCode = loadResult.errorCode ?? null;

        return true;
    }

    applySaveFailure(saveRequestId, errorCode) {

        if (!this.isCurrentSave(saveRequestId)) {
            return false;
        }

        const preserveConflict = this.saveOperation === "overwrite";

        this.saving = false;
        this.saveOperation = null;
        this.saveStatus = preserveConflict
            ? "conflict"
            : errorCode === "write-permission-denied"
                ? "permission-denied"
                : "failed";
        this.saveErrorCode = errorCode || "write-failed";

        return true;
    }

    markConflict(saveRequestId, errorCode = "conflict") {

        if (!this.applySaveFailure(saveRequestId, errorCode)) {
            return false;
        }

        this.saveStatus = "conflict";

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
            saving: this.saving,
            reloading: this.reloading,
            saveOperation: this.saveOperation,
            saveStatus: this.saveStatus,
            saveErrorCode: this.saveErrorCode,
            fileExists: this.fileExists,
            fingerprint: this.fingerprint,
            lastModified: this.lastModified,
            size: this.size,
            errorCode: this.errorCode,
            migrationAvailable: this.canMigrate()
        };
    }
}
