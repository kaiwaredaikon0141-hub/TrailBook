const now = () => globalThis.performance?.now?.() ?? Date.now();

class DrivePerformanceMonitor {

    constructor() {
        this.sessionSequence = 0;
        this.sessionId = null;
        this.active = false;
        this.ready = false;
        this.timer = null;
        this.operations = 0;
        this.metrics = null;
        this.componentCalls = new Map();
        this.firstPostSummaryComponent = null;
        this.summaryEmitted = false;
        this.restoreProducerStarted = false;
        this.restoreProducerCompleted = false;
        this.displayQueueIdle = false;
        this.restoreOwner = null;
        this.restoreGenerationId = null;
        this.expectedEnqueueCount = null;
        this.actualEnqueueCount = 0;
    }

    start({ restoreOwner = null } = {}) {
        clearTimeout(this.timer);
        this.sessionId = `drive-perf-${++this.sessionSequence}`;
        this.active = true;
        this.ready = false;
        this.operations = 0;
        this.componentCalls.clear();
        this.firstPostSummaryComponent = null;
        this.summaryEmitted = false;
        this.restoreProducerStarted = false;
        this.restoreProducerCompleted = false;
        this.displayQueueIdle = false;
        this.restoreOwner = restoreOwner;
        this.restoreGenerationId = null;
        this.expectedEnqueueCount = null;
        this.actualEnqueueCount = 0;
        this.metrics = {
            startedAt: now(), filesListRequests: 0,
            metadataScanMs: 0, settingsDownloadCount: 0,
            settingsDownloadMs: 0, gpxDownloadCount: 0,
            gpxDownloadMs: 0, parseCount: 0, parseMs: 0,
            cacheHits: 0, cacheMisses: 0, cacheLookupMs: 0,
            cacheGenerationMs: 0, cacheWriteCount: 0, cacheWriteMs: 0,
            activeDriveGpxOperations: 0,
            peakConcurrentDriveGpxOperations: 0,
            gpxLoadPhaseStartedAt: null,
            gpxLoadPhaseEndedAt: null,
            mapLayerCount: 0, mapLayerMs: 0,
            discoveryCount: 0, discoveryMs: 0,
            restoreLifecycleMs: 0
        };
        return this.sessionId;
    }

    setRestoreGeneration(generationId, expectedEnqueueCount = null) {

        if (!this.active) return;
        this.restoreGenerationId = generationId;
        this.expectedEnqueueCount = Number.isInteger(expectedEnqueueCount) &&
            expectedEnqueueCount >= 0
            ? expectedEnqueueCount
            : null;
        this.actualEnqueueCount = 0;
    }

    recordGenerationEnqueue(generationId, actualEnqueueCount) {

        if (!this.active || generationId !== this.restoreGenerationId) return;
        this.actualEnqueueCount = actualEnqueueCount;
    }

    cancel() {
        clearTimeout(this.timer);
        this.active = false;
    }

    recordComponentCall(component) {
        if (!this.sessionId) return;
        this.componentCalls.set(
            component,
            (this.componentCalls.get(component) || 0) + 1
        );

        if (this.summaryEmitted) {
            this.firstPostSummaryComponent ??= component;
        }
    }

    increment(name, amount = 1) {
        if (!this.active || !(name in this.metrics)) return;
        this.metrics[name] += amount;
        this.#schedule();
    }

    begin(durationName, countName = null) {
        if (!this.active) return () => {};
        const startedAt = now();
        const sessionId = this.sessionId;
        const metrics = this.metrics;

        this.operations += 1;
        if (countName) this.increment(countName);
        let ended = false;

        return () => {
            if (
                ended ||
                !this.active ||
                this.sessionId !== sessionId
            ) return;
            ended = true;
            metrics[durationName] += now() - startedAt;
            this.operations = Math.max(0, this.operations - 1);
            this.#schedule();
        };
    }

    recordCacheLookup({ hit, durationMs }) {
        if (!this.active) return;
        this.metrics.cacheLookupMs += durationMs;
        this.metrics[hit ? "cacheHits" : "cacheMisses"] += 1;
        this.#schedule();
    }

    beginDriveGpxOperation() {

        if (!this.active) return () => {};

        const metrics = this.metrics;
        const sessionId = this.sessionId;

        metrics.gpxLoadPhaseStartedAt ??= now();
        metrics.activeDriveGpxOperations += 1;
        metrics.peakConcurrentDriveGpxOperations = Math.max(
            metrics.peakConcurrentDriveGpxOperations,
            metrics.activeDriveGpxOperations
        );
        this.operations += 1;
        let ended = false;

        return () => {
            if (
                ended ||
                !this.active ||
                this.sessionId !== sessionId
            ) return;
            ended = true;
            metrics.activeDriveGpxOperations = Math.max(
                0,
                metrics.activeDriveGpxOperations - 1
            );
            metrics.gpxLoadPhaseEndedAt = now();
            this.operations = Math.max(0, this.operations - 1);
            this.#schedule();
        };
    }

