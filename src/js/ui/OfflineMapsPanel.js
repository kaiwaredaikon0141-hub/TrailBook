function formatBytes(value) {
    if (!Number.isFinite(value)) return "—";
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    if (value < 1024 ** 4) return `${(value / 1024 ** 3).toFixed(2)} GB`;
    return `${(value / 1024 ** 4).toFixed(2)} TB`;
}

/** Mobile-first presentation for device-local Offline Maps state. */
export default class OfflineMapsPanel {

    constructor(documentTarget = globalThis.document) {
        this.document = documentTarget;
        this.element = this.#create();
        this.disclosure = this.element.querySelector("details");
        this.providerOutput = this.element.querySelector(
            ".offline-maps-provider"
        );
        this.availabilityOutput = this.element.querySelector(
            ".offline-maps-availability"
        );
        this.nameInput = this.element.querySelector(".offline-area-name");
        this.minZoomInput = this.element.querySelector(".offline-min-zoom");
        this.maxZoomInput = this.element.querySelector(".offline-max-zoom");
        this.planButton = this.element.querySelector(".offline-plan");
        this.startButton = this.element.querySelector(".offline-start");
        this.cancelButton = this.element.querySelector(".offline-cancel");
        this.planOutput = this.element.querySelector(".offline-plan-summary");
        this.quotaOutput = this.element.querySelector(".offline-quota");
        this.progress = this.element.querySelector("progress");
        this.progressOutput = this.element.querySelector(
            ".offline-progress-text"
        );
        this.statusOutput = this.element.querySelector(".offline-status");
        this.areaList = this.element.querySelector(".offline-area-list");
        this.packageStorageOutput = this.element.querySelector(
            ".offline-package-storage"
        );
        this.packageStatusOutput = this.element.querySelector(
            ".offline-package-status"
        );
        this.packageImportButton = this.element.querySelector(
            ".offline-package-import"
        );
        this.packageFileInput = this.element.querySelector(
            ".offline-package-file"
        );
        this.packageImportProgress = this.element.querySelector(
            ".offline-package-import-progress"
        );
        this.packageImportOutput = this.element.querySelector(
            ".offline-package-import-text"
        );
        this.packageList = this.element.querySelector(".offline-package-list");
        this.packageStorage = null;
        this.packageBusy = false;
        this.eligible = false;
        this.hasPlan = false;
        this.active = false;
        this.actions = {};
        this.packageActions = {};
        this.packageFileChangeHandler = null;
        this.#bindDom();
    }

    bindActions(actions) {
        this.actions = { ...actions };
    }

    bindPackageActions(actions) {
        this.packageActions = { ...actions };
        const shouldBind = typeof this.packageActions.import === "function";
        if (shouldBind && !this.packageFileChangeHandler) {
            this.packageFileChangeHandler = () => {
                const file = this.packageFileInput.files?.[0] ?? null;
                this.packageFileInput.value = "";
                if (file) this.packageActions.import?.(file);
            };
            this.packageFileInput.addEventListener(
                "change", this.packageFileChangeHandler
            );
        } else if (!shouldBind && this.packageFileChangeHandler) {
            this.packageFileInput.removeEventListener(
                "change", this.packageFileChangeHandler
            );
            this.packageFileChangeHandler = null;
        }
    }

    configureProvider(provider, eligible, currentZoom) {
        this.eligible = Boolean(eligible);
        this.hasPlan = false;
        this.providerOutput.textContent = provider
            ? `${provider.name || provider.id} (${provider.id})`
            : "Unavailable";
        this.availabilityOutput.textContent = this.eligible
            ? "Current provider supports offline area downloads."
            : "Offline download is not available for the current map provider.";
        const min = provider?.minZoom ?? 0;
        const max = provider?.maxZoom ?? min;
        this.minZoomInput.min = String(min);
        this.minZoomInput.max = String(max);
        this.maxZoomInput.min = String(min);
        this.maxZoomInput.max = String(max);
        const zoom = Math.max(min, Math.min(max,
            Number.isFinite(currentZoom) ? Math.round(currentZoom) : min));
        this.minZoomInput.value = String(zoom);
        this.maxZoomInput.value = String(Math.min(max, zoom + 2));
        this.planOutput.textContent = "";
        this.quotaOutput.textContent = "";
        this.#syncButtons();
    }

    setDefaultName(value) {
        if (!this.nameInput.value.trim()) this.nameInput.value = value;
    }

    getPlanValues() {
        return {
            name: this.nameInput.value.trim(),
            minZoom: Number(this.minZoomInput.value),
            maxZoom: Number(this.maxZoomInput.value)
        };
    }

    setZoomRange(minZoom, maxZoom) {
        this.minZoomInput.value = String(minZoom);
        this.maxZoomInput.value = String(maxZoom);
    }

