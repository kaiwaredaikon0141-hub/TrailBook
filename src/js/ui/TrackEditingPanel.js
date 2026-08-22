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
        this.dateInput = this.element.querySelector(".editor-start-date");
        this.currentStartTime = this.element.querySelector(".editor-current-start");
        this.dateStatus = this.element.querySelector(".editor-date-status");
        this.currentFileName = this.element.querySelector(".editor-current-filename");
        this.candidateFileName = this.element.querySelector(".editor-candidate-filename");
        this.renameCheckbox = this.element.querySelector(".editor-rename-by-date");
        this.renameStatus = this.element.querySelector(".editor-rename-status");
        this.translationMode = this.element.querySelector(
            ".editor-translation-mode"
        );
        this.translationNorth = this.element.querySelector(
            ".editor-translation-north"
        );
        this.translationEast = this.element.querySelector(
            ".editor-translation-east"
        );
        this.pointEditingMode = this.element.querySelector(
            ".editor-point-editing-mode"
        );
        this.pointEditingStatus = this.element.querySelector(
            ".editor-point-editing-status"
        );
        this.backupStatus = this.element.querySelector(".editor-backup-status");
        this.progress = this.element.querySelector(".editor-progress");
        this.status = this.element.querySelector(".editor-status");
        this.draftStatus = this.element.querySelector(".editor-draft-status");
        this.target = this.element.querySelector(".editor-target");
        this.selectedPath = null;
        this.draftPath = null;
        this.canSerialize = false;
        this.saveEnabled = false;
        this.dateCorrectionEnabled = false;
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

    setMode(mode) {

        const input = this.element.querySelector(
            `[name='editor-preview-mode'][value='${mode}']`
        );

        if (!input) return false;
        input.checked = true;
        return true;
    }

    setModeDisabled(disabled) {

        this.element.querySelectorAll("[name='editor-preview-mode']")
            .forEach(input => { input.disabled = Boolean(disabled); });
    }

    isModeDisabled() {

        return [...this.element.querySelectorAll("[name='editor-preview-mode']")]
            .every(input => input.disabled);
    }

    getPointMode() {

        return this.element.querySelector("[name='editor-point-mode']:checked")
            ?.value || "off";
    }

    getTranslationMode() {

        return Boolean(this.translationMode.checked);
    }

    getPointEditingMode() {

        return Boolean(this.pointEditingMode.checked);
    }

    getPointAddMode() {

        return this.actionButtons.get("point-add-mode")
            ?.getAttribute("aria-pressed") === "true";
    }

    setPointEditingMode(enabled) {

        this.pointEditingMode.checked = Boolean(enabled);
    }

    setPointAddMode(enabled) {

        const button = this.actionButtons.get("point-add-mode");

        button?.setAttribute("aria-pressed", String(Boolean(enabled)));
    }

    setTranslationMode(enabled) {

        this.translationMode.checked = Boolean(enabled);
    }

    configurePointEditing({
        enabled = false,
        selected = null,
        canDelete = false,
        addMode = this.getPointAddMode()
    } = {}) {

        this.pointEditingMode.checked = Boolean(enabled);
        this.pointEditingStatus.textContent = selected
            ? selected.addedPointId
                ? `追加point選択中 (${selected.addedPointId})`
                : `既存point選択中: Track ${selected.trackIndex + 1}, Segment ${selected.segmentIndex + 1}, Point ${selected.pointIndex + 1}`
            : enabled ? "ポイント未選択" : "";
        this.actionButtons.get("point-selection-clear").disabled = !selected;
        this.actionButtons.get("point-delete").disabled = !selected || !canDelete;
        this.actionButtons.get("point-add-mode").disabled = !enabled;
        this.setPointAddMode(enabled && addMode);
    }

    configureTranslation({
        northMeters = 0,
        eastMeters = 0,
        pending = false,
        canApply = pending
    } = {}) {

        this.translationNorth.textContent = this.#formatDirection(
            northMeters,
            "北",
            "南"
        );
        this.translationEast.textContent = this.#formatDirection(
            eastMeters,
            "東",
            "西"
        );
        this.actionButtons.get("apply").disabled = !canApply;
    }

    getSaveButton() {

        return this.actionButtons.get("save");
    }

    isDateRenameEnabled() {

        return this.renameCheckbox.checked && !this.renameCheckbox.disabled;
    }

    configureFileName({
        currentFileName,
        candidateFileName = null,
        renameEnabled = false,
        defaultRename = false
    } = {}) {

        this.currentFileName.textContent = currentFileName || "—";
        this.candidateFileName.textContent = candidateFileName || "—";
        this.renameCheckbox.disabled = !renameEnabled;
        this.renameCheckbox.checked = renameEnabled && Boolean(defaultRename);
        this.renameStatus.textContent = renameEnabled
            ? ""
            : "有効なTrack Point timeがないためfilenameを変更できません。";
    }

    updateFileNameCandidate(candidateFileName, checked) {

        this.candidateFileName.textContent = candidateFileName || "—";
        this.renameCheckbox.disabled = !candidateFileName;
        this.renameCheckbox.checked = Boolean(candidateFileName && checked);
        this.renameStatus.textContent = candidateFileName
            ? ""
            : "有効なTrack Point timeがないためfilenameを変更できません。";
    }

    configureDateCorrection({ sourceStartTime = null, timeOffsetMs = 0 } = {}) {

        const available = sourceStartTime instanceof Date &&
            Number.isFinite(sourceStartTime.getTime());

        this.dateCorrectionEnabled = available;

        if (!available) {
            this.currentStartTime.textContent = "—";
            this.dateInput.value = "";
            this.dateInput.disabled = true;
            this.actionButtons.get("date-apply").disabled = true;
            this.dateStatus.textContent =
                "有効なTrack Point timeがないため日付を修正できません。";
            return;
        }

        const current = new Date(sourceStartTime.getTime() + timeOffsetMs);

        this.currentStartTime.textContent = current.toLocaleString();
        this.dateInput.value = this.#formatLocalDate(current);
        this.dateInput.disabled = false;
        this.actionButtons.get("date-apply").disabled = false;
        this.dateStatus.textContent = "";
    }

    showDateError(message) {

        this.dateStatus.textContent = message;
    }

    showDateMessage(message) {

        this.dateStatus.textContent = message;
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
        backupCreated = false,
        cleanupWarning = false
    } = {}) {

        this.#restoreAfterSave();
        this.backupStatus.textContent = backupCreated
            ? "原本をTrailBook_Backupへ保存済みです。"
            : "初回原本Backupを維持しています。";
        this.#setStatus(
            cleanupWarning
                ? `保存・検証完了: ${fileName}。旧sourceを削除できず重複fileが残っています。`
                : refreshSucceeded
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
                <fieldset class="editor-date-correction">
                    <legend>日付修正</legend>
                    <p>現在の開始日時: <span class="editor-current-start">—</span></p>
                    <label>
                        新しい開始日
                        <input class="editor-start-date" type="date">
                    </label>
                    <button type="button" data-editor-action="date-apply">
                        日付を適用
                    </button>
                    <span class="editor-date-status" role="status"
                        aria-live="polite"></span>
                </fieldset>
                <fieldset class="editor-filename">
                    <legend>Filename</legend>
                    <p>現在: <span class="editor-current-filename">—</span></p>
                    <p>日付候補: <span class="editor-candidate-filename">—</span></p>
                    <label>
                        <input class="editor-rename-by-date" type="checkbox">
                        ファイル名を日付形式に変更
                    </label>
                    <span class="editor-rename-status" role="status"
                        aria-live="polite"></span>
                </fieldset>
                <fieldset class="editor-simplification">
                    <legend>トラック簡略化</legend>
                    <label>
                        Tolerance
                        <input class="editor-tolerance" type="number"
                            min="0.1" max="100000" step="0.1"
                            value="${defaultToleranceMeters}" inputmode="decimal">
                        m
                    </label>
                    <div class="editor-preview-modes" role="group"
                        aria-label="Map preview">
                        <strong>Map preview</strong>
                        <label><input type="radio" name="editor-preview-mode"
                            value="before"> Before</label>
                        <label><input type="radio" name="editor-preview-mode"
                            value="after"> After</label>
                        <label><input type="radio" name="editor-preview-mode"
                            value="both" checked> Both</label>
                    </div>
                    <div class="editor-point-modes" role="group"
                        aria-label="簡略化ポイント表示">
                        <strong>簡略化ポイント表示</strong>
                        <label><input type="radio" name="editor-point-mode"
                            value="off" checked> Off</label>
                        <label><input type="radio" name="editor-point-mode"
                            value="before"> Before</label>
                        <label><input type="radio" name="editor-point-mode"
                            value="after"> After</label>
                        <label><input type="radio" name="editor-point-mode"
                            value="both"> Both</label>
                    </div>
                    <div class="editor-legend" aria-label="Preview layer legend">
                        <span class="editor-legend-before">Before: dashed</span>
                        <span class="editor-legend-after">After: solid</span>
                    </div>
                    <dl class="editor-metrics">
                        <dt>Point</dt><dd data-editor-metric="points"></dd>
                        <dt>削減率</dt><dd data-editor-metric="reduction"></dd>
                        <dt>Source距離</dt><dd data-editor-metric="sourceDistance"></dd>
                        <dt>Simplified距離</dt><dd data-editor-metric="simplifiedDistance"></dd>
                        <dt>距離差</dt><dd data-editor-metric="distanceDifference"></dd>
                        <dt>最大形状差</dt><dd data-editor-metric="maxDeviation"></dd>
                    </dl>
                </fieldset>
                <fieldset class="editor-point-editing">
                    <legend>ポイント編集</legend>
                    <label>
                        <input class="editor-point-editing-mode" type="checkbox">
                        After Trackのポイントを選択・移動
                    </label>
                    <span class="editor-point-editing-status" role="status"
                        aria-live="polite"></span>
                    <button type="button" data-editor-action="point-selection-clear">
                        選択解除
                    </button>
                    <button type="button" data-editor-action="point-add-mode"
                        aria-pressed="false">
                        ポイント追加
                    </button>
                    <button type="button" data-editor-action="point-delete">
                        選択ポイントを削除
                    </button>
                </fieldset>
                <fieldset class="editor-translation">
                    <legend>トラック移動</legend>
                    <label>
                        <input class="editor-translation-mode" type="checkbox">
                        地図上でAfter Trackをドラッグ
                    </label>
                    <p>
                        北/南: <span class="editor-translation-north">0.0 m</span><br>
                        東/西: <span class="editor-translation-east">0.0 m</span>
                    </p>
                </fieldset>
                <progress class="editor-progress" aria-label="Preview progress"
                    hidden></progress>
                <p class="editor-status" role="status" aria-live="polite"></p>
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
                if (action === "point-add-mode") {
                    const enabled = !this.getPointAddMode();

                    this.setPointAddMode(enabled);
                    this.#emit(action, enabled);
                    return;
                }
                this.#emit(
                    action,
                    action === "date-apply" ? this.dateInput.value : undefined
                );
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
            } else if (event.target.classList.contains("editor-rename-by-date")) {
                this.#emit("filename-toggle", event.target.checked);
            } else if (event.target.classList.contains("editor-translation-mode")) {
                this.#emit("translation-mode", event.target.checked);
            } else if (event.target.classList.contains("editor-point-editing-mode")) {
                this.#emit("point-editing-mode", event.target.checked);
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
        this.dateInput.disabled = !this.dateCorrectionEnabled;
        this.actionButtons.get("date-apply").disabled =
            !this.dateCorrectionEnabled;
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

    #formatLocalDate(date) {

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    #formatDirection(value, positive, negative) {

        const amount = Number(value) || 0;
        const direction = amount < 0 ? negative : positive;

        return `${direction} ${Math.abs(amount).toFixed(1)} m`;
    }

}
