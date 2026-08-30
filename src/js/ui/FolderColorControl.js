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
            ? new MutationObserver(records => {
                if (records.some(record => !this.#isOwnedMutation(record))) {
                    this.refresh();
                }
            })
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
                this.#refreshFolderFallbacks(path);
            }
        });
    }

    setPresentations(presentations) {

        const previous = this.presentations;
        const next = new Map(presentations);
        const changedPaths = new Set([...previous.keys(), ...next.keys()]);

        changedPaths.forEach(path => {
            if (this.#samePresentation(previous.get(path), next.get(path))) {
                changedPaths.delete(path);
            }
        });
        this.presentations = next;
        const folderRows = [...this.treeView.folderNodes.values()].filter(
            row =>
                changedPaths.has(row.dataset.treePath) ||
                !row.querySelector(".folder-color-readonly")
        );
        const fileRows = [...this.treeView.fileNodes.values()].filter(row => {
            const metadata = this.treeView.nodeMetadata.get(row.dataset.treePath);

            return changedPaths.has(metadata?.parentPath) ||
                !row.querySelector(".tree-color-mode");
        });

        if (folderRows.length === 0 && fileRows.length === 0) return;
        const folderColors = folderRows.length > 0
            ? this.#buildFolderColorMap()
            : new Map();

        folderRows.forEach(row => this.#refreshRow(
            row,
            folderColors.get(row.dataset.treePath) || null
        ));
        fileRows.forEach(row => this.#refreshFileRow(row.dataset.treePath));
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

        const folderColors = this.#buildFolderColorMap();

        this.treeElement.querySelectorAll(
            '.folder-row[data-node-kind="folder"]'
        ).forEach(row => this.#refreshRow(
            row,
            folderColors.get(row.dataset.treePath) || null
        ));
        this.treeElement.querySelectorAll(
            '.gpx-file[data-node-kind="file"]'
        ).forEach(row => this.#refreshFileRow(row.dataset.treePath));
    }

    getResolvedFolderColor(folderPath) {

        const presentation = this.presentations.get(folderPath);

        return presentation?.resolvedColor ||
            this.#buildFolderColorMap().get(folderPath) ||
            this.getResolvedColor?.(folderPath) || null;
    }

    #refreshRow(row, fallbackColor = null) {

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
            fallbackColor ||
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
        if (mode.textContent !== modeLabel) mode.textContent = modeLabel;
    }

    #buildFolderColorMap() {

        const directColors = new Map();
        const childFolders = new Map();
        const folderPaths = [];

        for (const metadata of this.treeView.nodeMetadata.values()) {
            if (metadata.kind === "folder") {
                folderPaths.push(metadata.path);
                if (metadata.path && metadata.parentPath !== metadata.path) {
                    const children = childFolders.get(metadata.parentPath) || [];

                    children.push(metadata.path);
                    childFolders.set(metadata.parentPath, children);
                }
                continue;
            }
            if (metadata.kind !== "file") continue;
            const color = this.displayState?.getDisplay(metadata.path)?.color ||
                metadata.color || this.getResolvedColor?.(metadata.path) || null;

            metadata.color = color;
            if (color && !directColors.has(metadata.parentPath)) {
                directColors.set(metadata.parentPath, color);
            }
        }
        const resolvedColors = new Map();
        const resolve = path => {
            if (resolvedColors.has(path)) return resolvedColors.get(path);
            let color = directColors.get(path) || null;

            if (!color) {
                for (const childPath of childFolders.get(path) || []) {
                    color = resolve(childPath);
                    if (color) break;
                }
            }
            resolvedColors.set(path, color);
            return color;
        };

        folderPaths.forEach(resolve);
        return resolvedColors;
    }

    #samePresentation(first, second) {

        const fallback = {
            mode: "auto",
            explicitColor: null,
            resolvedColor: null
        };
        const left = first || fallback;
        const right = second || fallback;

        return left.mode === right.mode &&
            left.explicitColor === right.explicitColor &&
            left.resolvedColor === right.resolvedColor;
    }

    #isOwnedMutation(record) {

        const selector = ".folder-color-control, .folder-color-readonly, " +
            ".tree-color-mode";
        const target = record.target?.nodeType === 1
            ? record.target
            : record.target?.parentElement;

        if (target?.closest?.(selector)) return true;
        const added = [...record.addedNodes].filter(node => node.nodeType === 1);

        return added.length > 0 && added.length === record.addedNodes.length &&
            added.every(node => node.matches?.(selector));
    }

    #refreshFolderFallbacks(path) {

        const color = this.displayState?.getDisplay(path)?.color ||
            this.treeView.nodeMetadata.get(path)?.color || null;
        let folderPath = this.treeView.nodeMetadata.get(path)?.parentPath;

        if (!color || typeof folderPath !== "string") return;
        while (true) {
            const row = this.treeView.folderNodes.get(folderPath);
            const presentation = this.presentations.get(folderPath);
            const readonly = row?.querySelector(".folder-color-readonly");

            if (
                row &&
                !presentation?.resolvedColor &&
                !readonly?.dataset.resolvedColor
            ) this.#refreshRow(row, color);
            if (!folderPath) break;
            folderPath = this.treeView.nodeMetadata.get(folderPath)?.parentPath;
            if (typeof folderPath !== "string") break;
        }

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
        const mode = indicator.querySelector(".folder-color-readonly-mode");

        if (mode.textContent !== modeLabel) mode.textContent = modeLabel;
        indicator.dataset.resolvedColor = color || "";
        indicator.setAttribute(
            "aria-label",
            `表示色: ${color || "未設定"}、${modeLabel}`
        );
    }
}
