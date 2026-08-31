import TrackSummaryBuilder from "./TrackSummaryBuilder.js";
import drivePerformance from "./DrivePerformanceMonitor.js";

/**
 * Loads display geometry from IndexedDB before falling back to GPX parsing.
 */
export default class GPXGeometryLoader {

    constructor({
        parser,
        repository,
        fileLoader = null,
        summaryBuilder = new TrackSummaryBuilder(),
        driveConcurrency = 4,
        diagnosticObserver = null
    }) {

        this.parser = parser;
        this.repository = repository;
        this.fileLoader = fileLoader;
        this.summaryBuilder = summaryBuilder;
        this.driveConcurrency = driveConcurrency;
        this.diagnosticObserver = diagnosticObserver;
        this.activeDriveOperations = 0;
        this.driveOperationWaiters = [];
        this.namespace = null;
        this.inflight = new Map();
        this.stats = this.#createStats();
    }

    setLibraryNamespace(namespace) {

        this.namespace = typeof namespace === "string" && namespace.length > 0
            ? namespace
            : null;
        this.inflight.clear();
        this.stats = this.#createStats();
    }

    setDiagnosticObserver(observer) {

        this.diagnosticObserver = typeof observer === "function"
            ? observer
            : null;
    }

    load(path, fileHandle) {

        const request = this.#request(path, fileHandle);

        request.result ||= request.bundle.then(value => value.result);
        return request.result;
    }

    loadSummary(path, fileHandle) {

        const request = this.#request(path, fileHandle);

        request.summary ||= request.bundle.then(value => value.summary);
        return request.summary;
    }

    #request(path, fileHandle) {

        const requestKey = JSON.stringify([this.namespace, path]);
        const existing = this.inflight.get(requestKey);

        if (existing) {
            this.stats.deduplicated += 1;
            return existing;
        }

        const bundle = this.#load(path, fileHandle);
        const request = {
            bundle,
            result: null,
            summary: null
        };

        this.inflight.set(requestKey, request);
        void bundle.then(
            () => this.inflight.delete(requestKey),
            () => this.inflight.delete(requestKey)
        );
        return request;
    }

    getStats() {

        return { ...this.stats };
    }

    async #load(path, fileHandle) {

        this.#diagnose(path, fileHandle, "GPXGeometryLoader", "started");

        drivePerformance.recordComponentCall("GPXGeometryLoader");
        const driveFileIdentity = this.#createDriveFileIdentity(fileHandle);

        if (this.namespace && driveFileIdentity) {
            const cached = await this.#lookupCache(path, driveFileIdentity);

            if (cached) {
                this.stats.hits += 1;
                return cached;
            }
        }

        const releaseDriveSlot = driveFileIdentity
            ? await this.#acquireDriveOperationSlot()
            : null;
        const endDriveOperation = driveFileIdentity
            ? drivePerformance.beginDriveGpxOperation()
            : null;

        try {
            let file;

            this.#diagnose(path, fileHandle, "getFile", "started");
            try {
                file = this.fileLoader
                    ? await this.fileLoader.getFile(fileHandle)
                    : await fileHandle.getFile();
                this.#diagnose(path, fileHandle, "getFile", "success");
            } catch (error) {
                this.#diagnose(path, fileHandle, "getFile", "failure", error);
                throw error;
            }

            if (this.namespace && !driveFileIdentity) {
                const cached = await this.#lookupCache(path, file);

                if (cached) {
                    this.stats.hits += 1;
                    return cached;
                }
            }

            this.stats.misses += 1;
            drivePerformance.recordComponentCall("GeometryCache.generation");
            const endGeneration = drivePerformance.begin("cacheGenerationMs");
            let result;
            let summary;

            try {
                const text = this.fileLoader?.decode
                    ? await this.fileLoader.decode(file)
                    : await file.text();
                const endParse = drivePerformance.begin("parseMs", "parseCount");

                try {
                    drivePerformance.recordComponentCall("GPXParser.parse");
                    this.#diagnose(path, fileHandle, "parser", "started");
                    try {
                        result = this.parser.parse(text, fileHandle.name);
                        this.#diagnose(path, fileHandle, "parser", "success");
                    } catch (error) {
                        this.#diagnose(
                            path, fileHandle, "parser", "failure", error
                        );
                        throw error;
                    }
                } finally {
                    endParse();
                }
                summary = this.summaryBuilder.build(path, file, result);
            } finally {
                endGeneration();
            }

            if (this.namespace) {
                drivePerformance.recordComponentCall("GeometryCache.write");
                const endWrite = drivePerformance.begin(
                    "cacheWriteMs",
                    "cacheWriteCount"
                );
                let stored;

                try {
                    stored = await this.repository.set(
                        this.namespace,
                        path,
                        file,
                        result,
                        summary
                    );
                } finally {
                    endWrite();
                }

                this.stats[stored ? "writes" : "writeFailures"] += 1;
            }

            return { result, summary };
        } finally {
            endDriveOperation?.();
            releaseDriveSlot?.();
        }
    }

    async #lookupCache(path, fileIdentity) {

        drivePerformance.recordComponentCall("GeometryCache.lookup");
        const endLookup = drivePerformance.begin("cacheLookupMs");
        let cached = null;

        try {
            cached = await this.repository.getWithSummary(
                this.namespace,
                path,
                fileIdentity
            );
        } catch {
            cached = null;
        } finally {
            endLookup();
        }

        drivePerformance.increment(cached ? "cacheHits" : "cacheMisses");
        return cached;
    }

    #diagnose(path, fileHandle, stage, status, error = null) {

        try {
            this.diagnosticObserver?.({
                path,
                stage,
                status,
                fileHandleKind: fileHandle?.kind || null,
                fileHandleProvisional: Boolean(fileHandle?.provisional),
                fileHandleActual: Boolean(
                    fileHandle && fileHandle.provisional !== true
                ),
                errorName: error?.name || null,
                errorMessage: error?.message || null
            });
        } catch {
            // Diagnostics must never affect GPX loading.
        }
    }

    #createDriveFileIdentity(fileHandle) {

        const entry = fileHandle?.driveEntry;

        if (!entry) return null;

        const size = Number(entry.size);

        return {
            name: fileHandle.name,
            size: Number.isFinite(size) && size >= 0 ? size : 0,
            lastModified: Date.parse(entry.modifiedTime) || 0
        };
    }

    #acquireDriveOperationSlot() {

        if (this.activeDriveOperations < this.driveConcurrency) {
            this.activeDriveOperations += 1;
            return Promise.resolve(() => this.#releaseDriveOperationSlot());
        }

        return new Promise(resolve => {
            this.driveOperationWaiters.push(resolve);
        });
    }

    #releaseDriveOperationSlot() {

        const next = this.driveOperationWaiters.shift();

        if (next) {
            next(() => this.#releaseDriveOperationSlot());
            return;
        }

        this.activeDriveOperations = Math.max(
            0,
            this.activeDriveOperations - 1
        );
    }

    #createStats() {

        return {
            hits: 0,
            misses: 0,
            writes: 0,
            writeFailures: 0,
            deduplicated: 0
        };
    }
}
