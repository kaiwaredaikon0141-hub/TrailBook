/**
 * Loads display geometry from IndexedDB before falling back to GPX parsing.
 */
export default class GPXGeometryLoader {

    constructor({ parser, repository, fileLoader = null }) {

        this.parser = parser;
        this.repository = repository;
        this.fileLoader = fileLoader;
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

        const requestKey = JSON.stringify([this.namespace, path]);
        const existing = this.inflight.get(requestKey);

        if (existing) {
            this.stats.deduplicated += 1;
            return existing;
        }

        const request = this.#load(path, fileHandle)
            .finally(() => this.inflight.delete(requestKey));

        this.inflight.set(requestKey, request);
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
            const cached = await this.repository.get(
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
        const result = this.parser.parse(
            await file.text(),
            fileHandle.name
        );

        if (this.namespace) {
            const stored = await this.repository.set(
                this.namespace,
                path,
                file,
                result
            );

            this.stats[stored ? "writes" : "writeFailures"] += 1;
        }

        return result;
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
