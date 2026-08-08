import TrackSummaryBuilder from "./TrackSummaryBuilder.js";

/**
 * Loads display geometry from IndexedDB before falling back to GPX parsing.
 */
export default class GPXGeometryLoader {

    constructor({
        parser,
        repository,
        fileLoader = null,
        summaryBuilder = new TrackSummaryBuilder()
    }) {

        this.parser = parser;
        this.repository = repository;
        this.fileLoader = fileLoader;
        this.summaryBuilder = summaryBuilder;
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

        const file = this.fileLoader
            ? await this.fileLoader.getFile(fileHandle)
            : await fileHandle.getFile();

        if (this.namespace) {
            const cached = await this.repository.getWithSummary(
                this.namespace,
                path,
                file
            );

            if (cached) {
                this.stats.hits += 1;
                return cached;
            }
        }

        this.stats.misses += 1;
        const text = this.fileLoader?.decode
            ? await this.fileLoader.decode(file)
            : await file.text();
        const result = this.parser.parse(
            text,
            fileHandle.name
        );
        const summary = this.summaryBuilder.build(path, file, result);

        if (this.namespace) {
            const stored = await this.repository.set(
                this.namespace,
                path,
                file,
                result,
                summary
            );

            this.stats[stored ? "writes" : "writeFailures"] += 1;
        }

        return { result, summary };
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
