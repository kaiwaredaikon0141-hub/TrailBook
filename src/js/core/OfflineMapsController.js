/** Connects Offline Maps UI actions to map, download, and storage services. */
export default class OfflineMapsController {

    constructor({
        panel,
        mapView,
        providerRegistry,
        repository,
        downloadCoordinator,
        eventBus = null,
        now = () => Date.now()
    }) {
        this.panel = panel;
        this.mapView = mapView;
        this.providerRegistry = providerRegistry;
        this.repository = repository;
        this.downloadCoordinator = downloadCoordinator;
        this.eventBus = eventBus;
        this.now = now;
        this.plan = null;
        this.active = false;
        this.sequence = 0;
        this.attached = false;
        this.unsubscribeProgress = null;
        this.baseMapListenerBound = false;
    }

    attach() {
        if (this.attached) return this.refreshAreas();
        this.attached = true;
        this.panel.bindActions({
            plan: () => void this.planCurrentView(),
            start: () => void this.start(),
            cancel: () => this.cancel(),
            resume: id => void this.resume(id),
            delete: id => void this.deleteArea(id)
        });
        this.unsubscribeProgress = this.downloadCoordinator.subscribe(progress =>
            this.panel.showProgress(progress)
        );
        if (!this.baseMapListenerBound && this.eventBus) {
            this.eventBus.on("map:base-map-changed", () => {
                if (this.attached) this.syncProvider();
            });
            this.baseMapListenerBound = true;
        }
        this.panel.setDefaultName(this.#defaultName());
        this.syncProvider();
        return this.refreshAreas();
    }

    detach() {
        if (!this.attached) return false;
        this.attached = false;
        this.unsubscribeProgress?.();
        this.unsubscribeProgress = null;
        this.panel.bindActions({});
        return true;
    }

    syncProvider() {
        const baseMap = this.mapView.getBaseMap();
        const provider = this.mapView.getBaseMapProvider?.() ??
            this.providerRegistry.get(baseMap);
        const downloadProvider = this.providerRegistry.get(baseMap);
        const eligible = Boolean(downloadProvider) &&
            this.providerRegistry.canDownloadOffline(downloadProvider.id) &&
            downloadProvider.offlineDownloadAllowed === true;
        this.plan = null;
        this.panel.clearPlan();
        this.panel.configureProvider(provider, eligible, this.mapView.getZoom());
    }

    async planCurrentView() {
        if (this.active) return null;
        const provider = this.providerRegistry.get(this.mapView.getBaseMap());
        if (!provider || !this.providerRegistry.canDownloadOffline(provider.id)) {
            this.panel.showStatus(
                "Offline download is unavailable for this provider.", "error"
            );
            return null;
        }
        const bounds = this.mapView.getCurrentBounds();
        if (!bounds) {
            this.panel.showStatus("Current map bounds are unavailable.", "error");
            return null;
        }
        const values = this.panel.getPlanValues();
        const minZoom = Math.max(provider.minZoom,
            Math.min(provider.maxZoom, Math.trunc(values.minZoom)));
        const maxZoom = Math.max(provider.minZoom,
            Math.min(provider.maxZoom, Math.trunc(values.maxZoom)));
        if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom) ||
            minZoom > maxZoom) {
            this.panel.showStatus("Choose a valid zoom range.", "error");
            return null;
        }
        this.panel.setZoomRange(minZoom, maxZoom);
        const name = values.name || this.#defaultName();
        this.panel.setDefaultName(name);

        try {
            this.plan = await this.downloadCoordinator.planDownload({
                id: `offline-${this.now()}-${++this.sequence}`,
                name,
                providerId: provider.id,
                bbox: bounds,
                minZoom,
                maxZoom
            });
            this.panel.showPlan(this.plan);
            this.panel.showStatus("Download plan ready.", "ready");
            return this.plan;
        } catch (error) {
            this.plan = null;
            this.panel.clearPlan();
            this.panel.showStatus(error.message, "error");
            return null;
        }
    }

    async start() {
        if (!this.plan || this.active) return null;
        return this.#run(() => this.downloadCoordinator.startDownload(
            this.plan
        ));
    }

    cancel() {
        return this.active && this.downloadCoordinator.cancel();
    }

    async resume(areaId) {
        if (this.active) return null;
        return this.#run(() => this.downloadCoordinator.resume(areaId));
    }

    async deleteArea(areaId) {
        if (this.active) return null;
        try {
            const result = await this.repository.deleteArea(areaId);
            this.panel.showStatus(result.deleted
                ? "Offline area deleted."
                : "Offline area was already absent.", "ready");
            await this.refreshAreas();
            return result;
        } catch (error) {
            this.panel.showStatus(error.message, "error");
            return null;
        }
    }

    async refreshAreas() {
        try {
            const areas = await this.repository.listAreas();
            areas.sort((left, right) => right.createdAt - left.createdAt);
            this.panel.showAreas(areas.map(area => ({
                ...area,
                resumeAllowed: area.status !== "complete" &&
                    this.providerRegistry.canDownloadOffline(area.providerId)
            })));
            return areas;
        } catch (error) {
            this.panel.showStatus(error.message, "error");
            return [];
        }
    }

    async #run(operation) {
        this.active = true;
        this.panel.setActive(true);
        try {
            const result = await operation();
            this.panel.showStatus(result.status === "complete"
                ? "Offline area is ready."
                : result.cancelled
                    ? "Download cancelled; saved progress was retained."
                    : "Download is partial and can be resumed.",
            result.status === "complete" ? "ready" : "warning");
            await this.refreshAreas();
            return result;
        } catch (error) {
            this.panel.showStatus(error.message, "error");
            await this.refreshAreas();
            return null;
        } finally {
            this.active = false;
            this.panel.setActive(false);
        }
    }

    #defaultName() {
        return `Map area ${new Date(this.now()).toLocaleString()}`;
    }
}
