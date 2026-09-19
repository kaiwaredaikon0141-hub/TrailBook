import PMTilesArchiveSource from "../services/PMTilesArchiveSource.js";

const DEFAULT_VERIFY_CHUNK_SIZE = 4 * 1024 * 1024;
const DEFAULT_QUOTA_HEADROOM = 32 * 1024 * 1024;
const PACKAGE_TILE_TYPES = new Set([
    "png", "jpeg", "webp", "avif", "mvt"
]);

export class OfflineMapPackageDownloadError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = "OfflineMapPackageDownloadError";
        this.code = code;
    }
}

function failure(code, message, cause) {
    return new OfflineMapPackageDownloadError(
        code, message, cause ? { cause } : undefined
    );
}

function requireText(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${label} is required.`);
    }
    return value;
}

function optionalText(value, label) {
    if (value == null) return null;
    return requireText(value, label);
}

function normalizeBounds(value) {
    const bounds = {
        west: value?.west,
        south: value?.south,
        east: value?.east,
        north: value?.north
    };
    if (!Object.values(bounds).every(Number.isFinite) ||
        bounds.west < -180 || bounds.east > 180 ||
        bounds.south < -90 || bounds.north > 90 ||
        bounds.west > bounds.east || bounds.south > bounds.north) {
        throw new TypeError("Package bounds are invalid.");
    }
    return Object.freeze(bounds);
}

function normalizeDescriptor(value) {
    const packageId = requireText(value?.packageId, "Package ID");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(packageId) ||
        packageId.length > 128) {
        throw new TypeError("Package ID is invalid.");
    }
    const url = requireText(value?.url, "Package URL");
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        throw new TypeError("Package URL is invalid.");
    }
    if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) {
        throw new TypeError("Package URL protocol is unsupported.");
    }
    if (!Number.isSafeInteger(value?.byteLength) || value.byteLength <= 0) {
        throw new TypeError("Package byte length is invalid.");
    }
    if (!Number.isInteger(value?.minZoom) || value.minZoom < 0 ||
        !Number.isInteger(value?.maxZoom) || value.maxZoom > 30 ||
        value.minZoom > value.maxZoom) {
        throw new TypeError("Package zoom range is invalid.");
    }
    if (!PACKAGE_TILE_TYPES.has(value?.tileType)) {
        throw new TypeError("Package tile type is unsupported.");
    }
    const checksum = optionalText(value?.checksum, "Package checksum");
    const checksumAlgorithm = optionalText(
        value?.checksumAlgorithm, "Package checksum algorithm"
    );
    if (Boolean(checksum) !== Boolean(checksumAlgorithm)) {
        throw new TypeError(
            "Package checksum and algorithm must be supplied together."
        );
    }
    return Object.freeze({
        packageId,
        sourceId: requireText(value?.sourceId, "Package source ID"),
        version: requireText(value?.version, "Package version"),
        url: parsedUrl.href,
        byteLength: value.byteLength,
        checksum,
        checksumAlgorithm,
        bounds: normalizeBounds(value.bounds),
        minZoom: value.minZoom,
        maxZoom: value.maxZoom,
        tileType: value.tileType,
        attribution: requireText(value?.attribution, "Package attribution"),
        etag: optionalText(value?.etag, "Package ETag"),
        lastModified: optionalText(
            value?.lastModified, "Package Last-Modified"
        )
    });
}

function parseContentRange(value) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? "");
    if (!match) return null;
    const result = {
        start: Number(match[1]),
        end: Number(match[2]),
        total: Number(match[3])
    };
    return Object.values(result).every(Number.isSafeInteger) &&
        result.start <= result.end ? result : null;
}

function sameBounds(left, right) {
    return ["west", "south", "east", "north"].every(key =>
        left?.[key] === right?.[key]
    );
}

function sameMetadataIdentity(metadata, descriptor) {
    return metadata?.packageId === descriptor.packageId &&
        metadata.sourceId === descriptor.sourceId &&
        metadata.version === descriptor.version &&
        metadata.url === descriptor.url &&
        metadata.byteLength === descriptor.byteLength &&
        (metadata.checksum ?? null) === descriptor.checksum &&
        (metadata.checksumAlgorithm ?? null) ===
            descriptor.checksumAlgorithm &&
        metadata.minZoom === descriptor.minZoom &&
        metadata.maxZoom === descriptor.maxZoom &&
        metadata.tileType === descriptor.tileType &&
        sameBounds(metadata.bounds, descriptor.bounds);
}

function packageRecord(descriptor, paths, downloadedBytes = 0) {
    return {
        packageId: descriptor.packageId,
        sourceId: descriptor.sourceId,
        version: descriptor.version,
        status: downloadedBytes > 0 ? "partial" : "planned",
        opfsPath: paths.final,
        byteLength: descriptor.byteLength,
        downloadedBytes,
        checksum: descriptor.checksum,
        checksumAlgorithm: descriptor.checksumAlgorithm,
        integrityStatus: descriptor.checksum ? "pending" : "none",
        bounds: { ...descriptor.bounds },
        minZoom: descriptor.minZoom,
        maxZoom: descriptor.maxZoom,
        tileType: descriptor.tileType,
        attribution: descriptor.attribution,
        stylePackageId: null,
        url: descriptor.url,
        etag: descriptor.etag,
        lastModified: descriptor.lastModified,
        errorCode: null,
        errorMessage: null
    };
}

function responseHeader(response, name) {
    return response?.headers?.get?.(name) ?? null;
}

function checksumEqual(left, right) {
    return String(left).trim().toLowerCase() ===
        String(right).trim().toLowerCase();
}

/** Explicit remote PMTiles package download and resume lifecycle boundary. */
export default class OfflineMapPackageDownloadCoordinator {

    constructor({ repository, archiveStore, archiveReader,
        fetchImpl = globalThis.fetch?.bind(globalThis),
        storageEstimate = () => globalThis.navigator?.storage?.estimate?.(),
        integrityVerifier = null,
        verifyChunkSize = DEFAULT_VERIFY_CHUNK_SIZE,
        quotaHeadroomBytes = DEFAULT_QUOTA_HEADROOM,
        abortControllerFactory = () => new AbortController() } = {}) {
        if (!repository?.getPackage || !repository?.createPackage ||
            !repository?.updatePackage || !repository?.deletePackage ||
            !archiveStore?.getFileSize || !archiveStore?.writePartial ||
            !archiveStore?.readRange || !archiveStore?.finalize ||
            !archiveStore?.deleteArchive || !archiveStore?.getPaths ||
            !archiveStore?.createPartial ||
            !archiveStore?.inspectPackageFiles ||
            !archiveReader?.inspectSource ||
            typeof fetchImpl !== "function" ||
            !Number.isSafeInteger(verifyChunkSize) || verifyChunkSize <= 0 ||
            !Number.isSafeInteger(quotaHeadroomBytes) ||
            quotaHeadroomBytes < 0) {
            throw new TypeError(
                "Offline map package downloader dependencies are invalid."
            );
        }
        this.repository = repository;
        this.archiveStore = archiveStore;
        this.archiveReader = archiveReader;
        this.fetchImpl = fetchImpl;
        this.storageEstimate = storageEstimate;
        this.integrityVerifier = integrityVerifier;
        this.verifyChunkSize = verifyChunkSize;
        this.quotaHeadroomBytes = quotaHeadroomBytes;
        this.abortControllerFactory = abortControllerFactory;
        this.listeners = new Set();
        this.activeJob = null;
        this.state = Object.freeze({ status: "idle" });
    }

    subscribe(listener) {
        if (typeof listener !== "function") {
            throw new TypeError("Package download listener must be a function.");
        }
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getState() {
        return this.state;
    }

    async planDownload(input) {
        if (this.activeJob) {
            throw failure("job-active", "A package download is already active.");
        }
        return this.#planDownload(input);
    }

    async #planDownload(input) {
        const descriptor = normalizeDescriptor(input);
        const files = await this.archiveStore.inspectPackageFiles(
            descriptor.packageId
        );
        if (files.final.exists) {
            throw failure(
                "final-exists", "The package final archive already exists."
            );
        }
        const actualBytes = files.partial.exists ? files.partial.size : 0;
        if (actualBytes > descriptor.byteLength) {
            throw failure(
                "partial-size-invalid",
                "The partial archive is larger than the package."
            );
        }
        let metadata = await this.repository.getPackage(descriptor.packageId);
        if (metadata && !sameMetadataIdentity(metadata, descriptor)) {
            await this.#recordFailure(metadata, "partial-incompatible",
                "Stored package metadata does not match the descriptor.",
                actualBytes);
            throw failure(
                "partial-incompatible",
                "Stored package metadata does not match the descriptor."
            );
        }
        if (!metadata) {
            metadata = await this.repository.createPackage(packageRecord(
                descriptor,
                this.archiveStore.getPaths(descriptor.packageId),
                actualBytes
            ));
        } else {
            metadata = await this.repository.updatePackage(
                descriptor.packageId,
                {
                    status: actualBytes > 0 ? "partial" : "planned",
                    downloadedBytes: actualBytes,
                    errorCode: null,
                    errorMessage: null
                }
            );
        }
        const quota = await this.#quotaPreflight(
            descriptor.byteLength - actualBytes
        );
        if (quota.sufficient === false) {
            await this.#recordFailure(metadata, "quota-preflight",
                "Available device storage is below the safety threshold.",
                actualBytes);
            throw failure(
                "quota-preflight",
                "Available device storage is below the safety threshold."
            );
        }
        const plan = Object.freeze({
            descriptor,
            downloadedBytes: actualBytes,
            remainingBytes: descriptor.byteLength - actualBytes,
            resumable: actualBytes > 0,
            quota
        });
        this.#publish({
            status: metadata.status,
            packageId: descriptor.packageId,
            downloadedBytes: actualBytes,
            totalBytes: descriptor.byteLength,
            remainingBytes: plan.remainingBytes
        });
        return plan;
    }

    startDownload(input) {
        return this.#start(input, false);
    }

    resume(input) {
        return this.#start(input, true);
    }

    cancel() {
        if (!this.activeJob || this.activeJob.controller.signal.aborted) {
            return false;
        }
        this.activeJob.cancelled = true;
        this.activeJob.controller.abort();
        Promise.resolve(this.activeJob.reader?.cancel?.()).catch(() => {});
        return true;
    }

    async deletePackage(packageId) {
        requireText(packageId, "Package ID");
        if (this.activeJob?.packageId === packageId) {
            throw failure("job-active", "Cannot delete an active package.");
        }
        const removedFiles = await this.archiveStore.deleteArchive(packageId);
        const removedMetadata = await this.repository.deletePackage(packageId);
        return { ...removedFiles, metadata: removedMetadata };
    }

    async #start(input, resume) {
        if (this.activeJob) {
            throw failure("job-active", "A package download is already active.");
        }
        const controller = this.abortControllerFactory();
        const job = {
            packageId: input?.packageId ?? null,
            controller,
            cancelled: false
        };
        this.activeJob = job;
        try {
            const plan = await this.#planDownload(input);
            job.packageId = plan.descriptor.packageId;
            if (resume && !plan.resumable) {
                throw failure(
                    "partial-missing", "No partial archive is available."
                );
            }
            if (!resume && plan.resumable) {
                throw failure(
                    "partial-exists",
                    "Resume or explicitly delete the partial archive."
                );
            }
            return await this.#run(plan, job);
        } finally {
            if (this.activeJob === job) this.activeJob = null;
        }
    }

    async #run(plan, job) {
        const { descriptor } = plan;
        let downloadedBytes = plan.downloadedBytes;
        try {
            if (!plan.resumable) {
                await this.archiveStore.createPartial(descriptor.packageId, {
                    truncate: true
                });
            }
            await this.repository.updatePackage(descriptor.packageId, {
                status: "downloading",
                downloadedBytes,
                errorCode: null,
                errorMessage: null
            });
            this.#publishProgress(descriptor, downloadedBytes, "downloading");

            if (downloadedBytes < descriptor.byteLength) {
                const response = await this.#fetch(descriptor, downloadedBytes,
                    job.controller.signal);
                const remoteIdentity = this.#validateResponse(
                    response, descriptor, downloadedBytes,
                    await this.repository.getPackage(descriptor.packageId)
                );
                await this.repository.updatePackage(descriptor.packageId, {
                    etag: remoteIdentity.etag,
                    lastModified: remoteIdentity.lastModified
                });
                const reader = response.body?.getReader?.();
                if (!reader) {
                    throw failure(
                        "response-body-missing",
                        "Package response does not provide a readable stream."
                    );
                }
                job.reader = reader;
                while (true) {
                    this.#assertCurrent(job);
                    const { done, value } = await reader.read();
                    if (done) break;
                    const bytes = value instanceof Uint8Array
                        ? value : new Uint8Array(value);
                    if (bytes.byteLength === 0) continue;
                    if (downloadedBytes + bytes.byteLength >
                        descriptor.byteLength) {
                        throw failure(
                            "byte-length-overflow",
                            "Package response exceeds the expected byte length."
                        );
                    }
                    const expectedSize = downloadedBytes + bytes.byteLength;
                    const actualSize = await this.archiveStore.writePartial(
                        descriptor.packageId, bytes,
                        { offset: downloadedBytes }
                    );
                    if (actualSize !== expectedSize) {
                        throw failure(
                            "write-size-mismatch",
                            "Partial archive write size is inconsistent."
                        );
                    }
                    downloadedBytes = actualSize;
                    await this.repository.updatePackage(descriptor.packageId, {
                        status: "downloading",
                        downloadedBytes
                    });
                    this.#publishProgress(
                        descriptor, downloadedBytes, "downloading"
                    );
                }
                job.reader = null;
            }
            this.#assertCurrent(job);
            return await this.#verifyAndFinalize(
                descriptor, downloadedBytes, job
            );
        } catch (error) {
            const cancelled = job.cancelled ||
                job.controller.signal.aborted || error?.name === "AbortError";
            const actualBytes = await this.archiveStore.getFileSize(
                descriptor.packageId, { kind: "partial" }
            ) ?? 0;
            const code = cancelled ? "cancelled" :
                (typeof error?.code === "string" ? error.code :
                    (error?.name === "QuotaExceededError"
                        ? "quota-exceeded" : "download-failed"));
            const message = cancelled
                ? "Package download was cancelled."
                : (error?.message ?? "Package download failed.");
            const surfacedError = cancelled ? null :
                (error instanceof OfflineMapPackageDownloadError
                    ? error : failure(code, message, error));
            const metadata = await this.repository.getPackage(
                descriptor.packageId
            );
            if (metadata) {
                await this.#recordFailure(metadata, code, message, actualBytes, {
                    cancelled,
                    integrityFailed: code === "integrity-mismatch"
                });
            }
            const result = {
                status: cancelled || actualBytes > 0 ? "partial" : "failed",
                packageId: descriptor.packageId,
                downloadedBytes: actualBytes,
                totalBytes: descriptor.byteLength,
                cancelled,
                error: surfacedError
            };
            this.#publish(result);
            if (cancelled) return Object.freeze(result);
            throw surfacedError;
        }
    }

    async #verifyAndFinalize(descriptor, downloadedBytes, job) {
        if (downloadedBytes !== descriptor.byteLength) {
            throw failure(
                "byte-length-mismatch",
                "Downloaded package byte length does not match the descriptor."
            );
        }
        await this.repository.updatePackage(descriptor.packageId, {
            status: "verifying",
            downloadedBytes,
            integrityStatus: descriptor.checksum ? "verifying" : "none"
        });
        this.#publishProgress(descriptor, downloadedBytes, "verifying");
        const integrityStatus = await this.#verifyIntegrity(descriptor, job);
        this.#assertCurrent(job);
        const inspected = await this.archiveReader.inspectSource(
            new PMTilesArchiveSource(this.archiveStore, descriptor.packageId, {
                kind: "partial"
            }),
            { expectedSize: descriptor.byteLength }
        );
        this.#validateArchiveDescriptor(inspected, descriptor);
        this.#assertCurrent(job);
        const finalized = await this.archiveStore.finalize(
            descriptor.packageId
        );
        const finalSize = await this.archiveStore.getFileSize(
            descriptor.packageId, { kind: "final" }
        );
        if (finalized.size !== descriptor.byteLength ||
            finalSize !== descriptor.byteLength) {
            throw failure(
                "final-size-mismatch",
                "Final package archive byte length is invalid."
            );
        }
        this.#assertCurrent(job);
        const ready = await this.repository.updatePackage(
            descriptor.packageId,
            {
                status: "ready",
                opfsPath: finalized.path,
                downloadedBytes: finalSize,
                integrityStatus,
                errorCode: null,
                errorMessage: null
            }
        );
        const result = Object.freeze({
            status: "ready",
            packageId: descriptor.packageId,
            downloadedBytes: finalSize,
            totalBytes: descriptor.byteLength,
            integrityStatus,
            metadata: ready,
            cancelled: false
        });
        this.#publish(result);
        return result;
    }

    async #verifyIntegrity(descriptor, job) {
        if (!descriptor.checksum) return "none";
        if (!this.integrityVerifier ||
            this.integrityVerifier.supports?.(
                descriptor.checksumAlgorithm
            ) === false) {
            return "unavailable";
        }
        const verifier = await this.integrityVerifier.create?.({
            algorithm: descriptor.checksumAlgorithm
        });
        if (!verifier?.update || !verifier?.digest) return "unavailable";
        for (let offset = 0; offset < descriptor.byteLength;
            offset += this.verifyChunkSize) {
            this.#assertCurrent(job);
            const length = Math.min(
                this.verifyChunkSize, descriptor.byteLength - offset
            );
            const data = await this.archiveStore.readRange(
                descriptor.packageId,
                { kind: "partial", offset, length }
            );
            await verifier.update(new Uint8Array(data));
        }
        const digest = await verifier.digest();
        if (!checksumEqual(digest, descriptor.checksum)) {
            throw failure(
                "integrity-mismatch", "Package checksum validation failed."
            );
        }
        return "verified";
    }

    async #fetch(descriptor, offset, signal) {
        const headers = offset > 0
            ? { Range: `bytes=${offset}-` } : undefined;
        try {
            return await this.fetchImpl(descriptor.url, { signal, headers });
        } catch (error) {
            if (signal.aborted || error?.name === "AbortError") throw error;
            throw failure("network-error", "Package request failed.", error);
        }
    }

    #validateResponse(response, descriptor, offset, metadata) {
        const status = response?.status ?? 0;
        if (offset > 0 && status !== 206) {
            throw failure(
                "range-not-honored",
                "The server did not honor the package resume range."
            );
        }
        if (offset === 0 && status !== 200 && status !== 206) {
            throw failure(
                "http-status", `Package request failed with HTTP ${status}.`
            );
        }
        const contentRange = responseHeader(response, "content-range");
        if (status === 206) {
            const range = parseContentRange(contentRange);
            if (!range || range.start !== offset) {
                throw failure(
                    "content-range-invalid",
                    "Package Content-Range does not match the resume offset."
                );
            }
            if (range.total !== descriptor.byteLength) {
                throw failure(
                    "remote-size-changed",
                    "Remote package byte length changed."
                );
            }
        }
        const contentLengthHeader = responseHeader(response, "content-length");
        if (contentLengthHeader !== null) {
            const contentLength = Number(contentLengthHeader);
            if (!Number.isSafeInteger(contentLength) || contentLength < 0 ||
                contentLength !== descriptor.byteLength - offset) {
                throw failure(
                    "content-length-invalid",
                    "Package response Content-Length is invalid."
                );
            }
        }
        const etag = responseHeader(response, "etag");
        const lastModified = responseHeader(response, "last-modified");
        this.#validateIdentityHeader(
            "ETag", metadata?.etag ?? descriptor.etag, etag
        );
        this.#validateIdentityHeader(
            "Last-Modified",
            metadata?.lastModified ?? descriptor.lastModified,
            lastModified
        );
        return {
            etag: etag ?? metadata?.etag ?? descriptor.etag,
            lastModified: lastModified ?? metadata?.lastModified ??
                descriptor.lastModified
        };
    }

    #validateIdentityHeader(label, expected, actual) {
        if (!expected) return;
        if (!actual || actual !== expected) {
            throw failure(
                "remote-identity-changed", `${label} changed or is missing.`
            );
        }
    }

    #validateArchiveDescriptor(inspected, descriptor) {
        if (inspected.archiveVersion !== 3 ||
            inspected.tileType !== descriptor.tileType ||
            inspected.minZoom !== descriptor.minZoom ||
            inspected.maxZoom !== descriptor.maxZoom ||
            !sameBounds(inspected.bounds, descriptor.bounds)) {
            throw failure(
                "pmtiles-descriptor-mismatch",
                "PMTiles archive metadata does not match its descriptor."
            );
        }
    }

    async #quotaPreflight(remainingBytes) {
        const result = Object.seal({
            available: false,
            quota: null,
            usage: null,
            availableBytes: null,
            requiredBytes: remainingBytes + this.quotaHeadroomBytes,
            sufficient: null,
            error: null
        });
        try {
            const estimate = await this.storageEstimate?.();
            if (Number.isFinite(estimate?.quota) &&
                Number.isFinite(estimate?.usage)) {
                result.available = true;
                result.quota = estimate.quota;
                result.usage = estimate.usage;
                result.availableBytes = Math.max(
                    0, estimate.quota - estimate.usage
                );
                result.sufficient = result.availableBytes >=
                    result.requiredBytes;
            }
        } catch (error) {
            result.error = error;
        }
        return Object.freeze({ ...result });
    }

    async #recordFailure(metadata, code, message, downloadedBytes,
        { cancelled = false, integrityFailed = false } = {}) {
        return this.repository.updatePackage(metadata.packageId, {
            status: cancelled || downloadedBytes > 0 ? "partial" : "failed",
            downloadedBytes,
            errorCode: code,
            errorMessage: message,
            integrityStatus: integrityFailed ? "failed" :
                (metadata.integrityStatus ??
                    (metadata.checksum ? "pending" : "none"))
        });
    }

    #assertCurrent(job) {
        if (this.activeJob !== job || job.controller.signal.aborted) {
            throw new DOMException("Package download aborted.", "AbortError");
        }
    }

    #publishProgress(descriptor, downloadedBytes, status) {
        this.#publish({
            status,
            packageId: descriptor.packageId,
            downloadedBytes,
            totalBytes: descriptor.byteLength,
            remainingBytes: Math.max(
                0, descriptor.byteLength - downloadedBytes
            )
        });
    }

    #publish(snapshot) {
        const value = Object.freeze({ ...snapshot });
        this.state = value;
        for (const listener of this.listeners) {
            try {
                listener(value);
            } catch (error) {
                console.error("Package download listener failed.", error);
            }
        }
    }
}
