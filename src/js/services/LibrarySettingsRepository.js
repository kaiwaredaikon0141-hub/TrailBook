import { normalizeSharedSettings } from "../utils/SharedSettingsSchema.js";

function createResult(overrides = {}) {

    return {
        status: "read-failed",
        fileExists: null,
        snapshot: null,
        fingerprint: null,
        lastModified: null,
        size: null,
        errorCode: "read-failed",
        fallbackAllowed: true,
        ...overrides
    };
}

function bytesToHex(bytes) {

    return [...new Uint8Array(bytes)]
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Reads and validates Library-root shared settings without writing files.
 */
export default class LibrarySettingsRepository {

    constructor({
        fileName,
        schemaVersion,
        maxFileSizeBytes,
        cryptoProvider = globalThis.crypto ?? null,
        TextDecoderClass = globalThis.TextDecoder
    } = {}) {

        this.fileName = fileName;
        this.schemaVersion = schemaVersion;
        this.maxFileSizeBytes = maxFileSizeBytes;
        this.cryptoProvider = cryptoProvider;
        this.TextDecoderClass = TextDecoderClass;
    }

    async load(rootHandle) {

        let fileHandle;

        try {
            fileHandle = await rootHandle.getFileHandle(
                this.fileName,
                { create: false }
            );
        } catch (error) {
            if (error?.name === "NotFoundError") {
                return createResult({
                    status: "missing",
                    fileExists: false,
                    errorCode: null
                });
            }

            if (error?.name === "TypeMismatchError") {
                return createResult({
                    status: "invalid",
                    fileExists: true,
                    errorCode: "invalid-structure",
                    fallbackAllowed: false
                });
            }

            return createResult({
                errorCode: this.#getReadErrorCode(error)
            });
        }

        if (
            typeof fileHandle?.name === "string" &&
            fileHandle.name !== this.fileName
        ) {
            return createResult({
                status: "missing",
                fileExists: false,
                errorCode: null
            });
        }

        if (!fileHandle || fileHandle.kind !== "file") {
            return createResult({
                status: "invalid",
                fileExists: true,
                errorCode: "invalid-structure",
                fallbackAllowed: false
            });
        }

        let file;

        try {
            file = await fileHandle.getFile();
        } catch (error) {
            return createResult({
                fileExists: true,
                errorCode: this.#getReadErrorCode(error)
            });
        }

        const metadata = {
            fileExists: true,
            lastModified: Number.isFinite(file.lastModified)
                ? file.lastModified
                : null,
            size: Number.isFinite(file.size) ? file.size : null
        };

        if (
            metadata.size === null ||
            metadata.size > this.maxFileSizeBytes
        ) {
            return createResult({
                ...metadata,
                status: "invalid",
                errorCode: "file-too-large",
                fallbackAllowed: false
            });
        }

        let contentBytes;

        try {
            contentBytes = await file.arrayBuffer();
        } catch (error) {
            return createResult({
                ...metadata,
                errorCode: this.#getReadErrorCode(error)
            });
        }

        let payload;

        try {
            const decoder = new this.TextDecoderClass("utf-8", {
                fatal: true
            });
            const text = decoder.decode(contentBytes);

            if (text.trim() === "") {
                throw new SyntaxError("Empty shared settings file.");
            }

            payload = JSON.parse(text);
        } catch (error) {
            return createResult({
                ...metadata,
                status: "invalid",
                errorCode: error instanceof SyntaxError
                    ? "malformed-json"
                    : "invalid-structure",
                fallbackAllowed: false
            });
        }

        const normalized = normalizeSharedSettings(
            payload,
            this.schemaVersion
        );

        if (!normalized.snapshot) {
            return createResult({
                ...metadata,
                status: "invalid",
                errorCode: normalized.errorCode,
                fallbackAllowed: false
            });
        }

        let fingerprint = null;
        let errorCode = null;

        try {
            if (typeof this.cryptoProvider?.subtle?.digest !== "function") {
                throw new Error("SHA-256 unavailable.");
            }

            fingerprint = bytesToHex(
                await this.cryptoProvider.subtle.digest(
                    "SHA-256",
                    contentBytes
                )
            );
        } catch {
            errorCode = "fingerprint-unavailable";
        }

        return createResult({
            ...metadata,
            status: "loaded",
            snapshot: normalized.snapshot,
            fingerprint,
            errorCode,
            fallbackAllowed: false
        });
    }

    #getReadErrorCode(error) {

        return error?.name === "NotAllowedError" ||
            error?.name === "SecurityError"
            ? "permission-denied"
            : "read-failed";
    }
}
