import TrackEditingMetricsFormatter, {
    EMPTY_VALUE
} from "./TrackEditingMetricsFormatter.js";

/**
 * Presents Editor controls without owning editing state.
 */
export default class TrackEditingPanel {

    constructor({
        defaultToleranceMeters = 10,
        formatter = new TrackEditingMetricsFormatter()
    } = {}) {

        this.handlers = new Map();
        this.formatter = formatter;
        this.element = this.#create(defaultToleranceMeters);
        this.body = this.element.querySelector(".track-editor-body");
        this.editButton = this.element.querySelector("[data-editor-action='edit']");
        this.toleranceInput = this.element.querySelector(".editor-tolerance");
        this.backupStatus = this.element.querySelector(".editor-backup-status");
        this.progress = this.element.querySelector(".editor-progress");
        this.status = this.element.querySelector(".editor-status");
        this.draftStatus = this.element.querySelector(".editor-draft-status");
        this.target = this.element.querySelector(".editor-target");
        this.selectedPath = null;
        this.draftPath = null;
        this.canSerialize = false;
        this.saveEnabled = false;
        this.historyState = { canUndo: false, canRedo: false };
        this.metrics = new Map(
            [...this.element.querySelectorAll("[data-editor-metric]")]
                .map(node => [node.dataset.editorMetric, node])
        );
        this.actionButtons = new Map(
            [...this.element.querySelectorAll("[data-editor-action]")]
                .map(node => [node.dataset.editorAction, node])
        );
        this.#bind();
        this.setSelectedTrack(null);
        this.showInactive();
    }

    on(action, handler) {

        this.handlers.set(action, handler);
    }

    attach(container) {

        container.append(this.element);
    }

    setSelectedTrack(path) {

        this.selectedPath = path || null;
        this.editButton.disabled = !path;
        this.editButton.textContent = path && path === this.draftPath
            ? "編集を再開"
            : "編集";
        this.editButton.title = path
            ? `${path} を編集`
            : "編集するTrackを選択してください";
    }

    getTolerance() {

        return Number(this.toleranceInput.value);
    }

    getMode() {

        return this.element.querySelector("[name='editor-preview-mode']:checked")
            ?.value || "both";
    }

    getPointMode() {

        return this.element.querySelector("[name='editor-point-mode']:checked")
            ?.value || "off";
    }

    getSaveButton() {

        return this.actionButtons.get("save");
    }

    configureSave({ canSerialize = false, backupExists = null } = {}) {

        this.canSerialize = Boolean(canSerialize);
        this.backupStatus.textContent = backupExists === true
            ? "初回原本Backupは作成済みです。"
            : backupExists === false
                ? "初回保存では原本をTrailBook_Backupへ保存してから編集結果を保存します。"
                : "保存時にTrailBook_Backupの状態を再確認します。";
        this.setSaveEnabled(false);
    }

    setSaveEnabled(enabled) {

        this.saveEnabled = Boolean(enabled) && this.canSerialize;
        this.actionButtons.get("save").disabled = !this.saveEnabled;
    }

    showLoading(path) {

        this.body.hidden = false;
        this.editButton.disabled = true;
        this.target.textContent = path;
        this.#setControlsDisabled(true);
        this.#setStatus("Source GPXを読み込み中…", "loading");
        this.#setProgress(null);
        this.#clearMetrics();
    }

