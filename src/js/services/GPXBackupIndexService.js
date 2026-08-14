export const BACKUP_INDEX_FILE_NAME = ".trailbook-backup-index.json";
export const BACKUP_INDEX_SCHEMA_VERSION = 1;

/**
 * Reads and verifies the reserved original-Backup association index.
 */
export default class GPXBackupIndexService {

    constructor({ TextEncoderClass = globalThis.TextEncoder } = {}) {

        this.TextEncoderClass = TextEncoderClass;
    }

    async read(directoryHandle) {

        try {
            const handle = await directoryHandle.getFileHandle(
                BACKUP_INDEX_FILE_NAME
            );
            const file = await handle.getFile();
            const text = await file.text();
            const parsed = JSON.parse(text);

            if (
                parsed?.schemaVersion !== BACKUP_INDEX_SCHEMA_VERSION ||
                !parsed.entries || Array.isArray(parsed.entries) ||
                typeof parsed.entries !== "object" ||
                Object.entries(parsed.entries).some(([current, original]) =>
                    !this.#isFileName(current) || !this.#isFileName(original)
                )
            ) {
                throw new Error("Invalid Backup index schema");
            }

            return Object.freeze({
                exists: true,
                handle,
                entries: Object.freeze({ ...parsed.entries })
            });
        } catch (error) {
            if (error?.name === "NotFoundError") {
                return Object.freeze({ exists: false, entries: Object.freeze({}) });
            }
            throw this.#wrap("BACKUP_INDEX_READ_FAILED", error);
        }
    }

    async write(directoryHandle, entries) {

        if (!this.TextEncoderClass) {
            throw this.#error("BACKUP_INDEX_WRITE_FAILED");
        }

        const normalized = Object.fromEntries(
            Object.entries(entries || {})
                .filter(([current, original]) =>
                    this.#isFileName(current) && this.#isFileName(original)
                )
                .sort(([left], [right]) => left.localeCompare(right))
        );
        const text = `${JSON.stringify({
            schemaVersion: BACKUP_INDEX_SCHEMA_VERSION,
            entries: normalized
        }, null, 2)}\n`;
        let handle;
        let writable;

        try {
            handle = await directoryHandle.getFileHandle(
                BACKUP_INDEX_FILE_NAME,
                { create: true }
            );
            writable = await handle.createWritable({ keepExistingData: false });
            await writable.write(new this.TextEncoderClass().encode(text));
            await writable.close();
        } catch (error) {
            try { await writable?.abort?.(); } catch { /* Preserve original error. */ }
            throw this.#wrap("BACKUP_INDEX_WRITE_FAILED", error);
        }

        try {
            const file = await handle.getFile();
            const readBack = await file.text();
            const verified = JSON.parse(readBack);

            if (readBack !== text || JSON.stringify(verified.entries) !==
                JSON.stringify(normalized)) {
                throw new Error("Backup index read-back mismatch");
            }
        } catch (error) {
            throw this.#wrap("BACKUP_INDEX_VERIFICATION_FAILED", error);
        }

        return Object.freeze({ handle, entries: Object.freeze(normalized) });
    }

    #isFileName(value) {

        return typeof value === "string" && value.length > 0 &&
            value !== "." && value !== ".." &&
            !value.includes("/") && !value.includes("\\");
    }

    #wrap(code, cause) {

        const error = this.#error(code);
        error.cause = cause;
        return error;
    }

    #error(code) {

        const error = new Error(code);
        error.code = code;
        return error;
    }
}
