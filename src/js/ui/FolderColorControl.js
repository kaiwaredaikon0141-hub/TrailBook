const MODE_LABELS = {
    explicit: "Explicit",
    inherited: "Inherited",
    auto: "Auto"
};

/**
 * Projects Folder color state onto lazily-created Tree rows.
 */
export default class FolderColorControl {

    constructor(treeView, eventBus) {

        this.treeView = treeView;
        this.treeElement = treeView.element;
        this.eventBus = eventBus;
        this.presentations = new Map();
        this.persistenceStatus = "available";
        this.observer = typeof MutationObserver === "function"
            ? new MutationObserver(() => this.refresh())
            : null;

        this.observer?.observe(this.treeElement, {
            childList: true,
            subtree: true
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

        return true;
    }

    refresh() {

        this.treeElement.querySelectorAll(
            '.folder-row[data-node-kind="folder"]'
        ).forEach(row => this.#refreshRow(row));
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

        if (presentation.resolvedColor) {
            swatch.style.backgroundColor = presentation.resolvedColor;
        } else {
            swatch.style.removeProperty("background-color");
        }
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
}
