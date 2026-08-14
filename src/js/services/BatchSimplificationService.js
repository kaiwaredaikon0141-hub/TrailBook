import GPXEditingSaveService from "./GPXEditingSaveService.js";
import GPXEditingSourceLoader from "./GPXEditingSourceLoader.js";
import TrackSimplificationService from "./TrackSimplificationService.js";

const READ_WRITE_PERMISSION = Object.freeze({ mode: "readwrite" });

/**
 * Analyses and saves GPX simplification sequentially at file boundaries.
 */
export default class BatchSimplificationService {

    constructor({
        sourceLoader = new GPXEditingSourceLoader(),
        simplification = new TrackSimplificationService(),
        saveService = new GPXEditingSaveService(),
        yieldControl = () => new Promise(resolve => setTimeout(resolve, 0))
    } = {}) {

        this.sourceLoader = sourceLoader;
        this.simplification = simplification;
        this.saveService = saveService;
        this.yieldControl = yieldControl;
    }

    async analyze(entries, toleranceMeters, {
        onProgress = null,
        shouldCancel = () => false
    } = {}) {

        this.#validateEntries(entries);
        const files = [];
        const errors = [];
        let sourcePointCount = 0;
        let retainedPointCount = 0;
        let changedCount = 0;
        let unchangedCount = 0;

        for (let index = 0; index < entries.length; index += 1) {
            if (shouldCancel()) break;

            const entry = entries[index];

            try {
                const source = await this.sourceLoader.load(
                    entry.fileHandle,
                    entry.relativePath
                );
                this.#assertSerializable(source);
                const preview = await this.simplification.createPreview(
                    source,
                    toleranceMeters
                );
                const changed = preview.metrics.removedPointCount > 0;

                sourcePointCount += preview.metrics.sourcePointCount;
                retainedPointCount += preview.metrics.retainedPointCount;
                changedCount += changed ? 1 : 0;
                unchangedCount += changed ? 0 : 1;
                files.push(Object.freeze({
                    relativePath: entry.relativePath,
                    fileHandle: entry.fileHandle,
                    directoryHandle: entry.directoryHandle,
                    fingerprint: source.fingerprint,
                    sourcePointCount: preview.metrics.sourcePointCount,
                    retainedPointCount: preview.metrics.retainedPointCount,
                    changed
                }));
            } catch (error) {
                errors.push(this.#failure(entry.relativePath, error));
            }

            onProgress?.({ completed: index + 1, total: entries.length });
            await this.yieldControl();
        }

        return Object.freeze({
            toleranceMeters,
            targetCount: entries.length,
            analyzedCount: files.length,
            changedCount,
            unchangedCount,
            errorCount: errors.length,
            sourcePointCount,
            retainedPointCount,
            removedPointCount: sourcePointCount - retainedPointCount,
            reductionRatio: sourcePointCount === 0
                ? 0
                : (sourcePointCount - retainedPointCount) / sourcePointCount,
            cancelled: files.length + errors.length < entries.length,
            files: Object.freeze(files),
            errors: Object.freeze(errors)
        });
    }

    async execute(analysis, {
        rootDirectoryHandle,
        refreshSavedFile = async () => true,
        onProgress = null,
        shouldCancel = () => false
    } = {}) {

        if (!analysis?.files || !Number.isFinite(analysis.toleranceMeters)) {
            throw new TypeError("A completed batch analysis is required");
        }

        await this.#requestPermission(rootDirectoryHandle);

        const changedFiles = analysis.files.filter(file => file.changed);
        const errors = [...(analysis.errors || [])];
        let successCount = 0;
        let unchangedCount = analysis.unchangedCount;
        let skippedCount = 0;
        let sourcePointCount = analysis.files
            .filter(file => !file.changed)
            .reduce((total, file) => total + file.sourcePointCount, 0);
        let retainedPointCount = sourcePointCount;

        for (let index = 0; index < changedFiles.length; index += 1) {
            if (shouldCancel()) {
                skippedCount += changedFiles.length - index;
                break;
            }

            const item = changedFiles[index];

            try {
                const source = await this.sourceLoader.load(
                    item.fileHandle,
                    item.relativePath
                );
                this.#assertSerializable(source);

                if (!this.#sameFingerprint(source.fingerprint, item.fingerprint)) {
                    const error = new Error("The source changed after analysis");

                    error.code = "STALE_SOURCE";
                    throw error;
                }

                const preview = await this.simplification.createPreview(
                    source,
                    analysis.toleranceMeters
                );

                if (preview.metrics.removedPointCount === 0) {
                    unchangedCount += 1;
                    sourcePointCount += preview.metrics.sourcePointCount;
                    retainedPointCount += preview.metrics.retainedPointCount;
                } else {
                    const saved = await this.saveService.save({
                        source,
                        retainedPointMasks: preview.retainedPointMasks,
                        desiredFileName: source.sourceFileName,
                        directoryHandle: item.directoryHandle,
                        relativePath: item.relativePath
                    });

                    await refreshSavedFile({
                        sourcePath: item.relativePath,
                        targetPath: item.relativePath,
                        fileHandle: saved.fileHandle
                    });
                    successCount += 1;
                    sourcePointCount += preview.metrics.sourcePointCount;
                    retainedPointCount += preview.metrics.retainedPointCount;
                }
            } catch (error) {
                errors.push(this.#failure(item.relativePath, error));
            }

            onProgress?.({
                completed: index + 1,
                total: changedFiles.length,
                relativePath: item.relativePath
            });
            await this.yieldControl();
        }

        const removedPointCount = sourcePointCount - retainedPointCount;

        return Object.freeze({
            successCount,
            unchangedCount,
            skippedCount,
            errorCount: errors.length,
            sourcePointCount,
            retainedPointCount,
            removedPointCount,
            reductionRatio: sourcePointCount === 0
                ? 0
                : removedPointCount / sourcePointCount,
            cancelled: skippedCount > 0,
            errors: Object.freeze(errors)
        });
    }

    #validateEntries(entries) {

        if (!Array.isArray(entries) || entries.some(entry => (
            !entry?.relativePath || !entry.fileHandle || !entry.directoryHandle
        ))) {
            throw new TypeError("Batch entries must include path and file handles");
        }
    }

    async #requestPermission(directoryHandle) {

        if (!directoryHandle) {
            throw this.#error("LIBRARY_UNAVAILABLE", "The Library is unavailable");
        }

        let permission;

        try {
            permission = typeof directoryHandle.queryPermission === "function"
                ? await directoryHandle.queryPermission(READ_WRITE_PERMISSION)
                : "prompt";
            if (permission !== "granted") {
                permission = typeof directoryHandle.requestPermission === "function"
                    ? await directoryHandle.requestPermission(READ_WRITE_PERMISSION)
                    : "denied";
            }
        } catch (cause) {
            const error = this.#error(
                "PERMISSION_DENIED",
                "Library write permission was not granted"
            );

            error.cause = cause;
            throw error;
        }

        if (permission !== "granted") {
            throw this.#error(
                "PERMISSION_DENIED",
                "Library write permission was not granted"
            );
        }
    }

    #sameFingerprint(first, second) {

        return first?.size === second?.size &&
            first?.lastModified === second?.lastModified;
    }

    #assertSerializable(source) {

        if (source?.canSerialize === false) {
            throw this.#error(
                "UNSAFE_SOURCE",
                "The GPX cannot be safely serialized"
            );
        }
    }

    #failure(relativePath, error) {

        return Object.freeze({
            relativePath,
            code: error?.code || "ERROR",
            reason: error?.message || "Unknown error"
        });
    }

    #error(code, message) {

        const error = new Error(message);

        error.code = code;
        return error;
    }
}