    showReady({ canSerialize = true } = {}) {

        this.body.hidden = false;
        this.canSerialize = Boolean(canSerialize);
        this.#setControlsDisabled(false);
        this.actionButtons.get("apply").disabled = true;
        this.setSaveEnabled(this.saveEnabled);
        this.#setStatus(
            canSerialize
                ? "Toleranceを変更してpreviewを確認してください。"
                : "Preview可能ですが、このsourceは保存不可です。",
            canSerialize ? "ready" : "warning"
        );
    }

    showPreviewing({ processedSegments = 0, totalSegments = 0 } = {}) {

        this.actionButtons.get("apply").disabled = true;
        this.actionButtons.get("save").disabled = true;
        this.#setStatus(
            `Preview計算中… ${processedSegments}/${totalSegments}`,
            "loading"
        );
        this.#setProgress({ processedSegments, totalSegments });
    }

    showPreview(metrics) {

        this.#setProgress(null);
        this.#setStatus("Previewを更新しました。", "ready");
        this.actionButtons.get("apply").disabled = false;
        this.setSaveEnabled(this.saveEnabled);
        this.#showMetrics(metrics);
    }

    showApplied(metrics, { canUndo, canRedo }) {

        this.#setProgress(null);
        this.#setStatus("Working copyへ適用しました。", "ready");
        this.actionButtons.get("apply").disabled = true;
        this.setSaveEnabled(true);
        this.#showMetrics(metrics);
        this.setHistoryState({ canUndo, canRedo });
    }

    showError(message = "Previewを作成できませんでした。") {

        this.#setProgress(null);
        this.#setStatus(message, "error");
        this.actionButtons.get("apply").disabled = true;
    }

    showSaving(fileName, { backupExists = false } = {}) {

        this.#setControlsDisabled(true, { allowCancel: false });
        this.#setStatus(
            backupExists
                ? `Backup済み。${fileName}へ編集結果を保存中…`
                : `原本をBackup後、${fileName}へ編集結果を保存中…`,
            "loading"
        );
    }

    showSaveSuccess(fileName, {
        refreshSucceeded = true,
        backupCreated = false
    } = {}) {

        this.#restoreAfterSave();
        this.backupStatus.textContent = backupCreated
            ? "原本をTrailBook_Backupへ保存済みです。"
            : "初回原本Backupを維持しています。";
        this.#setStatus(
            refreshSucceeded
                ? `保存・検証完了: ${fileName}`
                : `保存・検証完了: ${fileName}。Libraryを再選択してください。`,
            refreshSucceeded ? "saved" : "warning"
        );
    }

    showSaveError(message) {

        this.#restoreAfterSave();
        this.#setStatus(message, "error");
    }

    showSaveCancelled() {

        this.#setStatus("保存をCancelしました。working draftは維持されています。", "ready");
    }

    setHistoryState({ canUndo, canRedo }) {

        this.historyState = {
            canUndo: Boolean(canUndo),
            canRedo: Boolean(canRedo)
        };
        this.actionButtons.get("undo").disabled = !canUndo;
        this.actionButtons.get("redo").disabled = !canRedo;
    }

    showInactive() {

        this.body.hidden = true;
        this.target.textContent = EMPTY_VALUE;
        this.#setProgress(null);
        this.#clearMetrics();
        this.setSelectedTrack(this.selectedPath);
    }

    showDraft(path, { saved = false } = {}) {

        this.draftPath = path;
        this.selectedPath = path;
        this.draftStatus.textContent = saved
            ? "保存済みのworking resultをsession memoryに保持しています。"
            : "未保存のworking resultをsession memoryに保持しています。";
        this.showInactive();
        this.setSelectedTrack(path);
    }

    clearDraft() {

        this.draftPath = null;
        this.draftStatus.textContent = "";
        this.setSelectedTrack(this.selectedPath);
    }

    focusEditButton() {

        this.editButton.focus({ preventScroll: true });
    }

    #create(defaultToleranceMeters) {

        const section = document.createElement("section");

        section.className = "track-editor";
        section.setAttribute("aria-labelledby", "track-editor-title");
        section.innerHTML = `
            <div class="track-editor-launch">
                <strong id="track-editor-title">Track Editor</strong>
                <button type="button" data-editor-action="edit">編集</button>
            </div>
            <span class="editor-draft-status" role="status"
                aria-live="polite"></span>
            <div class="track-editor-body" hidden>
                <p class="editor-target"></p>
                <label>
                    Tolerance
                    <input class="editor-tolerance" type="number"
                        min="0.1" max="100000" step="0.1"
                        value="${defaultToleranceMeters}" inputmode="decimal">
                    m
                </label>
                <fieldset class="editor-preview-modes">
                    <legend>Map preview</legend>
                    <label><input type="radio" name="editor-preview-mode"
                        value="before"> Before</label>
                    <label><input type="radio" name="editor-preview-mode"
                        value="after"> After</label>
                    <label><input type="radio" name="editor-preview-mode"
                        value="both" checked> Both</label>
                </fieldset>
                <fieldset class="editor-point-modes">
                    <legend>Point preview</legend>
                    <label><input type="radio" name="editor-point-mode"
                        value="off" checked> Off</label>
                    <label><input type="radio" name="editor-point-mode"
                        value="before"> Before</label>
                    <label><input type="radio" name="editor-point-mode"
                        value="after"> After</label>
                    <label><input type="radio" name="editor-point-mode"
                        value="both"> Both</label>
                </fieldset>
                <div class="editor-legend" aria-label="Preview layer legend">
                    <span class="editor-legend-before">Before: dashed</span>
                    <span class="editor-legend-after">After: solid</span>
                </div>
                <progress class="editor-progress" aria-label="Preview progress"
                    hidden></progress>
                <p class="editor-status" role="status" aria-live="polite"></p>
                <dl class="editor-metrics">
                    <dt>Point</dt><dd data-editor-metric="points"></dd>
                    <dt>削減率</dt><dd data-editor-metric="reduction"></dd>
                    <dt>Source距離</dt><dd data-editor-metric="sourceDistance"></dd>
                    <dt>Simplified距離</dt><dd data-editor-metric="simplifiedDistance"></dd>
                    <dt>距離差</dt><dd data-editor-metric="distanceDifference"></dd>
                    <dt>最大形状差</dt><dd data-editor-metric="maxDeviation"></dd>
                </dl>
                <p class="editor-backup-status"></p>
                <div class="editor-actions">
                    <button type="button" data-editor-action="apply">Apply</button>
                    <button type="button" data-editor-action="undo">Undo</button>
                    <button type="button" data-editor-action="redo">Redo</button>
                    <button type="button" data-editor-action="save">
                        保存
                    </button>
                    <button type="button" data-editor-action="done">
                        Done / 編集終了
                    </button>
                    <button type="button" data-editor-action="cancel">
                        Cancel / 破棄
                    </button>
                </div>
            </div>
        `;

        return section;
    }

    #bind() {

        this.element.addEventListener("click", event => {
            const action = event.target.closest("[data-editor-action]")
                ?.dataset.editorAction;

            if (action) {
                this.#emit(action);
            }
        });
        this.toleranceInput.addEventListener("input", () => {
            this.#emit("tolerance", this.getTolerance());
        });
        this.element.addEventListener("change", event => {
            if (event.target.name === "editor-preview-mode") {
                this.#emit("mode", event.target.value);
            } else if (event.target.name === "editor-point-mode") {
                this.#emit("point-mode", event.target.value);
            }
        });
        this.element.addEventListener("keydown", event => {
            if (event.target.matches("input, select, textarea")) return;

            if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z") {
                event.preventDefault();
                this.#emit("undo");
            } else if (event.ctrlKey && event.key.toLowerCase() === "y") {
                event.preventDefault();
                this.#emit("redo");
            } else if (event.key === "Escape" && !this.body.hidden) {
                event.preventDefault();
                this.#emit("cancel");
            }
        });
    }

    #emit(action, value) {

        this.handlers.get(action)?.(value);
    }

    #setControlsDisabled(disabled, { allowCancel = true } = {}) {

        this.body.querySelectorAll("input, button").forEach(control => {
            control.disabled = disabled;
        });
        if (allowCancel) this.actionButtons.get("cancel").disabled = false;
    }

    #restoreAfterSave() {

        this.#setControlsDisabled(false);
        this.actionButtons.get("apply").disabled = true;
        this.setHistoryState(this.historyState);
        this.setSaveEnabled(this.saveEnabled);
    }

    #setProgress(value) {

        if (!value) {
            this.progress.hidden = true;
            this.progress.removeAttribute("value");
            this.progress.removeAttribute("max");
            return;
        }

        this.progress.hidden = false;
        this.progress.max = Math.max(1, value.totalSegments);
        this.progress.value = value.processedSegments;
    }

    #setStatus(message, state) {

        this.status.textContent = message;
        this.status.dataset.state = state;
    }

    #showMetrics(metrics) {

        Object.entries(this.formatter.format(metrics)).forEach(
            ([name, value]) => this.#setMetric(name, value)
        );
    }

    #clearMetrics() {

        this.metrics.forEach(node => { node.textContent = EMPTY_VALUE; });
        this.setHistoryState({ canUndo: false, canRedo: false });
    }

    #setMetric(name, value) {

        const node = this.metrics.get(name);
        if (node) node.textContent = value;
    }

}
