const MODE_LABELS = {
    explicit: "Explicit",
    inherited: "Inherited",
    auto: "Auto"
};

/**
 * Projects Folder color state onto lazily-created Tree rows.
 */
export default class FolderColorControl {

    constructor(treeView, eventBus, displayState = null, getResolvedColor = null) {

        this.treeView = treeView;
        this.treeElement = treeView.element;
        this.eventBus = eventBus;
        this.displayState = displayState;
        this.getResolvedColor = getResolvedColor;
        this.presentations = new Map();
        this.persistenceStatus = "available";
        this.observer = typeof MutationObserver === "function"
            ? new MutationObserver(() => this.refresh())
            : null;

        this.observer?.observe(this.treeElement, {
            childList: true,
            subtree: true
        });
        this.displayState?.subscribe(path => {
            if (path === null) {
                this.refresh();
            } else {
                this.#refreshFileRow(path);
            }
        });
    }

    setPresentations(presentations) {

        this.presentations = new Map(presentations);
        this.refresh();
    }

    setPersistenceStatus(status) {

        this.persistenceStatus = status === "session-only"
            ? "session-only"
            : "available";
    }

    setFileColor(path, color) {

        const metadata = this.treeView.nodeMetadata.get(path);

        if (metadata?.kind !== "file") {
            return false;
        }

        metadata.color = color;

        const indicator = this.treeView.fileNodes.get(path)?.querySelector(
            ".tree-color-indicator"
        );

        if (indicator) {
            indicator.style.backgroundColor = color || "";
        }

        this.#refreshFileRow(path);

        return true;
    }

    refresh() {

        this.treeElement.querySelectorAll(
            '.folder-row[data-node-kind="folder"]'
        ).forEach(row => this.#refreshRow(row));
        this.treeElement.querySelectorAll(
            '.gpx-file[data-node-kind="file"]'
        ).forEach(row => this.#refreshFileRow(row.dataset.treePath));
    }

    #refreshRow(row) {

        const folderPath = row.dataset.treePath;
        const presentation = this.presentations.get(folderPath) || {
            mode: "auto",
            explicitColor: null,
            resolvedColor: null
        };
        const folderName = row.querySelector(".tree-label")?.textContent ||
            folderPath || "root";
        const button = row.querySelector(".folder-color-control") ||
            this.#createButton(row);
        const swatch = button.querySelector(".folder-color-swatch");
        const mode = button.querySelector(".folder-color-mode");
        const modeLabel = MODE_LABELS[presentation.mode] || MODE_LABELS.auto;
        const resolvedColor = presentation.resolvedColor ||
            this.#findDescendantColor(folderPath) ||
            this.getResolvedColor?.(folderPath) || null;
        const persistenceLabel = this.persistenceStatus === "session-only"
            ? `${modeLabel} (Session only)`
            : modeLabel;

        button.dataset.colorMode = presentation.mode;
        button.dataset.folderPath = folderPath;
        button.title = `${folderName}: ${persistenceLabel}`;
        button.setAttribute(
            "aria-label",
            `${folderName}のFolder色を編集。現在: ${persistenceLabel}`
        );
        if (mode.textContent !== persistenceLabel) {
            mode.textContent = persistenceLabel;
        }

        if (resolvedColor) {
            swatch.style.backgroundColor = resolvedColor;
        } else {
            swatch.style.removeProperty("background-color");
        }
        this.#refreshReadonly(
            row,
            "folder-color-readonly",
            resolvedColor,
            modeLabel
        );
    }

    #createButton(row) {

        const button = document.createElement("button");
        const swatch = document.createElement("span");
        const mode = document.createElement("span");

        button.className = "folder-color-control";
        button.type = "button";
        swatch.className = "folder-color-swatch";
        swatch.setAttribute("aria-hidden", "true");
        mode.className = "folder-color-mode";
        button.append(swatch, mode);
        button.addEventListener("keydown", event => event.stopPropagation());
        button.addEventListener("click", event => {
            event.stopPropagation();
            const folderPath = button.dataset.folderPath;
            const folderName = row.querySelector(".tree-label")?.textContent ||
                folderPath || "root";

            this.eventBus.emit("folder:color-edit-requested", {
                folderPath,
                folderName,
                origin: button
            });
        });
        row.append(button);

        return button;
    }

    #refreshFileRow(path) {

        const metadata = this.treeView.nodeMetadata.get(path);
        const row = this.treeView.fileNodes.get(path);

        if (!row || metadata?.kind !== "file") return;

        const presentation = this.presentations.get(metadata.parentPath) || {
            mode: "auto"
        };
        const modeLabel = MODE_LABELS[presentation.mode] || MODE_LABELS.auto;
        const color = this.displayState?.getDisplay(path)?.color ||
            metadata.color || this.getResolvedColor?.(path) || null;
        const swatch = row.querySelector(".tree-color-indicator");

        metadata.color = color;
        if (color) swatch?.style.setProperty("background-color", color);
        else swatch?.style.removeProperty("background-color");
        if (swatch) {
            swatch.removeAttribute("aria-hidden");
            swatch.setAttribute("role", "img");
            swatch.setAttribute(
                "aria-label",
                `表示色: ${color || "未設定"}、${modeLabel}`
            );
        }
        let mode = row.querySelector(".tree-color-mode");

        if (!mode) {
            mode = document.createElement("span");
            mode.className = "tree-color-mode";
            mode.setAttribute("aria-hidden", "true");
            swatch?.after(mode);
        }
        mode.textContent = modeLabel;
    }

    #findDescendantColor(folderPath) {

        for (const metadata of this.treeView.nodeMetadata.values()) {
            if (
                metadata.kind !== "file" ||
                (folderPath && !metadata.path.startsWith(`${folderPath}/`))
            ) continue;

            const color = this.displayState?.getDisplay(metadata.path)?.color ||
                metadata.color || this.getResolvedColor?.(metadata.path);

            if (color) return color;
        }

        return null;
    }

    #refreshReadonly(row, className, color, modeLabel) {

        let indicator = row.querySelector(`.${className}`);

        if (!indicator) {
            indicator = document.createElement("span");
            indicator.className = className;
            indicator.innerHTML = `
                <span class="folder-color-readonly-swatch" aria-hidden="true"></span>
                <span class="folder-color-readonly-mode"></span>
            `;
            row.append(indicator);
        }
        const swatch = indicator.querySelector(".folder-color-readonly-swatch");

        if (color) swatch.style.backgroundColor = color;
        else swatch.style.removeProperty("background-color");
        indicator.querySelector(".folder-color-readonly-mode").textContent =
            modeLabel;
        indicator.setAttribute(
            "aria-label",
            `表示色: ${color || "未設定"}、${modeLabel}`
        );
    }
}
