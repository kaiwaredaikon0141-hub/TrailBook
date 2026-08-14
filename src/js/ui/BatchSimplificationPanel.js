/**
 * Presents batch simplification controls without owning filesystem state.
 */
export default class BatchSimplificationPanel {

    constructor({ defaultToleranceMeters = 10 } = {}) {

        this.handlers = new Map();
        this.element = this.#create(defaultToleranceMeters);
        this.body = this.element.querySelector(".batch-simplification-body");
        this.scope = this.element.querySelector(".batch-simplification-scope");
        this.tolerance = this.element.querySelector(".batch-simplification-tolerance");
        this.analyzeButton = this.element.querySelector("[data-batch-action='analyze']");
        this.executeButton = this.element.querySelector("[data-batch-action='execute']");
        this.cancelButton = this.element.querySelector("[data-batch-action='cancel']");
        this.status = this.element.querySelector(".batch-simplification-status");
        this.summary = this.element.querySelector(".batch-simplification-summary");
        this.errors = this.element.querySelector(".batch-simplification-errors");
        this.#bind();
        this.showIdle();
    }

    attach(container) {

        container.append(this.element);
    }

    on(action, handler) {

        this.handlers.set(action, handler);
    }

    getOptions() {

        return {
            scope: this.scope.value,
            toleranceMeters: Number(this.tolerance.value)
        };
    }

    setAvailable(available, reason = "") {

        const open = this.element.querySelector(".batch-simplification-open");

        open.title = reason;
        if (!available) {
            open.setAttribute("aria-expanded", "false");
            this.body.hidden = true;
        }
    }

    setFolderScopeAvailable(available) {

        const option = this.scope.querySelector("option[value='folder']");

        option.disabled = !available;
        if (!available && this.scope.value === "folder") {
            this.scope.value = "library";
        }
    }

    showIdle() {

        this.#setBusy(false);
        this.executeButton.disabled = true;
        this.cancelButton.disabled = true;
        this.status.textContent = "解析を実行してください。";
        this.summary.textContent = "";
        this.errors.replaceChildren();
    }

    showAnalyzing({ completed = 0, total = 0 } = {}) {

        this.#setBusy(true);
        this.cancelButton.disabled = false;
        this.status.textContent = `解析中 ${completed} / ${total}`;
    }

    showAnalysis(analysis) {

        this.#setBusy(false);
        this.cancelButton.disabled = true;
        this.executeButton.disabled = analysis.changedCount === 0 || analysis.cancelled;
        this.status.textContent = analysis.cancelled
            ? "解析をキャンセルしました。"
            : "解析が完了しました。";
        this.summary.textContent = this.#formatSummary({
            target: analysis.targetCount,
            changed: analysis.changedCount,
            unchanged: analysis.unchangedCount,
            errors: analysis.errorCount,
            before: analysis.sourcePointCount,
            after: analysis.retainedPointCount,
            ratio: analysis.reductionRatio
        });
        this.#showErrors(analysis.errors);
    }

    showExecuting({ completed = 0, total = 0 } = {}) {

        this.#setBusy(true);
        this.cancelButton.disabled = false;
        this.status.textContent = `実行中 ${completed} / ${total}`;
    }

    showResult(result) {

        this.#setBusy(false);
        this.executeButton.disabled = true;
        this.cancelButton.disabled = true;
        this.status.textContent = result.cancelled
            ? "安全なfile境界で停止しました。"
            : "一括簡略化が完了しました。";
        this.summary.textContent = this.#formatSummary({
            success: result.successCount,
            unchanged: result.unchangedCount,
            skipped: result.skippedCount,
            errors: result.errorCount,
            before: result.sourcePointCount,
            after: result.retainedPointCount,
            ratio: result.reductionRatio
        });
        this.#showErrors(result.errors);
    }

    showError(message) {

        this.#setBusy(false);
        this.executeButton.disabled = true;
        this.cancelButton.disabled = true;
        this.status.textContent = message;
    }

    #setBusy(busy) {

        this.scope.disabled = busy;
        this.tolerance.disabled = busy;
        this.analyzeButton.disabled = busy;
        this.executeButton.disabled = busy;
        this.element.setAttribute("aria-busy", String(busy));
    }

    #formatSummary(values) {

        const lines = [];

        if (values.target !== undefined) lines.push(`対象 ${values.target} GPX`);
        if (values.changed !== undefined) lines.push(`変更あり ${values.changed}`);
        if (values.success !== undefined) lines.push(`成功 ${values.success}`);
        lines.push(`変更なし ${values.unchanged || 0}`);
        if (values.skipped !== undefined) lines.push(`skip ${values.skipped || 0}`);
        lines.push(`error ${values.errors || 0}`);
        lines.push(`${values.before || 0} → ${values.after || 0} points`);
        lines.push(`${((values.ratio || 0) * 100).toFixed(1)}%削減`);
        return lines.join(" / ");
    }

    #showErrors(errors = []) {

        this.errors.replaceChildren();

        errors.slice(0, 100).forEach(error => {
            const item = document.createElement("li");

            item.textContent = `${error.relativePath}: ${error.reason}`;
            this.errors.append(item);
        });

        if (errors.length > 100) {
            const item = document.createElement("li");

            item.textContent = `ほか ${errors.length - 100} 件`;
            this.errors.append(item);
        }
    }

    #create(defaultToleranceMeters) {

        const section = document.createElement("section");

        section.className = "batch-simplification";
        section.innerHTML = `
            <button type="button" class="batch-simplification-open"
                aria-expanded="false">一括簡略化</button>
            <div class="batch-simplification-body" hidden>
                <label>対象
                    <select class="batch-simplification-scope">
                        <option value="folder">選択Folder</option>
                        <option value="library">Library全体</option>
                    </select>
                </label>
                <label>Tolerance (m)
                    <input class="batch-simplification-tolerance" type="number"
                        min="0.01" step="0.01" value="${defaultToleranceMeters}">
                </label>
                <div class="batch-simplification-actions">
                    <button type="button" data-batch-action="analyze">解析</button>
                    <button type="button" data-batch-action="execute">実行</button>
                    <button type="button" data-batch-action="cancel">キャンセル</button>
                </div>
                <p class="batch-simplification-status" role="status"
                    aria-live="polite"></p>
                <p class="batch-simplification-summary"></p>
                <ul class="batch-simplification-errors"></ul>
            </div>
        `;
        return section;
    }

    #bind() {

        const open = this.element.querySelector(".batch-simplification-open");

        open.addEventListener("click", () => {
            const expanded = open.getAttribute("aria-expanded") !== "true";

            open.setAttribute("aria-expanded", String(expanded));
            this.body.hidden = !expanded;
            if (expanded) this.handlers.get("open")?.();
        });
        this.element.querySelectorAll("[data-batch-action]").forEach(button => {
            button.addEventListener("click", () => {
                this.handlers.get(button.dataset.batchAction)?.();
            });
        });
        this.scope.addEventListener("change", () => this.showIdle());
        this.tolerance.addEventListener("input", () => this.showIdle());
    }
}
