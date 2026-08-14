import GPXBackupIndexService from "./GPXBackupIndexService.js";
import GPXEditingSaveVerifier from "./GPXEditingSaveVerifier.js";
import GPXEditingSerializer from "./GPXEditingSerializer.js";
import {
    TRAILBOOK_BACKUP_FOLDER_NAME
} from "./LibraryReservedFolderPolicy.js";

const READ_WRITE_PERMISSION = Object.freeze({ mode: "readwrite" });
const MAX_COLLISION_SUFFIX = 9999;

/**
 * Preserves the first source bytes, then explicitly saves an edited GPX.
 */
export default class GPXEditingSaveService {

    constructor({
        serializer = new GPXEditingSerializer(),
        verifier = new GPXEditingSaveVerifier(),
        backupIndex = new GPXBackupIndexService(),
        TextEncoderClass = globalThis.TextEncoder
    } = {}) {

        this.serializer = serializer;
        this.verifier = verifier;
        this.backupIndex = backupIndex;
        this.TextEncoderClass = TextEncoderClass;
    }

    async inspectBackup(directoryHandle, sourceFileName) {

        try {
            const backupDirectory = await directoryHandle.getDirectoryHandle(
                TRAILBOOK_BACKUP_FOLDER_NAME
            );
            const index = await this.backupIndex.read(backupDirectory);
            const associatedName = index.entries[sourceFileName];

            if (associatedName) {
                let backupHandle;

                try {
                    backupHandle = await backupDirectory.getFileHandle(associatedName);
                } catch (error) {
                    throw this.#wrap(
                        "BACKUP_CHECK_FAILED",
                        "The indexed original Backup is unavailable",
                        error
                    );
                }

                await this.verifier.verifyBackup(backupHandle);
                return Object.freeze({
                    exists: true,
                    backupDirectory,
                    backupHandle,
                    backupFileName: associatedName,
                    indexEntries: index.entries
                });
            }

            const backupHandle = await backupDirectory.getFileHandle(sourceFileName);

            await this.verifier.verifyBackup(backupHandle);
            return Object.freeze({
                exists: true,
                backupDirectory,
                backupHandle,
                backupFileName: sourceFileName,
                indexEntries: index.entries
            });
        } catch (error) {
            if (error?.name === "NotFoundError") {
                return Object.freeze({ exists: false });
            }
            if (error?.code === "BACKUP_VERIFICATION_FAILED") throw error;
            throw this.#wrap(
                "BACKUP_CHECK_FAILED",
                "The source Backup state could not be checked",
                error
            );
        }
    }

    async resolveTargetFileName(directoryHandle, sourceFileName, desiredFileName) {

        if (!desiredFileName || desiredFileName === sourceFileName) {
            return sourceFileName;
        }

        const match = /^(.*)\.gpx$/i.exec(desiredFileName);

        if (!match) {
            throw this.#error("INVALID_TARGET_FILENAME", "The target filename is invalid");
        }

        for (let suffix = 1; suffix <= MAX_COLLISION_SUFFIX; suffix += 1) {
            const candidate = suffix === 1
                ? desiredFileName
                : `${match[1]}-${String(suffix).padStart(2, "0")}.gpx`;

            if (candidate === sourceFileName ||
                !(await this.#fileExists(directoryHandle, candidate))) {
                return candidate;
            }
        }

        throw this.#error(
            "FILENAME_COLLISION",
            "An available date filename could not be found"
        );
    }

    async save({
        source,
        retainedPointMasks,
        timeOffsetMs = 0,
        translation = null,
        desiredFileName = source?.sourceFileName,
        directoryHandle,
        relativePath
    }) {

        if (!this.TextEncoderClass) {
            throw this.#error("SOURCE_WRITE_FAILED", "UTF-8 encoding is unavailable");
        }

        await this.#requestPermission(directoryHandle);
        const sourceBytes = await this.#assertSourceUnchanged(source);
        const backup = await this.#ensureBackup(
            directoryHandle,
            source.sourceFileName,
            sourceBytes
        );
        const targetFileName = await this.resolveTargetFileName(
            directoryHandle,
            source.sourceFileName,
            desiredFileName
        );
        const renamed = targetFileName !== source.sourceFileName;
        const editedXml = this.serializer.serialize(source, retainedPointMasks, {
            timeOffsetMs,
            translation,
            trackNameFileName: renamed ? targetFileName : null
        });
        const editedBytes = new this.TextEncoderClass().encode(editedXml);

        if (!renamed) {
            return this.#saveInPlace({
                source,
                retainedPointMasks,
                relativePath,
                editedBytes,
                backup
            });
        }

        return this.#saveRenamed({
            source,
            retainedPointMasks,
            relativePath,
            directoryHandle,
            targetFileName,
            editedBytes,
            backup
        });
    }

    async #saveInPlace({
        source, retainedPointMasks, relativePath, editedBytes, backup
    }) {

        try {
            await this.#writeAndClose(
                source.fileHandle,
                editedBytes,
                "SOURCE_WRITE_FAILED",
                "The edited GPX could not be written"
            );
        } catch (error) {
            error.backupAvailable = true;
            throw error;
        }

        const verification = await this.#verifyEdited(
            source.fileHandle,
            source,
            retainedPointMasks,
            relativePath
        );

        return Object.freeze({
            fileName: source.sourceFileName,
            fileHandle: source.fileHandle,
            file: verification.file,
            source: verification.source,
            relativePath,
            previousRelativePath: relativePath,
            renamed: false,
            cleanupWarning: false,
            backupCreated: backup.created,
            backupFolderName: TRAILBOOK_BACKUP_FOLDER_NAME
        });
    }

    async #saveRenamed({
        source,
        retainedPointMasks,
        relativePath,
        directoryHandle,
        targetFileName,
        editedBytes,
        backup
    }) {

        let targetHandle;

        try {
            targetHandle = await directoryHandle.getFileHandle(
                targetFileName,
                { create: true }
            );
            await this.#writeAndClose(
                targetHandle,
                editedBytes,
                "SOURCE_WRITE_FAILED",
                "The renamed edited GPX could not be written"
            );
        } catch (error) {
            if (error?.code === "SOURCE_WRITE_FAILED") throw error;
            throw this.#wrap("SOURCE_WRITE_FAILED", "The renamed GPX could not be created", error);
        }

        const targetPath = this.#replaceFileName(relativePath, targetFileName);
        const verification = await this.#verifyEdited(
            targetHandle,
            source,
            retainedPointMasks,
            targetPath
        );
        const index = await this.backupIndex.read(backup.backupDirectory);
        const entries = { ...index.entries };

        delete entries[source.sourceFileName];
        entries[targetFileName] = backup.backupFileName;
        await this.backupIndex.write(backup.backupDirectory, entries);

        let cleanupWarning = false;

        try {
            await directoryHandle.removeEntry(source.sourceFileName);
        } catch {
            cleanupWarning = true;
        }

        return Object.freeze({
            fileName: targetFileName,
            fileHandle: targetHandle,
            file: verification.file,
            source: verification.source,
            relativePath: targetPath,
            previousRelativePath: relativePath,
            renamed: true,
            cleanupWarning,
            backupCreated: backup.created,
            backupFolderName: TRAILBOOK_BACKUP_FOLDER_NAME
        });
    }

    async #ensureBackup(directoryHandle, sourceFileName, sourceBytes) {

        const inspected = await this.inspectBackup(directoryHandle, sourceFileName);

        if (inspected.exists) {
            return Object.freeze({
                created: false,
                fileHandle: inspected.backupHandle,
                backupDirectory: inspected.backupDirectory,
                backupFileName: inspected.backupFileName
            });
        }

        let backupDirectory;
        let backupHandle;

        try {
            backupDirectory = await directoryHandle.getDirectoryHandle(
                TRAILBOOK_BACKUP_FOLDER_NAME,
                { create: true }
            );

            try {
                backupHandle = await backupDirectory.getFileHandle(sourceFileName);
                await this.verifier.verifyBackup(backupHandle);
                return Object.freeze({
                    created: false,
                    fileHandle: backupHandle,
                    backupDirectory,
                    backupFileName: sourceFileName
                });
            } catch (error) {
                if (error?.name !== "NotFoundError") throw error;
            }

            backupHandle = await backupDirectory.getFileHandle(sourceFileName, {
                create: true
            });
        } catch (error) {
            throw this.#wrap(
                "BACKUP_CREATE_FAILED",
                "The original GPX Backup could not be created",
                error
            );
        }

        try {
            await this.#writeAndClose(
                backupHandle,
                sourceBytes,
                "BACKUP_WRITE_FAILED",
                "The original GPX Backup could not be written"
            );
            await this.verifier.verifyBackup(backupHandle, sourceBytes);
        } catch (error) {
            if (error?.code === "BACKUP_WRITE_FAILED" ||
                error?.code === "BACKUP_VERIFICATION_FAILED") throw error;
            throw this.#wrap(
                "BACKUP_VERIFICATION_FAILED",
                "The original GPX Backup could not be verified",
                error
            );
        }

        return Object.freeze({
            created: true,
            fileHandle: backupHandle,
            backupDirectory,
            backupFileName: sourceFileName
        });
    }

    async #verifyEdited(fileHandle, source, retainedPointMasks, relativePath) {

        try {
            return await this.verifier.verify(
                fileHandle,
                source,
                retainedPointMasks,
                relativePath
            );
        } catch (error) {
            const failure = this.#wrap(
                "EDITED_VERIFICATION_FAILED",
                "Edited GPX verification failed; restore is possible from Backup",
                error
            );

            failure.backupAvailable = true;
            throw failure;
        }
    }

    async #fileExists(directoryHandle, fileName) {

        try {
            await directoryHandle.getFileHandle(fileName);
            return true;
        } catch (error) {
            if (error?.name === "NotFoundError") return false;
            throw this.#wrap("FILENAME_COLLISION", "The target filename could not be checked", error);
        }
    }

    #replaceFileName(relativePath, fileName) {

        const separator = relativePath.lastIndexOf("/");

        return separator < 0
            ? fileName
            : `${relativePath.slice(0, separator + 1)}${fileName}`;
    }

    async #requestPermission(directoryHandle) {

        if (!directoryHandle) {
            throw this.#error("SOURCE_FOLDER_UNAVAILABLE", "The source Folder is unavailable");
        }

        let permission = "prompt";

        try {
            permission = typeof directoryHandle.queryPermission === "function"
                ? await directoryHandle.queryPermission(READ_WRITE_PERMISSION)
                : "prompt";

            if (permission !== "granted") {
                permission = typeof directoryHandle.requestPermission === "function"
                    ? await directoryHandle.requestPermission(READ_WRITE_PERMISSION)
                    : "denied";
            }
        } catch (error) {
            if (error?.name === "AbortError") {
                throw this.#wrap("SAVE_CANCELLED", "Save was cancelled", error);
            }
            throw this.#wrap("PERMISSION_DENIED", "Write permission was not granted", error);
        }

        if (permission !== "granted") {
            throw this.#error("PERMISSION_DENIED", "Write permission was not granted");
        }
    }

    async #assertSourceUnchanged(source) {

        try {
            const file = await source.fileHandle.getFile();
            const bytes = new Uint8Array(await file.arrayBuffer());
            const expected = source.getSourceBytes();

            if (
                file.size !== source.fingerprint.size ||
                file.lastModified !== source.fingerprint.lastModified ||
                !this.#bytesEqual(bytes, expected)
            ) {
                throw this.#error("SOURCE_CHANGED", "The source GPX changed after editing started");
            }

            return bytes;
        } catch (error) {
            if (error?.code === "SOURCE_CHANGED") throw error;
            throw this.#wrap("SOURCE_READ_FAILED", "The source GPX could not be checked", error);
        }
    }

    async #writeAndClose(fileHandle, bytes, code, message) {

        let writable;

        try {
            writable = await fileHandle.createWritable({ keepExistingData: false });
            await writable.write(bytes);
            await writable.close();
        } catch (error) {
            try { await writable?.abort?.(); } catch { /* Preserve original error. */ }
            throw this.#wrap(code, message, error);
        }
    }

    #bytesEqual(first, second) {

        return first.length === second.length &&
            first.every((value, index) => value === second[index]);
    }

    #wrap(code, message, cause) {

        const error = this.#error(code, message);
        error.cause = cause;
        return error;
    }

    #error(code, message) {

        const error = new Error(message);
        error.code = code;
        return error;
    }
}
