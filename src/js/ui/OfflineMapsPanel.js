function formatBytes(value) {
    if (!Number.isFinite(value)) return "—";
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
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
        this.eligible = false;
        this.hasPlan = false;
        this.active = false;
        this.actions = {};
        this.#bindDom();
    }

    bindActions(actions) {
        this.actions = { ...actions };
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
                    <h4>Saved areas</h4>
                    <ul class="offline-area-list"></ul>
                </div>
            </details>
        `;
        return section;
    }
}

export { formatBytes };
