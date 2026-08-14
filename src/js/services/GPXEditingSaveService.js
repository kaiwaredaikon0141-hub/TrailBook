import GPXEditingSaveVerifier from "./GPXEditingSaveVerifier.js";
import GPXEditingSerializer from "./GPXEditingSerializer.js";
import {
    TRAILBOOK_BACKUP_FOLDER_NAME
} from "./LibraryReservedFolderPolicy.js";

const READ_WRITE_PERMISSION = Object.freeze({ mode: "readwrite" });

/**
 * Preserves the first source bytes, then explicitly replaces that source GPX.
 */
export default class GPXEditingSaveService {

    constructor({
        serializer = new GPXEditingSerializer(),
        verifier = new GPXEditingSaveVerifier(),
        TextEncoderClass = globalThis.TextEncoder
    } = {}) {

        this.serializer = serializer;
        this.verifier = verifier;
        this.TextEncoderClass = TextEncoderClass;
    }

    async inspectBackup(directoryHandle, sourceFileName) {

        try {
            const backupDirectory = await directoryHandle.getDirectoryHandle(
                TRAILBOOK_BACKUP_FOLDER_NAME
            );
            const backupHandle = await backupDirectory.getFileHandle(sourceFileName);

            await this.verifier.verifyBackup(backupHandle);
            return Object.freeze({ exists: true, backupDirectory, backupHandle });
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

    async save({ source, retainedPointMasks, directoryHandle, relativePath }) {

        if (!this.TextEncoderClass) {
            throw this.#error("SOURCE_WRITE_FAILED", "UTF-8 encoding is unavailable");
        }

        const editedXml = this.serializer.serialize(source, retainedPointMasks);
        const editedBytes = new this.TextEncoderClass().encode(editedXml);

        await this.#requestPermission(directoryHandle);
        const sourceBytes = await this.#assertSourceUnchanged(source);
        const backup = await this.#ensureBackup(
            directoryHandle,
            source.sourceFileName,
            sourceBytes
        );

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

        try {
            const verification = await this.verifier.verify(
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
                backupCreated: backup.created,
                backupFolderName: TRAILBOOK_BACKUP_FOLDER_NAME
            });
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

    async #ensureBackup(directoryHandle, sourceFileName, sourceBytes) {

        const inspected = await this.inspectBackup(directoryHandle, sourceFileName);

        if (inspected.exists) {
            return Object.freeze({ created: false, fileHandle: inspected.backupHandle });
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
                return Object.freeze({ created: false, fileHandle: backupHandle });
            } catch (error) {
                if (error?.name !== "NotFoundError") throw error;
            }

            backupHandle = await backupDirectory.getFileHandle(
                sourceFileName,
                { create: true }
            );
        } catch (error) {
            if (error?.code === "BACKUP_VERIFICATION_FAILED") throw error;
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
                error?.code === "BACKUP_VERIFICATION_FAILED") {
                throw error;
            }
            throw this.#wrap(
                "BACKUP_VERIFICATION_FAILED",
                "The original GPX Backup could not be verified",
                error
            );
        }

        return Object.freeze({ created: true, fileHandle: backupHandle });
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
