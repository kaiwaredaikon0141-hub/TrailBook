const DEFAULT_COPY_CHUNK_SIZE = 4 * 1024 * 1024;

function validPackageId(value) {
    if (typeof value !== "string" || !value || value.length > 128 ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
        throw new TypeError("Invalid offline map package ID.");
    }
    return value;
}

function validPosition(value, name) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TypeError("Invalid " + name + ".");
    }
}

function notFound(error) {
    return error?.name === "NotFoundError";
}

/** OPFS archive lifecycle boundary; no handles escape to UI consumers. */
export default class OfflineMapArchiveStore {

    constructor({
        storageManager = globalThis.navigator?.storage,
        rootDirectoryName = "trailbook",
        packageDirectoryName = "offline-map-packages"
    } = {}) {
        this.storageManager = storageManager;
        this.rootDirectoryName = rootDirectoryName;
        this.packageDirectoryName = packageDirectoryName;
    }

    getPaths(packageId) {
        const id = validPackageId(packageId);
        const base = this.rootDirectoryName + "/" + this.packageDirectoryName;
        return {
            partial: base + "/" + id + ".partial",
            final: base + "/" + id + ".pmtiles"
        };
    }

    async getCapabilityStatus() {
        if (typeof this.storageManager?.getDirectory !== "function") {
            return { status: "unavailable", error: null };
        }
        try {
            await this.storageManager.getDirectory();
            return { status: "available", error: null };
        } catch (error) {
            return { status: "error", error };
        }
    }

    async getStorageStatus() {
        const capability = await this.getCapabilityStatus();
        let estimate = null;
        let persisted = null;
        let estimateError = null;
        let persistedError = null;
        try {
            estimate = typeof this.storageManager?.estimate === "function"
                ? await this.storageManager.estimate() : null;
        } catch (error) {
            estimateError = error;
        }
        try {
            persisted = typeof this.storageManager?.persisted === "function"
                ? await this.storageManager.persisted() : null;
        } catch (error) {
            persistedError = error;
        }
        return { capability, estimate, persisted,
            errors: { estimate: estimateError, persisted: persistedError } };
    }

    async #packageDirectory(create) {
        if (typeof this.storageManager?.getDirectory !== "function") {
            throw new Error("OPFS is unavailable.");
        }
        const root = await this.storageManager.getDirectory();
        const trailbook = await root.getDirectoryHandle(
            this.rootDirectoryName, { create }
        );
        return trailbook.getDirectoryHandle(
            this.packageDirectoryName, { create }
        );
    }

    #fileName(packageId, kind) {
        const id = validPackageId(packageId);
        if (kind !== "partial" && kind !== "final") {
            throw new TypeError("Invalid offline map archive kind.");
        }
        return id + "." + (kind === "final" ? "pmtiles" : "partial");
    }

    async #fileHandle(packageId, kind, create = false) {
        const directory = await this.#packageDirectory(create);
        return directory.getFileHandle(this.#fileName(packageId, kind), {
            create
        });
    }

    async createPartial(packageId, { truncate = false } = {}) {
        const handle = await this.#fileHandle(packageId, "partial", true);
        if (truncate) {
            const writable = await handle.createWritable();
            await writable.truncate(0);
            await writable.close();
        }
        const file = await handle.getFile();
        return { path: this.getPaths(packageId).partial, size: file.size };
    }

    async writePartial(packageId, data, { offset = null } = {}) {
        const handle = await this.#fileHandle(packageId, "partial", true);
        const current = await handle.getFile();
        const position = offset === null ? current.size : offset;
        validPosition(position, "archive write offset");
        const writable = await handle.createWritable({ keepExistingData: true });
        try {
            await writable.seek(position);
            await writable.write(data);
            await writable.close();
        } catch (error) {
            await writable.abort?.();
            throw error;
        }
        return (await handle.getFile()).size;
    }

    async getFileSize(packageId, { kind = "final" } = {}) {
        try {
            return (await (await this.#fileHandle(packageId, kind)).getFile()).size;
        } catch (error) {
            if (notFound(error)) return null;
            throw error;
        }
    }

    async readRange(packageId, {
        kind = "final", offset = 0, length
    } = {}) {
        validPosition(offset, "archive read offset");
        validPosition(length, "archive read length");
        const file = await (await this.#fileHandle(packageId, kind)).getFile();
        return file.slice(offset, Math.min(file.size, offset + length))
            .arrayBuffer();
    }

    async finalize(packageId, { chunkSize = DEFAULT_COPY_CHUNK_SIZE } = {}) {
        validPosition(chunkSize, "archive copy chunk size");
        if (chunkSize === 0) throw new TypeError("Archive chunk size is zero.");
        const partialHandle = await this.#fileHandle(packageId, "partial");
        const partial = await partialHandle.getFile();
        const finalHandle = await this.#fileHandle(packageId, "final", true);
        const writable = await finalHandle.createWritable();
        try {
            for (let offset = 0; offset < partial.size; offset += chunkSize) {
                const bytes = await partial.slice(
                    offset, Math.min(partial.size, offset + chunkSize)
                ).arrayBuffer();
                await writable.write(bytes);
            }
            await writable.close();
        } catch (error) {
            await writable.abort?.();
            throw error;
        }
        const finalSize = (await finalHandle.getFile()).size;
        if (finalSize !== partial.size) {
            throw new Error("Final offline map archive size mismatch.");
        }
        const directory = await this.#packageDirectory(false);
        await directory.removeEntry(this.#fileName(packageId, "partial"));
        return { path: this.getPaths(packageId).final, size: finalSize };
    }

    async inspectPackageFiles(packageId) {
        const paths = this.getPaths(packageId);
        const inspect = async kind => {
            const size = await this.getFileSize(packageId, { kind });
            return { path: paths[kind], exists: size !== null, size };
        };
        const [partial, final] = await Promise.all([
            inspect("partial"), inspect("final")
        ]);
        return { partial, final };
    }

    async listPackagePaths() {
        let directory;
        try {
            directory = await this.#packageDirectory(false);
        } catch (error) {
            if (notFound(error)) return [];
            throw error;
        }
        const paths = [];
        for await (const [name, handle] of directory.entries()) {
            if (handle.kind === "file" &&
                (name.endsWith(".partial") || name.endsWith(".pmtiles"))) {
                paths.push(this.rootDirectoryName + "/" +
                    this.packageDirectoryName + "/" + name);
            }
        }
        return paths.sort();
    }

    async deleteArchive(packageId) {
        let directory;
        try {
            directory = await this.#packageDirectory(false);
        } catch (error) {
            if (notFound(error)) return { partial: false, final: false };
            throw error;
        }
        const remove = async kind => {
            try {
                await directory.removeEntry(this.#fileName(packageId, kind));
                return true;
            } catch (error) {
                if (notFound(error)) return false;
                throw error;
            }
        };
        return { partial: await remove("partial"), final: await remove("final") };
    }
}
