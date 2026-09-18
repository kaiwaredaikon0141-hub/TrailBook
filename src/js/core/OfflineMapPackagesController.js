/** Connects regional package catalog UI to explicit package lifecycle actions. */
export default class OfflineMapPackagesController {

    constructor({ panel, mapView, eventBus, regionCatalog,
        basemapCatalog, downloadCoordinator, fallbackBaseMap = "osm" }) {
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
        this.fallbackBaseMap = fallbackBaseMap;
        this.attached = false;
        this.activePackageId = null;
        this.unsubscribe = null;
    }

    async attach() {
        if (this.attached) return this.refresh();
        this.attached = true;
        this.panel.bindPackageActions({
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
                this.regionCatalog.projectDownloadState(state)
            );
            if (["ready", "partial", "failed"].includes(state.status)) {
                void this.refresh();
            }
        });
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
            this.panel.showPackages(entries, storage);
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
}
