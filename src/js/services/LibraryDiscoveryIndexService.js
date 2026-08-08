import TrackSummaryBuilder from "./TrackSummaryBuilder.js";

/**
 * Lazily builds one compact discovery entry per GPX path.
 */
export default class LibraryDiscoveryIndexService {

    constructor({ loader, summaryBuilder = new TrackSummaryBuilder(), concurrency = 2 }) {

        if (!loader || typeof loader.loadSummary !== "function") {
            throw new TypeError("A discovery-capable GPX loader is required.");
        }

        this.loader = loader;
        this.summaryBuilder = summaryBuilder;
        this.concurrency = Number.isFinite(concurrency)
            ? Math.max(1, Math.floor(concurrency))
            : 2;
        this.generation = 0;
        this.fileEntries = [];
        this.entries = new Map();
        this.failures = new Map();
        this.status = "idle";
        this.buildPromise = null;
        this.buildToken = 0;
        this.entryPromises = new Map();
    }

    setLibrary({ namespace = null, fileEntries = [], generation = 0 } = {}) {

        this.cancel();
        this.generation = generation;
        this.fileEntries = this.#normalizeFileEntries(fileEntries);
        this.entries.clear();
        this.failures.clear();
        this.entryPromises.clear();
        this.status = "idle";
        this.buildPromise = null;
        this.loader.setLibraryNamespace?.(namespace);
    }

    build({ onProgress = null, isCurrent = null } = {}) {

        if (this.status === "ready") {
            return Promise.resolve(this.getEntries());
        }

        if (this.buildPromise) {
            return this.buildPromise;
        }

        const token = ++this.buildToken;
        const generation = this.generation;

        this.status = "building";
        this.buildPromise = this.#build({
            token,
            generation,
            onProgress,
            isCurrent
        }).finally(() => {
            if (token === this.buildToken) {
                this.buildPromise = null;
            }
        });

        return this.buildPromise;
    }

    cancel() {

        this.buildToken += 1;

        if (this.status === "building") {
            this.status = "cancelled";
        }

        this.buildPromise = null;
    }

    getStatus() {

        return this.status;
    }

    getEntries() {

        return [...this.entries.values()].sort((first, second) => {
            return first.relativePath.localeCompare(second.relativePath);
        });
    }

    getEntry(relativePath) {

        return this.entries.get(relativePath) || null;
    }

    loadEntry(relativePath, { isCurrent = null } = {}) {

        const existing = this.getEntry(relativePath);

        if (existing) {
            return Promise.resolve(existing);
        }

        const pending = this.entryPromises.get(relativePath);

        if (pending) {
            return pending;
        }

        const source = this.fileEntries.find(
            entry => entry.relativePath === relativePath
        );

        if (!source) {
            return Promise.resolve(null);
        }

        const generation = this.generation;
        const promise = this.#loadEntry(source, generation, isCurrent)
            .finally(() => {
                if (this.entryPromises.get(relativePath) === promise) {
                    this.entryPromises.delete(relativePath);
                }
            });

        this.entryPromises.set(relativePath, promise);

        return promise;
    }

    getFailures() {

        return new Map(this.failures);
    }

    async #build({ token, generation, onProgress, isCurrent }) {

        const entries = this.fileEntries;
        let nextIndex = 0;
        let completed = 0;

        const worker = async () => {
            while (nextIndex < entries.length) {
                const index = nextIndex++;
                const source = entries[index];
                const summary = await this.loadEntry(source.relativePath, {
                    isCurrent: candidate => (
                        candidate === generation &&
                        (typeof isCurrent !== "function" || isCurrent(candidate))
                    )
                });

                if (!this.#isCurrent(token, generation, isCurrent)) {
                    return;
                }

                if (summary) {
                    this.entries.set(source.relativePath, summary);
                }
                completed += 1;
                onProgress?.({
                    completed,
                    total: entries.length,
                    failures: this.failures.size
                });
            }
        };

        const workerCount = Math.min(this.concurrency, Math.max(entries.length, 1));

        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        if (!this.#isCurrent(token, generation, isCurrent)) {
            return this.getEntries();
        }

        this.status = "ready";
        return this.getEntries();
    }

    async #createFailureSummary({ relativePath, fileHandle }) {

        let file = null;

        try {
            file = await fileHandle?.getFile?.();
        } catch {
            // The entry remains discoverable with path-only fallback data.
        }

        return this.summaryBuilder.build(
            relativePath,
            file || { name: fileHandle?.name || relativePath.split("/").pop() },
            null,
            { status: "error" }
        );
    }

    async #loadEntry(source, generation, isCurrent) {

        let summary;

        try {
            summary = await this.loader.loadSummary(
                source.relativePath,
                source.fileHandle
            );
        } catch (error) {
            summary = await this.#createFailureSummary(source);

            if (this.#isLibraryCurrent(generation, isCurrent)) {
                this.failures.set(source.relativePath, error);
            }
        }

        if (!this.#isLibraryCurrent(generation, isCurrent)) {
            return null;
        }

        this.entries.set(source.relativePath, summary);

        return summary;
    }

    #isLibraryCurrent(generation, isCurrent) {

        return generation === this.generation &&
            (typeof isCurrent !== "function" || isCurrent(generation));
    }

    #isCurrent(token, generation, isCurrent) {

        return token === this.buildToken &&
            generation === this.generation &&
            (typeof isCurrent !== "function" || isCurrent(generation));
    }

    #normalizeFileEntries(fileEntries) {

        const unique = new Map();

        fileEntries.forEach(source => {
            const relativePath = source?.relativePath ?? source?.path;

            if (
                typeof relativePath === "string" &&
                relativePath.length > 0 &&
                source?.fileHandle &&
                !unique.has(relativePath)
            ) {
                unique.set(relativePath, {
                    relativePath,
                    fileHandle: source.fileHandle
                });
            }
        });

        return [...unique.values()];
    }
}
