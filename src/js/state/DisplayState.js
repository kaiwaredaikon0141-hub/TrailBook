const MAX_CACHE_ENTRIES = 100;

const IDLE = "idle";

export default class DisplayState {

    constructor() {

        this.libraryGeneration = 0;
        this.libraryRootHandle = null;
        this.displays = new Map();
        this.cache = new Map();
        this.requestIds = new Map();
        this.listeners = new Set();
    }

    subscribe(listener) {

        if (typeof listener !== "function") {
            throw new TypeError("DisplayState listener must be a function.");
        }

        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    setLibrary(rootHandle) {

        this.libraryGeneration += 1;
        this.libraryRootHandle = rootHandle;
        this.displays.clear();
        this.cache.clear();
        this.requestIds.clear();
        this.#notify(null);

        return this.libraryGeneration;
    }

    getLibraryGeneration() {

        return this.libraryGeneration;
    }

    registerFile(path, fileHandle, color) {

        const previous = this.displays.get(path);

        this.displays.set(path, {
            path,
            fileHandle,
            checked: previous?.checked ?? false,
            state: previous?.state ?? IDLE,
            color,
            error: previous?.error ?? null,
            requestId: previous?.requestId ?? 0,
            lastUsedAt: previous?.lastUsedAt ?? 0
        });
        this.#notify(path);
    }

    rebindFileHandle(path, fileHandle) {

        const display = this.displays.get(path);

        if (!display || !fileHandle || display.fileHandle === fileHandle) {
            return false;
        }

        display.fileHandle = fileHandle;

        return true;
    }

    unregisterFile(path) {

        const removed = this.displays.delete(path);

        this.cache.delete(path);
        this.requestIds.delete(path);
        if (removed) this.#notify(null);
        return removed;
    }

    replaceFilePath(sourcePath, targetPath, fileHandle, color) {

        const previous = this.displays.get(sourcePath);

        if (!previous || this.displays.has(targetPath)) return false;

        this.displays.delete(sourcePath);
        this.cache.delete(sourcePath);
        this.requestIds.delete(sourcePath);
        this.displays.set(targetPath, {
            ...previous,
            path: targetPath,
            fileHandle,
            color,
            state: IDLE,
            error: null,
            requestId: 0
        });
        this.#notify(null);
        return true;
    }

    getDisplay(path) {

        return this.displays.get(path) || null;
    }

    getDisplays() {

        return this.displays;
    }

    getCheckedPaths() {

        return [...this.displays.values()]
            .filter(display => display.checked)
            .map(display => display.path);
    }

    setChecked(path, checked) {

        const display = this.displays.get(path);

        if (display) {
            display.checked = checked;

            if (checked) {
                display.lastUsedAt = Date.now();
            }

            this.#notify(path);
        }
    }

    setLoading(path, requestId) {

        const display = this.displays.get(path);

        if (display) {
            display.state = "loading";
            display.error = null;
            display.requestId = requestId;
            this.#notify(path);
        }
    }

    setLoaded(path, result) {

        const display = this.displays.get(path);

        if (display) {
            display.state = "loaded";
            display.error = null;
            display.lastUsedAt = Date.now();
            this.#notify(path);
        }
    }

    setError(path, error) {

        const display = this.displays.get(path);

        if (display) {
            display.state = "error";
            display.error = error;
            display.checked = false;
            this.#notify(path);
        }
    }

    setIdle(path) {

        const display = this.displays.get(path);

        if (display) {
            display.state = IDLE;
            display.error = null;
            this.#notify(path);
        }
    }

    getCachedResult(path) {

        const entry = this.cache.get(path);

        if (entry) {
            entry.lastUsedAt = Date.now();
        }

        return entry?.result || null;
    }

    setCachedResult(path, result) {

        const display = this.displays.get(path);

        if (!display) {
            return;
        }

        this.cache.set(path, {
            path,
            fileHandle: display.fileHandle,
            result,
            color: display.color,
            lastUsedAt: Date.now()
        });

        this.evictCache();
    }

    invalidateCachedResult(path) {

        return this.cache.delete(path);
    }

    touchCache(path) {

        const entry = this.cache.get(path);

        if (entry) {
            entry.lastUsedAt = Date.now();
        }
    }

    invalidateRequest(path) {

        const requestId = (this.requestIds.get(path) || 0) + 1;

        this.requestIds.set(path, requestId);

        const display = this.displays.get(path);

        if (display) {
            display.requestId = requestId;
            display.state = display.checked ? display.state : IDLE;
            this.#notify(path);
        }

        return requestId;
    }

    nextRequestId(path) {

        return this.invalidateRequest(path);
    }

    isCurrentRequest(path, requestId, generation) {

        const display = this.displays.get(path);

        return generation === this.libraryGeneration &&
            this.requestIds.get(path) === requestId &&
            display?.requestId === requestId &&
            display.checked === true;
    }

    clearDisplays() {

        this.displays.forEach(display => {
            display.checked = false;
            display.state = IDLE;
            display.error = null;
        });

        this.requestIds.clear();
        this.#notify(null);
    }

    clearLibrary() {

        this.libraryGeneration += 1;
        this.libraryRootHandle = null;
        this.displays.clear();
        this.cache.clear();
        this.requestIds.clear();
        this.#notify(null);
    }

    evictCache() {

        while (this.cache.size > MAX_CACHE_ENTRIES) {

            const candidates = [...this.cache.values()].filter(entry => {

                const display = this.displays.get(entry.path);

                return !display?.checked && display?.state !== "loading";
            });

            if (candidates.length === 0) {
                return;
            }

            candidates.sort((first, second) => first.lastUsedAt - second.lastUsedAt);
            this.cache.delete(candidates[0].path);
        }
    }

    #notify(path) {

        const display = path === null ? null : this.getDisplay(path);

        this.listeners.forEach(listener => listener({ path, display }));
    }
}
