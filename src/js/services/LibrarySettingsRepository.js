import {
    normalizeSharedSettings,
    serializeSharedSettings
} from "../utils/SharedSettingsSchema.js";

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

function createSaveResult(overrides = {}) {

    return {
        status: "failed",
        errorCode: "write-failed",
        loadResult: null,
        ...overrides
    };
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
        TextDecoderClass = globalThis.TextDecoder,
        TextEncoderClass = globalThis.TextEncoder
    } = {}) {

        this.fileName = fileName;
        this.schemaVersion = schemaVersion;
        this.maxFileSizeBytes = maxFileSizeBytes;
        this.cryptoProvider = cryptoProvider;
        this.TextDecoderClass = TextDecoderClass;
        this.TextEncoderClass = TextEncoderClass;
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
            fingerprint = await this.#createFingerprint(contentBytes);

            if (!fingerprint) {
                throw new Error("SHA-256 unavailable.");
            }
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

    async save(rootHandle, {
        baseline,
        snapshot,
        shouldContinue = () => true
    } = {}) {

        if (!shouldContinue()) {
            return createSaveResult({
                status: "stale",
                errorCode: "stale-library"
            });
        }

        const permission = await this.#ensureWritePermission(rootHandle);

        if (permission !== "granted") {
            return createSaveResult({
                status: permission === "denied" ? "permission-denied" : "failed",
                errorCode: permission === "denied"
                    ? "write-permission-denied"
                    : "write-permission-failed"
            });
        }

        if (!shouldContinue()) {
            return createSaveResult({
                status: "stale",
                errorCode: "stale-library"
            });
        }

        const current = await this.load(rootHandle);
        const conflictError = this.#getConflictError(baseline, current);

        if (conflictError) {
            return createSaveResult({
                status: conflictError === "conflict" ? "conflict" : "failed",
                errorCode: conflictError
            });
        }

        if (!shouldContinue()) {
            return createSaveResult({
                status: "stale",
                errorCode: "stale-library"
            });
        }

        const serialized = serializeSharedSettings(
            snapshot,
            this.schemaVersion
        );

        if (!serialized.serializedText) {
            return createSaveResult({ errorCode: "invalid-snapshot" });
        }

        const contentBytes = new this.TextEncoderClass().encode(
            serialized.serializedText
        );
        const expectedFingerprint = await this.#createFingerprint(contentBytes);

        if (!expectedFingerprint) {
            return createSaveResult({
                status: "conflict",
                errorCode: "conflict-check-unavailable"
            });
        }

        let fileHandle;

        try {
            fileHandle = await rootHandle.getFileHandle(
                this.fileName,
                { create: true }
            );
        } catch {
            return createSaveResult({ errorCode: "create-file-failed" });
        }

        if (
            !shouldContinue() ||
            !fileHandle ||
            fileHandle.kind !== "file" ||
            (typeof fileHandle.name === "string" &&
                fileHandle.name !== this.fileName)
        ) {
            return createSaveResult({
                status: shouldContinue() ? "failed" : "stale",
                errorCode: shouldContinue()
                    ? "create-file-failed"
                    : "stale-library"
            });
        }

        let writable;

        try {
            writable = await fileHandle.createWritable();
        } catch {
            return createSaveResult({ errorCode: "create-writable-failed" });
        }

        if (!shouldContinue()) {
            await this.#abortWritable(writable);
            return createSaveResult({
                status: "stale",
                errorCode: "stale-library"
            });
        }

        try {
            await writable.write(contentBytes);
        } catch {
            await this.#abortWritable(writable);
            return createSaveResult({ errorCode: "write-failed" });
        }

        if (!shouldContinue()) {
            await this.#abortWritable(writable);
            return createSaveResult({
                status: "stale",
                errorCode: "stale-library"
            });
        }

        try {
            await writable.close();
        } catch {
            await this.#abortWritable(writable);
            return createSaveResult({ errorCode: "close-failed" });
        }

        if (!shouldContinue()) {
            return createSaveResult({
                status: "stale",
                errorCode: "stale-library"
            });
        }

        const verified = await this.load(rootHandle);

        if (
            !shouldContinue() ||
            verified.status !== "loaded" ||
            verified.fingerprint !== expectedFingerprint
        ) {
            return createSaveResult({
                status: shouldContinue() ? "failed" : "stale",
                errorCode: shouldContinue()
                    ? "verification-failed"
                    : "stale-library"
            });
        }

        return createSaveResult({
            status: "saved",
            errorCode: null,
            loadResult: verified
        });
    }

    async #ensureWritePermission(rootHandle) {

        try {
            if (typeof rootHandle?.queryPermission !== "function") {
                return "failed";
            }

            let permission = await rootHandle.queryPermission({
                mode: "readwrite"
            });

            if (permission === "granted") {
                return permission;
            }

            if (typeof rootHandle.requestPermission !== "function") {
                return permission === "denied" ? "denied" : "failed";
            }

            permission = await rootHandle.requestPermission({
                mode: "readwrite"
            });

            return permission === "granted" ? "granted" : "denied";
        } catch {
            return "failed";
        }
    }

    #getConflictError(baseline, current) {

        if (baseline?.fileExists === false) {
            if (current.status === "missing") {
                return null;
            }

            if (current.status === "invalid") {
                return "invalid-current-file";
            }

            return current.status === "loaded"
                ? "conflict"
                : "conflict-check-unavailable";
        }

        if (baseline?.fileExists !== true) {
            return "conflict-check-unavailable";
        }

        if (current.status === "missing") {
            return "conflict";
        }

        if (current.status === "invalid") {
            return "invalid-current-file";
        }

        if (
            current.status !== "loaded" ||
            !baseline.fingerprint ||
            !current.fingerprint
        ) {
            return "conflict-check-unavailable";
        }

        return baseline.fingerprint === current.fingerprint
            ? null
            : "conflict";
    }

    async #createFingerprint(contentBytes) {

        if (typeof this.cryptoProvider?.subtle?.digest !== "function") {
            return null;
        }

        try {
            return bytesToHex(
                await this.cryptoProvider.subtle.digest(
                    "SHA-256",
                    contentBytes
                )
            );
        } catch {
            return null;
        }
    }

    async #abortWritable(writable) {

        if (typeof writable?.abort !== "function") {
            return;
        }

        try {
            await writable.abort();
        } catch {
            // Preserve the original write/close failure category.
        }
    }

    #getReadErrorCode(error) {

        return error?.name === "NotAllowedError" ||
            error?.name === "SecurityError"
            ? "permission-denied"
            : "read-failed";
    }
}
