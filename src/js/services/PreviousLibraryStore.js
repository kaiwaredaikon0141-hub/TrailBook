class IndexedDBAdapter {

    constructor(config, indexedDBFactory) {

        this.config = config;
        this.indexedDB = indexedDBFactory;
    }

    async get(key) {

        const database = await this.#open();

        try {
            return await new Promise((resolve, reject) => {
                const transaction = database.transaction(
                    this.config.objectStoreName,
                    "readonly"
                );
                const request = transaction
                    .objectStore(this.config.objectStoreName)
                    .get(key);

                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => reject(request.error);
                transaction.onabort = () => reject(transaction.error);
            });
        } finally {
            database.close();
        }
    }

    async set(key, value) {

        await this.#write(store => store.put(value, key));
    }

    async delete(key) {

        await this.#write(store => store.delete(key));
    }

    #open() {

        if (!this.indexedDB || typeof this.indexedDB.open !== "function") {
            throw new Error("IndexedDB is not available.");
        }

        return new Promise((resolve, reject) => {
            const request = this.indexedDB.open(
                this.config.databaseName,
                this.config.databaseVersion
            );

            request.onupgradeneeded = () => {
                const database = request.result;

                if (!database.objectStoreNames.contains(
                    this.config.objectStoreName
                )) {
                    database.createObjectStore(this.config.objectStoreName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(
                new Error("IndexedDB upgrade is blocked.")
            );
        });
    }

    async #write(operation) {

        const database = await this.#open();

        try {
            await new Promise((resolve, reject) => {
                const transaction = database.transaction(
                    this.config.objectStoreName,
                    "readwrite"
                );

                operation(transaction.objectStore(
                    this.config.objectStoreName
                ));
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            });
        } finally {
            database.close();
        }
    }
}

function isDirectoryHandle(handle) {

    return Boolean(
        handle &&
        handle.kind === "directory" &&
        typeof handle.name === "string" &&
        typeof handle.queryPermission === "function" &&
        typeof handle.requestPermission === "function"
    );
}

/**
 * Stores only the last successfully opened DirectoryHandle in origin-local
 * IndexedDB. It never uses localStorage or Library files.
 */
export default class PreviousLibraryStore {

    constructor(config, {
        indexedDBFactory = globalThis.indexedDB,
        adapter = null
    } = {}) {

        this.config = config;
        this.adapter = adapter ?? new IndexedDBAdapter(
            config,
            indexedDBFactory
        );
        this.status = "available";
    }

    async load() {

        try {
            const record = await this.adapter.get(this.config.recordKey);

            if (!record) {
                this.status = "available";
                return null;
            }

            if (!isDirectoryHandle(record.handle)) {
                this.status = "invalid";
                await this.#discardInvalidRecord();
                return null;
            }

            this.status = "available";
            return record.handle;
        } catch {
            this.status = "unavailable";
            return null;
        }
    }

    async save(handle) {

        if (!isDirectoryHandle(handle)) {
            return false;
        }

        try {
            await this.adapter.set(this.config.recordKey, { handle });
            this.status = "available";
            return true;
        } catch {
            this.status = "unavailable";
            return false;
        }
    }

    async clear() {

        try {
            await this.adapter.delete(this.config.recordKey);
            this.status = "available";
            return true;
        } catch {
            this.status = "unavailable";
            return false;
        }
    }

    getStatus() {

        return this.status;
    }

    async #discardInvalidRecord() {

        try {
            await this.adapter.delete(this.config.recordKey);
        } catch {
            this.status = "unavailable";
        }
    }
}