    showPlan(plan) {
        this.hasPlan = true;
        this.planOutput.textContent = `${plan.tileCount} tiles · ${
            formatBytes(plan.estimatedBytes)} · z${plan.minZoom}–${
            plan.maxZoom}`;
        const quota = plan.quota;
        this.quotaOutput.textContent = quota?.available
            ? `Storage estimate: ${formatBytes(quota.availableBytes)} ` +
                `available (advisory)${quota.sufficient ? "" : " — may be insufficient"}`
            : "Storage estimate unavailable (advisory only).";
        this.#syncButtons();
    }

    clearPlan() {
        this.hasPlan = false;
        this.planOutput.textContent = "";
        this.quotaOutput.textContent = "";
        this.#syncButtons();
    }

    setActive(active) {
        this.active = Boolean(active);
        this.#syncButtons();
        for (const button of this.areaList.querySelectorAll("button")) {
            button.disabled = this.active ||
                button.dataset.actionUnavailable === "true";
        }
    }

    showProgress(value) {
        this.progress.max = Math.max(1, value.totalCount || 1);
        this.progress.value = value.completedCount || 0;
        this.progressOutput.textContent = `${value.completedCount || 0} / ${
            value.totalCount || 0} tiles · ${value.failedCount || 0} failed · ${
            formatBytes(value.storedBytes || 0)} · ${value.status}`;
    }

    showStatus(message, state = "") {
        this.statusOutput.textContent = message;
        this.statusOutput.dataset.state = state;
    }

    showAreas(areas) {
        this.areaList.replaceChildren();
        if (!areas.length) {
            const empty = this.document.createElement("li");
            empty.textContent = "No saved areas.";
            this.areaList.append(empty);
            return;
        }
        for (const area of areas) {
            const item = this.document.createElement("li");
            const summary = this.document.createElement("div");
            const actions = this.document.createElement("div");
            const resume = this.document.createElement("button");
            const remove = this.document.createElement("button");

            item.className = "offline-area-item";
            summary.className = "offline-area-summary";
            actions.className = "offline-area-actions";
            summary.textContent = `${area.name} · ${area.providerId} · z${
                area.minZoom}–${area.maxZoom} · ${area.status} · ${
                area.storedTileCount}/${area.plannedTileCount} · ${
                formatBytes(area.storedBytes)}`;
            resume.type = "button";
            resume.textContent = "Resume";
            resume.dataset.actionUnavailable = String(
                area.status === "complete" || area.resumeAllowed !== true
            );
            resume.disabled = this.active || area.status === "complete" ||
                area.resumeAllowed !== true;
            resume.addEventListener("click", () => this.actions.resume?.(area.id));
            remove.type = "button";
            remove.textContent = "Delete";
            remove.dataset.actionUnavailable = "false";
            remove.disabled = this.active;
            remove.addEventListener("click", () => this.actions.delete?.(area.id));
            actions.append(resume, remove);
            item.append(summary, actions);
            this.areaList.append(item);
        }
    }

    showPackageStorage(storage) {
        this.packageStorage = storage;
        const capacity = storage.availableBytes === null
            ? "Storage estimate unavailable"
            : `${formatBytes(storage.availableBytes)} available`;
        const persistence = storage.persisted === true
            ? "persistent storage" : storage.persisted === false
                ? "best-effort storage" : "persistence unknown";
        this.packageStorageOutput.textContent =
            `${formatBytes(storage.installedBytes)} installed · ${capacity} · ` +
            persistence;
    }

    showPackageStatus(message, state = "") {
        this.packageStatusOutput.textContent = message;
        this.packageStatusOutput.dataset.state = state;
    }

    setPackageImportActive(active) {
        this.packageBusy = Boolean(active);
        this.packageFileInput.disabled = this.packageBusy;
        this.packageImportButton.classList.toggle(
            "is-disabled", this.packageBusy
        );
        this.packageImportButton.setAttribute(
            "aria-disabled", String(this.packageBusy)
        );
        for (const button of this.packageList.querySelectorAll("button")) {
            button.disabled = this.packageBusy ||
                button.dataset.actionAvailable !== "true";
        }
    }

    showPackageImportProgress(value = null) {
        const visible = Boolean(value);
        this.packageImportProgress.hidden = !visible;
        this.packageImportOutput.textContent = "";
        if (!visible) return;
        const total = Math.max(1, value.totalBytes || 1);
        const current = Math.min(total, value.downloadedBytes || 0);
        const percent = Math.floor(current / total * 100);
        this.packageImportProgress.max = total;
        this.packageImportProgress.value = current;
        this.packageImportOutput.textContent = `${value.status === "ready"
            ? "Imported" : value.status === "verifying"
                ? "Validating…" : "Importing…"} ${formatBytes(current)} / ${
            formatBytes(value.totalBytes || 0)} · ${percent}%`;
    }

