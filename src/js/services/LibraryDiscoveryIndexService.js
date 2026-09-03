import TrackSummaryBuilder from "./TrackSummaryBuilder.js";
import drivePerformance from "./DrivePerformanceMonitor.js";
import { isTrackSourceUnavailable } from "../core/TrackSourceResolver.js";

/**
 * Lazily builds one compact discovery entry per GPX path.
 */
export default class LibraryDiscoveryIndexService {

    constructor({
        loader,
        summaryBuilder = new TrackSummaryBuilder(),
        concurrency = 2,
        sourceResolver = null
    }) {

        if (!loader || typeof loader.loadSummary !== "function") {
            throw new TypeError("A discovery-capable GPX loader is required.");
        }

        this.loader = loader;
        this.sourceResolver = sourceResolver;
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
        this.entryVersions = new Map();
    }

    setSourceResolver(resolver) {

        this.sourceResolver = typeof resolver?.resolve === "function"
            ? resolver
            : null;
    }

    setLibrary({
        namespace = null,
        fileEntries = [],
        cachedEntries = null,
        generation = 0
    } = {}) {

        this.cancel();
        this.generation = generation;
        this.fileEntries = this.#normalizeFileEntries(fileEntries);
        this.entries = new Map(
            (Array.isArray(cachedEntries) ? cachedEntries : [])
                .filter(entry => entry?.relativePath)
                .map(entry => [entry.relativePath, entry])
        );
        this.failures.clear();
        this.entryPromises.clear();
        this.entryVersions = new Map(
            this.fileEntries.map(entry => [entry.relativePath, 0])
        );
        this.status = Array.isArray(cachedEntries) ? "ready" : "idle";
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
        drivePerformance.recordComponentCall("LibraryDiscoveryIndexService");
        const endDiscovery = drivePerformance.begin(
            "discoveryMs",
            "discoveryCount"
        );
        this.buildPromise = this.#build({
            token,
            generation,
            onProgress,
            isCurrent
        }).finally(() => {
            endDiscovery();
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
        const version = this.entryVersions.get(relativePath) || 0;
        const promise = this.#loadEntry(source, generation, isCurrent, version)
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

    addFileEntry({ relativePath, path, fileHandle } = {}) {

        const candidatePath = relativePath ?? path;

        if (
            typeof candidatePath !== "string" || candidatePath.length === 0 ||
            !fileHandle ||
            this.fileEntries.some(entry => entry.relativePath === candidatePath)
        ) {
            return false;
        }

        this.fileEntries.push({ relativePath: candidatePath, fileHandle });
        this.entryVersions.set(candidatePath, 0);
        return true;
    }

    replaceFileEntry({ relativePath, path, fileHandle } = {}) {

        const candidatePath = relativePath ?? path;
        const index = this.fileEntries.findIndex(
            entry => entry.relativePath === candidatePath
        );

        if (index < 0 || !fileHandle) return false;

        this.fileEntries[index] = { relativePath: candidatePath, fileHandle };
        this.entryVersions.set(
            candidatePath,
            (this.entryVersions.get(candidatePath) || 0) + 1
        );
        this.entries.delete(candidatePath);
        this.failures.delete(candidatePath);
        this.entryPromises.delete(candidatePath);
        return true;
    }

    renameFileEntry({ sourcePath, targetPath, fileHandle } = {}) {

        const index = this.fileEntries.findIndex(
            entry => entry.relativePath === sourcePath
        );

        if (
            index < 0 || !targetPath || !fileHandle ||
            this.fileEntries.some(entry => entry.relativePath === targetPath)
        ) return false;

        const hadLoadedEntry = this.entries.has(sourcePath);

        this.fileEntries[index] = { relativePath: targetPath, fileHandle };
        this.entryVersions.delete(sourcePath);
        this.entryVersions.set(targetPath, 0);
        this.entries.delete(sourcePath);
        this.failures.delete(sourcePath);
        this.entryPromises.delete(sourcePath);

        return hadLoadedEntry;
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

    #createFailureSummary({ relativePath, fileHandle }) {
        return this.summaryBuilder.build(
            relativePath,
            { name: fileHandle?.name || relativePath.split("/").pop() },
            null,
            { status: "error" }
        );
    }

    async #loadEntry(source, generation, isCurrent, version) {

        let summary;

        try {
            const resolved = this.sourceResolver?.resolve(
                source.relativePath
            );

            if (!resolved || isTrackSourceUnavailable(resolved)) {
                summary = this.#createUnavailableSummary(source);
            } else {
                summary = await this.loader.loadSummary(
                    source.relativePath,
                    resolved.actualFileHandle
                );
                if (isTrackSourceUnavailable(summary)) {
                    summary = this.#createUnavailableSummary(source);
                }
            }
        } catch (error) {
            summary = this.#createFailureSummary(source);

            if (this.#isEntryCurrent(
                source.relativePath,
                generation,
                version,
                isCurrent
            )) {
                this.failures.set(source.relativePath, error);
            }
        }

        if (!this.#isEntryCurrent(
            source.relativePath,
            generation,
            version,
            isCurrent
        )) {
            return null;
        }

        this.entries.set(source.relativePath, summary);

        return summary;
    }

    #createUnavailableSummary({ relativePath, fileHandle }) {

        return this.summaryBuilder.build(relativePath, {
            name: fileHandle?.name || relativePath.split("/").pop()
        }, null);
    }

    #isLibraryCurrent(generation, isCurrent) {

        return generation === this.generation &&
            (typeof isCurrent !== "function" || isCurrent(generation));
    }

    #isEntryCurrent(relativePath, generation, version, isCurrent) {

        return this.#isLibraryCurrent(generation, isCurrent) &&
            this.entryVersions.get(relativePath) === version;
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
