export default class GPXDisplayQueue {

    constructor(concurrency = 2) {

        this.concurrency = concurrency;
        this.queue = [];
        this.activeCount = 0;
        this.activeRequests = new Set();
        this.idleWaiters = new Set();
    }

    enqueue(request) {

        this.queue.push({
            ...request,
            invalidated: false
        });

        this.#drain();
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

    whenIdle() {

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
            this.activeCount < this.concurrency &&
            this.queue.length > 0
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

    async #run(request) {

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
}
