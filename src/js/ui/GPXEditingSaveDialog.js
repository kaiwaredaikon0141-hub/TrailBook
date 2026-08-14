/**
 * Confirms one explicit Backup + in-place save operation.
 */
export default class GPXEditingSaveDialog {

    constructor() {

        this.dialog = this.#create();
        this.resolve = null;
        this.origin = null;
        this.dialog.addEventListener("cancel", event => {
            event.preventDefault();
            this.#close(false);
        });
        this.dialog.addEventListener("click", event => {
            const action = event.target.closest("[data-save-confirm]")
                ?.dataset.saveConfirm;

            if (action === "save") this.#close(true);
            if (action === "cancel") this.#close(false);
        });
    }

    attach(container) {

        container?.append?.(this.dialog);
    }

    confirm({ targetPath, backupExists = false, metrics, origin = null }) {

        if (this.resolve) return Promise.resolve(false);

        this.origin = origin;
        this.dialog.querySelector("[data-save-target]").textContent = targetPath;
        this.dialog.querySelector("[data-save-points]").textContent =
            `${metrics.sourcePointCount} → ${metrics.retainedPointCount}`;
        this.dialog.querySelector("[data-save-distance]").textContent =
            `${metrics.distanceDifferenceMeters.toFixed(1)} m`;
        this.dialog.querySelector("[data-save-backup]").textContent = backupExists
            ? "初回原本Backupは作成済みです。元GPXへ編集結果を保存します。"
            : "原本をTrailBook_Backupへ保存・検証してから編集結果を保存します。";
        this.dialog.showModal();
        this.dialog.querySelector("[data-save-confirm='cancel']").focus();

        return new Promise(resolve => { this.resolve = resolve; });
    }

    #close(confirmed) {

        const resolve = this.resolve;

        this.resolve = null;
        this.dialog.close();
        this.origin?.focus?.({ preventScroll: true });
        this.origin = null;
        resolve?.(confirmed);
    }

    #create() {

        const dialog = document.createElement("dialog");

        dialog.className = "editor-save-dialog";
        dialog.setAttribute("aria-labelledby", "editor-save-dialog-title");
        dialog.innerHTML = `
            <h2 id="editor-save-dialog-title">編集結果を保存しますか？</h2>
            <dl>
                <dt>Target</dt><dd data-save-target></dd>
                <dt>Points</dt><dd data-save-points></dd>
                <dt>Distance difference</dt><dd data-save-distance></dd>
                <dt>Output</dt><dd>UTF-8, no BOM, LF</dd>
            </dl>
            <p data-save-backup></p>
            <p>原本Backup作成前に元GPXを変更しません。</p>
            <div class="dialog-actions">
                <button type="button" data-save-confirm="cancel">Cancel</button>
                <button type="button" data-save-confirm="save">保存</button>
            </div>
        `;
        return dialog;
    }
}
