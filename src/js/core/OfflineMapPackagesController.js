/** Connects regional package catalog UI to explicit package lifecycle actions. */
export default class OfflineMapPackagesController {

    constructor({ panel, mapView, eventBus, regionCatalog,
        basemapCatalog, downloadCoordinator, importCoordinator = null,
        fallbackBaseMap = "osm" }) {
        if (!panel || !mapView || !eventBus || !regionCatalog ||
            !basemapCatalog || !downloadCoordinator) {
            throw new TypeError("Offline map package UI dependencies are required.");
        }
        this.panel = panel;
        this.mapView = mapView;
        this.eventBus = eventBus;
        this.regionCatalog = regionCatalog;
        this.basemapCatalog = basemapCatalog;
        this.downloadCoordinator = downloadCoordinator;
        this.importCoordinator = importCoordinator;
        this.fallbackBaseMap = fallbackBaseMap;
        this.attached = false;
        this.activePackageId = null;
        this.unsubscribe = null;
        this.baseMapListenerBound = false;
    }

    async attach() {
        if (this.attached) return this.refresh();
        this.attached = true;
        this.panel.bindPackageActions({
            import: file => void this.importPackage(file),
            download: id => void this.download(id),
            cancel: id => this.cancel(id),
            resume: id => void this.resume(id),
            delete: id => void this.deletePackage(id),
            select: id => void this.selectPackage(id)
        });
        this.unsubscribe = this.downloadCoordinator.subscribe(state => {
            if (!this.attached) return;
            this.activePackageId = ["planned", "downloading", "verifying"]
                .includes(state.status) ? state.packageId : null;
            this.panel.showPackages(
                this.#projectActiveBasemap(
                    this.regionCatalog.projectDownloadState(state)
                )
            );
            if (["ready", "partial", "failed"].includes(state.status)) {
                void this.refresh();
            }
        });
        if (!this.baseMapListenerBound) {
            this.eventBus.on("map:base-map-changed", () => {
                if (this.attached) this.#syncActiveBasemapPresentation();
            });
            this.baseMapListenerBound = true;
        }
        return this.refresh();
    }

    detach() {
        if (!this.attached) return false;
        this.attached = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.panel.bindPackageActions({});
        return true;
    }

    async refresh() {
        try {
            const entries = await this.regionCatalog.refresh({
                downloadState: this.downloadCoordinator.getState()
            });
            const sources = await this.basemapCatalog.refresh();
            const storage = await this.regionCatalog.getStorageSummary();
            this.mapView.setBasemapProviders(this.basemapCatalog);
            this.panel.showPackageStorage(storage);
            this.panel.showPackages(
                this.#projectActiveBasemap(entries),
                storage
            );
            return { entries, sources };
        } catch (error) {
            this.panel.showPackageStatus(error.message, "error");
            return { entries: [], sources: [] };
        }
    }

    async download(identity) {
        if (this.activePackageId) return null;
        const entry = this.regionCatalog.get(identity);
        if (!entry?.actions.download) return null;
        return this.#run(entry.packageId, () =>
            this.downloadCoordinator.startDownload(entry.descriptor)
        );
    }

    async importPackage(file) {
        if (this.activePackageId || !this.importCoordinator) return null;
        if (!file?.name?.toLowerCase().endsWith(".pmtiles")) {
            this.panel.showPackageStatus(
                "Select a .pmtiles file.", "error"
            );
            return null;
        }
        const displayName = file.name.replace(/\.pmtiles$/i, "").trim() ||
            "Imported PMTiles";
        const packageId = this.#localPackageId(file.name);
        const version = `local-${file.size}-${file.lastModified || 0}`;
        this.activePackageId = packageId;
        this.panel.setPackageImportActive(true);
        this.panel.showPackageImportProgress({
            status: "importing", downloadedBytes: 0, totalBytes: file.size
        });
        try {
            const result = await this.importCoordinator.importFile(file, {
                packageId,
                sourceId: displayName,
                version,
                onProgress: progress =>
                    this.panel.showPackageImportProgress(progress)
            });
            this.panel.showPackageStatus(
                `${displayName} imported and ready.`, "ready"
            );
            return result;
        } catch (error) {
            this.panel.showPackageStatus(error.message, "error");
            return null;
        } finally {
            this.activePackageId = null;
            this.panel.setPackageImportActive(false);
            await this.refresh();
        }
    }

    cancel(identity) {
        const entry = this.regionCatalog.get(identity);
        return this.activePackageId === entry?.packageId &&
            this.downloadCoordinator.cancel();
    }

    async resume(identity) {
        if (this.activePackageId) return null;
        const entry = this.regionCatalog.get(identity);
        if (!entry?.actions.resume) return null;
        return this.#run(entry.packageId, () =>
            this.downloadCoordinator.resume(entry.descriptor)
        );
    }

    async deletePackage(identity) {
        if (this.activePackageId) return null;
        const entry = this.regionCatalog.get(identity);
        if (!entry?.actions.delete) return null;
        const packageId = entry.packageId;
        try {
            const activeProvider = this.mapView.getBaseMapProvider?.();
            if (activeProvider?.packageId === packageId) {
                this.eventBus.emit("map:base-map-changed", {
                    baseMap: this.fallbackBaseMap
                });
            }
            const result = await this.downloadCoordinator.deletePackage(
                packageId
            );
            this.panel.showPackageStatus("Offline map package deleted.", "ready");
            await this.refresh();
            return result;
        } catch (error) {
            this.panel.showPackageStatus(error.message, "error");
            return null;
        }
    }

    async selectPackage(identity) {
        const entry = this.regionCatalog.get(identity);
        if (!entry?.actions.select) return false;
        const packageId = entry.packageId;
        await this.basemapCatalog.refresh();
        this.mapView.setBasemapProviders(this.basemapCatalog);
        const source = this.basemapCatalog.list().find(candidate =>
            candidate.sourceType === "pmtiles" &&
            candidate.packageId === packageId
        );
        if (!source) {
            this.panel.showPackageStatus(
                "Offline map package is unavailable.", "error"
            );
            await this.refresh();
            return false;
        }
        this.eventBus.emit("map:base-map-changed", { baseMap: source.id });
        this.panel.showPackageStatus(
            `${entry.displayName} selected as basemap.`, "ready"
        );
        await this.refresh();
        return true;
    }

    async #run(packageId, operation) {
        this.activePackageId = packageId;
        try {
            const result = await operation();
            this.panel.showPackageStatus(
                result.status === "ready"
                    ? "Offline map package is ready."
                    : result.cancelled
                        ? "Download cancelled; partial data was retained."
                        : "Offline map package download is incomplete.",
                result.status === "ready" ? "ready" : "warning"
            );
            return result;
        } catch (error) {
            this.panel.showPackageStatus(error.message, "error");
            return null;
        } finally {
            this.activePackageId = null;
            await this.refresh();
        }
    }

    #syncActiveBasemapPresentation() {
        this.panel.showPackages(
            this.#projectActiveBasemap(this.regionCatalog.list())
        );
    }

    #projectActiveBasemap(entries) {
        const selectedPackageId = this.mapView.getBaseMapProvider?.()
            ?.packageId ?? null;
        return entries.map(entry => {
            const selected = entry.installedReady === true &&
                entry.packageId === selectedPackageId;
            return Object.freeze({
                ...entry,
                selected,
                actions: Object.freeze({
                    ...entry.actions,
                    select: selected ? false : entry.actions?.select === true
                })
            });
        });
    }

    #localPackageId(fileName) {
        const base = fileName.replace(/\.pmtiles$/i, "").toLowerCase();
        const slug = base.normalize("NFKD")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 72) || "pmtiles";
        let hash = 0x811c9dc5;
        for (const byte of new TextEncoder().encode(fileName)) {
            hash ^= byte;
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return `local-${slug}-${hash.toString(16).padStart(8, "0")}`;
    }
}
