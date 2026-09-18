import { evaluatePackageLifecycle } from "./OfflineMapPackageRepository.js";
import PMTilesArchiveReader from "./PMTilesArchiveReader.js";
import PMTilesArchiveSource from "./PMTilesArchiveSource.js";
import { parseOfflineMapPackageManifest } from
    "./OfflineMapPackageManifest.js";

function copyEntry(value) {
    return Object.freeze({
        ...value,
        descriptor: value.descriptor,
        actions: Object.freeze({ ...value.actions })
    });
}

function actionState(state, { installedReady = false, active = false } = {}) {
    return {
        download: state === "available" && !active,
        cancel: active && ["planned", "downloading", "verifying"]
            .includes(state),
        resume: state === "partial" && !active,
        delete: state !== "available" && !active,
        select: (state === "ready" ||
            (state === "update-available" && installedReady)) && !active
    };
}

function stateFromLifecycle(metadata, lifecycle, descriptor) {
    if (!metadata) {
        if (lifecycle.files?.partial?.exists) return "partial";
        if (lifecycle.files?.final?.exists) return "missing";
        return "available";
    }
    if (metadata.version !== descriptor.version) {
        return lifecycle.ready ? "update-available" : lifecycle.status;
    }
    if (lifecycle.status === "invalid") return "missing";
    return lifecycle.status;
}

/**
 * Derived regional package view model. Manifest, IndexedDB metadata and OPFS
 * remain the authorities; this catalog owns no persistent lifecycle state.
 */
export default class OfflineMapRegionCatalog {

    constructor({ manifest, repository, archiveStore,
        archiveReader = new PMTilesArchiveReader() }) {
        if (!repository?.listPackages || !archiveStore?.inspectPackageFiles ||
            !archiveStore?.getStorageStatus || !archiveReader?.inspectSource) {
            throw new TypeError("Offline map region catalog dependencies are invalid.");
        }
        this.manifest = parseOfflineMapPackageManifest(manifest);
        this.repository = repository;
        this.archiveStore = archiveStore;
        this.archiveReader = archiveReader;
        this.entries = [];
        this.metadata = new Map();
        this.files = new Map();
    }

    get(identityOrPackageId) {
        return this.entries.find(entry => entry.identity === identityOrPackageId) ??
            this.entries.find(entry => entry.packageId === identityOrPackageId) ??
            null;
    }

    list() {
        return [...this.entries];
    }

    async refresh({ downloadState = null } = {}) {
        const metadataList = await this.repository.listPackages();
        this.metadata = new Map(metadataList.map(value => [value.packageId, value]));
        this.files = new Map();
        const entries = [];
        for (const descriptor of this.manifest.packages) {
            const metadata = this.metadata.get(descriptor.packageId) ?? null;
            const files = await this.archiveStore.inspectPackageFiles(
                descriptor.packageId
            );
            this.files.set(descriptor.packageId, files);
            let lifecycle = evaluatePackageLifecycle(metadata, files);
            if (lifecycle.ready) {
                try {
                    await this.archiveReader.inspectSource(
                        new PMTilesArchiveSource(
                            this.archiveStore, descriptor.packageId
                        ),
                        { expectedSize: metadata.byteLength }
                    );
                } catch {
                    lifecycle = { ...lifecycle, status: "failed", ready: false,
                        recoverable: false, reason: "archive-invalid" };
                }
            }
            entries.push(this.#entry(
                descriptor, metadata, files, lifecycle, downloadState
            ));
        }
        this.entries = entries;
        return this.list();
    }

    projectDownloadState(downloadState) {
        if (!downloadState?.packageId) return this.list();
        this.entries = this.entries.map(entry => {
            if (entry.packageId !== downloadState.packageId) return entry;
            const status = downloadState.status ?? entry.state;
            const active = ["planned", "downloading", "verifying"]
                .includes(status);
            return copyEntry({
                ...entry,
                state: status,
                downloadedBytes: downloadState.downloadedBytes ??
                    entry.downloadedBytes,
                progressTotalBytes: downloadState.totalBytes ?? entry.byteLength,
                active,
                actions: actionState(status, {
                    installedReady: entry.installedReady,
                    active
                })
            });
        });
        return this.list();
    }

    async getStorageSummary() {
        let installedBytes = 0;
        const packageIds = new Set([
            ...this.metadata.keys(),
            ...this.manifest.packages.map(value => value.packageId)
        ]);
        for (const packageId of packageIds) {
            const files = this.files.get(packageId) ??
                await this.archiveStore.inspectPackageFiles(packageId);
            installedBytes += files.final?.size ?? files.partial?.size ?? 0;
        }
        const storage = await this.archiveStore.getStorageStatus();
        const quota = storage.estimate?.quota;
        const usage = storage.estimate?.usage;
        return Object.freeze({
            installedBytes,
            quota: Number.isFinite(quota) ? quota : null,
            usage: Number.isFinite(usage) ? usage : null,
            availableBytes: Number.isFinite(quota) && Number.isFinite(usage)
                ? Math.max(0, quota - usage) : null,
            persisted: typeof storage.persisted === "boolean"
                ? storage.persisted : null,
            errors: storage.errors
        });
    }

    #entry(descriptor, metadata, files, lifecycle, downloadState) {
        const state = stateFromLifecycle(metadata, lifecycle, descriptor);
        const live = downloadState?.packageId === descriptor.packageId &&
            ["planned", "downloading", "verifying"]
                .includes(downloadState.status)
            ? downloadState : null;
        const projectedState = live?.status ?? state;
        const active = Boolean(live) &&
            ["planned", "downloading", "verifying"]
                .includes(projectedState);
        const installedReady = lifecycle.ready;
        return copyEntry({
            ...descriptor,
            descriptor,
            state: projectedState,
            installedVersion: metadata?.version ?? null,
            installedReady,
            downloadedBytes: live?.downloadedBytes ??
                metadata?.downloadedBytes ?? files.partial?.size ?? 0,
            progressTotalBytes: live?.totalBytes ?? descriptor.byteLength,
            errorMessage: metadata?.errorMessage ?? null,
            active,
            actions: actionState(projectedState, { installedReady, active })
        });
    }
}
