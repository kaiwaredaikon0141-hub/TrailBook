const MOBILE_QUERY = "(max-width: 768px)";

const createState = () => ({
    active: false,
    auth: "—",
    picker: "—",
    scanStarted: false,
    filesListRequests: 0,
    discoveredGpxCount: 0,
    discoveredFolderCount: 0,
    libraryApplyStarted: false,
    treeRenderStarted: false,
    treeFolderCount: 0,
    treeTrackCount: 0,
    lastErrorStage: "—",
    lastErrorMessage: "—"
});

/** Mobile-only, credential-free progress summary for Drive field diagnosis. */
export class MobileDriveDiagnosticPanel {

    constructor({
        documentRef = globalThis.document,
        mobileMedia = globalThis.matchMedia?.(MOBILE_QUERY) ?? null
    } = {}) {

        this.document = documentRef;
        this.mobileMedia = mobileMedia;
        this.state = createState();
        this.element = null;
        this.values = new Map();
        this.mobileMedia?.addEventListener?.("change", () => this.#render());
    }

    beginAttempt() {
        this.state = { ...createState(), active: true };
        this.#render();
    }

    recordAuth(success) {
        this.#set({ auth: success ? "ok" : "fail" });
    }

    recordPicker(success) {
        this.#set({ picker: success ? "ok" : "fail" });
    }

    recordScanStarted() {
        this.#set({ scanStarted: true });
    }

    recordFilesListRequest() {
        this.#set({ filesListRequests: this.state.filesListRequests + 1 });
    }

    recordDiscovered({ folderCount = 0, gpxCount = 0 } = {}) {
        this.#set({
            discoveredFolderCount: Math.max(0, Number(folderCount) || 0),
            discoveredGpxCount: Math.max(0, Number(gpxCount) || 0)
        });
    }

    recordDiscoveryCount(count) {
        this.#set({
            discoveredGpxCount: Math.max(
                this.state.discoveredGpxCount,
                Math.max(0, Number(count) || 0)
            )
        });
    }

    recordLibraryApplyStarted() {
        this.#set({ libraryApplyStarted: true });
    }

    recordTreeRenderStarted() {
        this.#set({ treeRenderStarted: true });
    }

    recordTreeRendered({ folderCount = 0, trackCount = 0 } = {}) {
        this.#set({
            treeFolderCount: Math.max(
                this.state.treeFolderCount,
                Math.max(0, Number(folderCount) || 0)
            ),
            treeTrackCount: Math.max(
                this.state.treeTrackCount,
                Math.max(0, Number(trackCount) || 0)
            )
        });
    }

    recordError(stage, error) {
        const patch = {
            lastErrorStage: this.#sanitize(stage),
            lastErrorMessage: this.#sanitize(error?.message || error)
        };

        if (stage === "authorization") patch.auth = "fail";
        if (stage === "picker") patch.picker = "fail";
        this.#set(patch);
    }

    getState() {
        return { ...this.state };
    }

    #set(patch) {
        if (!this.state.active) return;
        this.state = { ...this.state, ...patch };
        this.#render();
    }

    #render() {
        const element = this.#ensureElement();

        if (!element) return;
        element.hidden = !this.state.active || !this.mobileMedia?.matches;
        const values = {
            auth: this.state.auth,
            picker: this.state.picker,
            scanStarted: this.state.scanStarted,
            filesListRequests: this.state.filesListRequests,
            discoveredGpxCount: this.state.discoveredGpxCount,
            discoveredFolderCount: this.state.discoveredFolderCount,
            libraryApplyStarted: this.state.libraryApplyStarted,
            treeRenderStarted: this.state.treeRenderStarted,
            treeFolderCount: this.state.treeFolderCount,
            treeTrackCount: this.state.treeTrackCount,
            lastErrorStage: this.state.lastErrorStage,
            lastErrorMessage: this.state.lastErrorMessage
        };

        Object.entries(values).forEach(([key, value]) => {
            const target = this.values.get(key);

            if (target) target.textContent = typeof value === "boolean"
                ? (value ? "yes" : "no")
                : String(value);
        });
    }

    #ensureElement() {
        if (this.element || !this.document?.body) return this.element;
        const element = this.document.createElement("details");
        const fields = [
            ["auth", "auth"], ["picker", "picker"],
            ["scanStarted", "scanStarted"],
            ["filesListRequests", "filesListRequests"],
            ["discoveredGpxCount", "discovered GPX count"],
            ["discoveredFolderCount", "discovered folder count"],
            ["libraryApplyStarted", "libraryApplyStarted"],
            ["treeRenderStarted", "treeRenderStarted"],
            ["treeFolderCount", "treeFolderCount"],
            ["treeTrackCount", "treeTrackCount"],
            ["lastErrorStage", "lastError stage"],
            ["lastErrorMessage", "lastError message"]
        ];

        element.className = "mobile-drive-diagnostic";
        element.hidden = true;
        element.innerHTML = "<summary>Drive診断</summary><dl></dl>";
        const list = element.querySelector("dl");

        fields.forEach(([key, label]) => {
            const term = this.document.createElement("dt");
            const value = this.document.createElement("dd");

            term.textContent = label;
            value.dataset.driveDiagnostic = key;
            list.append(term, value);
            this.values.set(key, value);
        });
        this.document.body.append(element);
        this.element = element;
        return element;
    }

    #sanitize(value) {
        return String(value || "—")
            .replace(/https?:\/\/\S+/giu, "[redacted]")
            .replace(/[A-Za-z]:\\[^\s]+/gu, "[redacted]")
            .replace(/(?:[^\s/]+\/)+[^\s/]+/gu, "[redacted]")
            .replace(/[A-Za-z0-9_-]{20,}/gu, "[redacted]")
            .slice(0, 160);
    }
}

export default new MobileDriveDiagnosticPanel();