    markInitialRestoreStarted(sessionId = this.sessionId) {
        if (!this.#ownsSession(sessionId)) return;
        this.ready = true;
        this.#schedule();
    }

    markRestoreProducerStarted(owner) {

        if (!this.#ownsRestore(owner)) return;
        this.restoreProducerStarted = true;
        this.restoreProducerCompleted = false;
        this.displayQueueIdle = false;
    }

    markRestoreProducerCompleted(owner) {

        if (
            !this.#ownsRestore(owner) ||
            !this.restoreProducerStarted ||
            !Number.isInteger(this.expectedEnqueueCount) ||
            this.actualEnqueueCount !== this.expectedEnqueueCount
        ) return;
        this.restoreProducerCompleted = true;
        this.#schedule();
    }

    markDisplayQueueIdle(owner) {

        if (!this.#ownsRestore(owner) || !this.restoreProducerCompleted) return;
        this.displayQueueIdle = true;
        this.#schedule();
    }

    #schedule() {
        clearTimeout(this.timer);
        if (!this.#canFinish()) return;
        this.#finish();
    }

    #finish() {
        if (!this.#canFinish()) return;
        const metrics = this.metrics;
        const totalMs = now() - metrics.startedAt;
        const measuredExclusiveMs = metrics.metadataScanMs +
            metrics.settingsDownloadMs + metrics.gpxDownloadMs +
            metrics.cacheLookupMs + metrics.cacheGenerationMs +
            metrics.cacheWriteMs + metrics.mapLayerMs;
        const average = (total, count) => count > 0 ? total / count : 0;
        const gpxLoadPhaseWallMs = metrics.gpxLoadPhaseStartedAt !== null &&
            metrics.gpxLoadPhaseEndedAt !== null
            ? metrics.gpxLoadPhaseEndedAt - metrics.gpxLoadPhaseStartedAt
            : 0;

        this.summaryEmitted = true;
        console.info("[TrailBook Drive Perf]", {
            totalMs,
            filesListRequests: metrics.filesListRequests,
            metadataScanMs: metrics.metadataScanMs,
            settingsDownload: {
                count: metrics.settingsDownloadCount,
                totalMs: metrics.settingsDownloadMs,
                averageMs: average(
                    metrics.settingsDownloadMs,
                    metrics.settingsDownloadCount
                )
            },
            gpxDownload: {
                count: metrics.gpxDownloadCount,
                totalMs: metrics.gpxDownloadMs,
                averageMs: average(metrics.gpxDownloadMs, metrics.gpxDownloadCount)
            },
            gpxLoadPhaseWallMs,
            peakConcurrentDriveGpxOperations:
                metrics.peakConcurrentDriveGpxOperations,
            parse: {
                count: metrics.parseCount,
                totalMs: metrics.parseMs,
                averageMs: average(metrics.parseMs, metrics.parseCount)
            },
            geometryCache: {
                hits: metrics.cacheHits,
                misses: metrics.cacheMisses,
                lookupTotalMs: metrics.cacheLookupMs,
                lookupAverageMs: average(
                    metrics.cacheLookupMs,
                    metrics.cacheHits + metrics.cacheMisses
                ),
                generationTotalMs: metrics.cacheGenerationMs,
                writes: metrics.cacheWriteCount,
                writeTotalMs: metrics.cacheWriteMs
            },
            mapLayer: {
                count: metrics.mapLayerCount,
                totalMs: metrics.mapLayerMs,
                averageMs: average(metrics.mapLayerMs, metrics.mapLayerCount)
            },
            discovery: {
                count: metrics.discoveryCount,
                totalMs: metrics.discoveryMs
            },
            restoreLifecycleMs: metrics.restoreLifecycleMs,
            otherWaitMs: Math.max(0, totalMs - measuredExclusiveMs)
        });
        this.active = false;
    }

    #canFinish() {

        return Boolean(
            this.active &&
            this.ready &&
            this.restoreProducerStarted &&
            this.restoreProducerCompleted &&
            this.displayQueueIdle &&
            Number.isInteger(this.expectedEnqueueCount) &&
            this.actualEnqueueCount === this.expectedEnqueueCount &&
            this.operations === 0
        );
    }

    #ownsSession(sessionId) {

        return Boolean(
            this.active &&
            typeof sessionId === "string" &&
            sessionId === this.sessionId
        );
    }

    #ownsRestore(owner) {

        return Boolean(
            this.active &&
            owner &&
            owner === this.restoreOwner
        );
    }

}

export default new DrivePerformanceMonitor();