    showPackages(packages, storage = this.packageStorage) {
        this.packageList.replaceChildren();
        if (!packages.length) {
            const empty = this.document.createElement("li");
            empty.textContent = "No offline map packages are configured.";
            this.packageList.append(empty);
            return;
        }
        for (const value of packages) {
            const item = this.document.createElement("li");
            const title = this.document.createElement("strong");
            const description = this.document.createElement("p");
            const details = this.document.createElement("p");
            const progress = this.document.createElement("progress");
            const actions = this.document.createElement("div");

            item.className = "offline-package-item";
            item.dataset.packageId = value.packageId;
            item.dataset.packageIdentity = value.identity;
            item.dataset.state = value.state;
            title.textContent = value.displayName;
            description.textContent = value.description || value.region;
            details.className = "offline-package-details";
            details.textContent = `${value.region} · ${formatBytes(
                value.byteLength)} · z${value.minZoom}–${value.maxZoom} · ${
                value.state}`;
            if (Number.isFinite(storage?.availableBytes) &&
                value.byteLength > storage.availableBytes) {
                details.textContent += " · may exceed available storage";
            }
            if (value.errorMessage) {
                details.textContent += ` · ${value.errorMessage}`;
            }
            progress.max = Math.max(1, value.progressTotalBytes ||
                value.byteLength);
            progress.value = Math.min(progress.max,
                value.downloadedBytes || 0);
            progress.hidden = !value.active && value.state !== "partial";
            progress.setAttribute("aria-label",
                `${value.displayName} download progress`);
            actions.className = "offline-package-actions";

            const definitions = [
                ["download", "Download"],
                ["cancel", "Cancel"],
                ["resume", "Resume"],
                ["delete", "Delete"],
                ["select", "Select"]
            ];
            for (const [action, label] of definitions) {
                const button = this.document.createElement("button");
                button.type = "button";
                button.dataset.packageAction = action;
                button.dataset.actionAvailable = String(
                    value.actions?.[action] === true
                );
                button.textContent = label;
                button.disabled = this.packageBusy ||
                    value.actions?.[action] !== true;
                button.setAttribute("aria-label", `${label} ${value.displayName}`);
                button.addEventListener("click", () =>
                    this.packageActions[action]?.(value.identity)
                );
                actions.append(button);
            }

            item.append(title, description, details, progress, actions);
            this.packageList.append(item);
        }
    }

    #syncButtons() {
        this.planButton.disabled = !this.eligible || this.active;
        this.startButton.disabled = !this.eligible || !this.hasPlan ||
            this.active;
        this.cancelButton.disabled = !this.active;
        this.nameInput.disabled = this.active;
        this.minZoomInput.disabled = !this.eligible || this.active;
        this.maxZoomInput.disabled = !this.eligible || this.active;
    }

    #bindDom() {
        this.planButton.addEventListener("click", () => this.actions.plan?.());
        this.startButton.addEventListener("click", () => this.actions.start?.());
        this.cancelButton.addEventListener("click", () => this.actions.cancel?.());
    }

    #create() {
        const section = this.document.createElement("section");
        section.className = "offline-maps-panel";
        section.innerHTML = `
            <details class="offline-maps-disclosure">
                <summary>Offline Maps</summary>
                <div class="offline-maps-content">
                    <p class="offline-provider-row">Provider:
                        <strong class="offline-maps-provider"></strong>
                    </p>
                    <p class="offline-maps-availability"></p>
                    <label>Area name
                        <input class="offline-area-name" type="text"
                            maxlength="80" autocomplete="off">
                    </label>
                    <div class="offline-zoom-range">
                        <label>Min zoom
                            <input class="offline-min-zoom" type="number" step="1">
                        </label>
                        <label>Max zoom
                            <input class="offline-max-zoom" type="number" step="1">
                        </label>
                    </div>
                    <div class="offline-primary-actions">
                        <button class="offline-plan" type="button">Plan current view</button>
                        <button class="offline-start" type="button">Start download</button>
                        <button class="offline-cancel" type="button">Cancel</button>
                    </div>
                    <p class="offline-plan-summary"></p>
                    <p class="offline-quota"></p>
                    <progress value="0" max="1"></progress>
                    <p class="offline-progress-text"></p>
                    <p class="offline-status" role="status" aria-live="polite"></p>
                    <h4>Cached Areas</h4>
                    <ul class="offline-area-list"></ul>
                    <h4>Offline Map Packages</h4>
                    <div class="offline-package-import-actions">
                        <span class="offline-package-import-label">
                            Import PMTiles
                        </span>
                        <input class="offline-package-import offline-package-file"
                            type="file"
                            accept=".pmtiles,application/vnd.pmtiles"
                            aria-label="Import PMTiles">
                    </div>
                    <progress class="offline-package-import-progress"
                        value="0" max="1" hidden></progress>
                    <p class="offline-package-import-text"></p>
                    <p class="offline-package-storage"></p>
                    <p class="offline-package-status" role="status"
                        aria-live="polite"></p>
                    <ul class="offline-package-list"></ul>
                </div>
            </details>
        `;
        return section;
    }
}

export { formatBytes };
