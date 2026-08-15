import drivePerformance from "./DrivePerformanceMonitor.js";

export default class GPXDisplayQueue {

    constructor(concurrency = 2, driveConcurrency = 4) {

        this.concurrency = concurrency;
        this.driveConcurrency = driveConcurrency;
        this.queue = [];
        this.activeCount = 0;
        this.activeRequests = new Set();
        this.idleWaiters = new Set();
        this.enqueueWaiters = new Set();
        this.generationEnqueueCounts = new Map();
        this.diagnosticSessionId = null;
    }

    enqueue(request) {

        this.#recordGenerationDiagnostic(request);
        drivePerformance.recordComponentCall("GPXDisplayQueue.enqueue");
        this.queue.push({
            ...request,
            invalidated: false
        });
        this.#recordEnqueue(request);

        this.#drain();
    }

    whenEnqueued({ generation, count }) {

        if (!Number.isInteger(count) || count <= 0) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.enqueueWaiters.add({
                generation,
                expected: count,
                remaining: count,
                resolve
            });
        });
    }

    invalidate(path, requestId) {

        this.queue.forEach(request => {

            if (request.path === path && request.requestId === requestId) {
                request.invalidated = true;
            }
        });

        this.activeRequests.forEach(request => {
            if (request.path === path && request.requestId === requestId) {
                request.invalidated = true;
            }
        });
    }

    invalidateGeneration(generation) {

        this.queue.forEach(request => {

            if (request.generation !== generation) {
                request.invalidated = true;
            }
        });

        this.activeRequests.forEach(request => {
            if (request.generation !== generation) {
                request.invalidated = true;
            }
        });
    }

    clear() {

        this.queue.forEach(request => {
            request.invalidated = true;
        });

        this.activeRequests.forEach(request => {
            request.invalidated = true;
        });

        this.queue = [];
        this.#resolveIdleWaiters();
    }

    whenIdle({ generation = null } = {}) {

        drivePerformance.recordComponentCall("GPXDisplayQueue.whenIdle");
        if (this.activeCount === 0 && this.queue.length === 0) {
            return Promise.resolve();
        }

        return new Promise(resolve => this.idleWaiters.add(resolve));
    }

    getActiveCount() {

        return this.activeCount;
    }

    getQueuedCount() {

        return this.queue.length;
    }

    async #drain() {

        while (
            this.queue.length > 0 &&
            this.activeCount < this.#concurrencyFor(this.queue[0])
        ) {
            const request = this.queue.shift();

            if (request.invalidated) {
                continue;
            }

            this.activeCount += 1;
            this.activeRequests.add(request);
            this.#run(request);
        }

        this.#resolveIdleWaiters();
    }

    #concurrencyFor(request) {

        return request?.fileHandle?.driveEntry
            ? this.driveConcurrency
            : this.concurrency;
    }

    async #run(request) {

        drivePerformance.recordComponentCall("GPXDisplayQueue.run");
        try {

            const result = await request.run();

            if (!request.invalidated) {
                request.onSuccess?.(result, request);
            }

        } catch (error) {

            if (!request.invalidated) {
                request.onFailure?.(error, request);
            }

        } finally {

            this.activeCount -= 1;
            this.activeRequests.delete(request);
            this.#drain();
        }
    }

    #resolveIdleWaiters() {

        if (this.activeCount !== 0 || this.queue.length !== 0) {
            return;
        }

        this.idleWaiters.forEach(resolve => resolve());
        this.idleWaiters.clear();
    }

    #recordEnqueue(request) {

        this.enqueueWaiters.forEach(waiter => {
            if (waiter.generation !== request.generation) {
                return;
            }

            waiter.remaining -= 1;
            const actualEnqueueCount =
                this.generationEnqueueCounts.get(request.generation) || 0;

            if (waiter.remaining <= 0) {
                this.enqueueWaiters.delete(waiter);
                waiter.resolve();
            }
        });
    }

    #recordGenerationDiagnostic(request) {

        if (this.diagnosticSessionId !== drivePerformance.sessionId) {
            this.diagnosticSessionId = drivePerformance.sessionId;
            this.generationEnqueueCounts.clear();
        }

        const generation = request?.generation ?? null;
        const actualEnqueueCount =
            (this.generationEnqueueCounts.get(generation) || 0) + 1;

        this.generationEnqueueCounts.set(generation, actualEnqueueCount);
        drivePerformance.recordGenerationEnqueue(
            generation,
            actualEnqueueCount
        );
    }
}
