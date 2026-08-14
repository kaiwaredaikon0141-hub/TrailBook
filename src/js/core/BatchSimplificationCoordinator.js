import BatchSimplificationService from "../services/BatchSimplificationService.js";
import { isReservedLibraryFolderName } from "../services/LibraryReservedFolderPolicy.js";
import BatchSimplificationPanel from "../ui/BatchSimplificationPanel.js";

/**
 * Coordinates explicit, sequential batch simplification outside App.
 */
export default class BatchSimplificationCoordinator {

    constructor({
        getEntries,
        getRootDirectoryHandle,
        getLibraryToken,
        isLibraryAvailable,
        isEditorBusy,
        refreshSavedFile,
        setBusy = () => {},
        service = new BatchSimplificationService(),
        panel = new BatchSimplificationPanel()
    }) {

        this.getEntries = getEntries;
        this.getRootDirectoryHandle = getRootDirectoryHandle;
        this.getLibraryToken = getLibraryToken;
        this.isLibraryAvailable = isLibraryAvailable;
        this.isEditorBusy = isEditorBusy;
        this.refreshSavedFile = refreshSavedFile;
        this.setBusy = setBusy;
        this.service = service;
        this.panel = panel;
        this.analysis = null;
        this.analysisLibraryToken = null;
        this.busy = false;
        this.cancelRequested = false;
    }

    attach(container) {

        this.panel.attach(container);
        this.panel.on("open", () => this.#refreshAvailability());
        this.panel.on("analyze", () => void this.analyze());
        this.panel.on("execute", () => void this.execute());
        this.panel.on("cancel", () => this.cancel());
        this.#refreshAvailability();
    }

    isBusy() {

        return this.busy;
    }

    async analyze() {

        if (!this.#canStart()) return false;

        const options = this.panel.getOptions();
        const entries = this.getEntries(options.scope);

        if (!Number.isFinite(options.toleranceMeters) || options.toleranceMeters <= 0) {
            this.panel.showError("Toleranceには0より大きい値を指定してください。");
            return false;
        }
        if (entries.length === 0) {
            this.panel.showError("対象GPXがありません。");
            return false;
        }

        this.#begin();
        this.analysis = null;
        this.analysisLibraryToken = null;
        this.panel.showAnalyzing({ completed: 0, total: entries.length });

        try {
            const analysis = await this.service.analyze(
                entries,
                options.toleranceMeters,
                {
                    shouldCancel: () => this.cancelRequested,
                    onProgress: progress => this.panel.showAnalyzing(progress)
                }
            );

            this.analysis = analysis.cancelled ? null : analysis;
            this.analysisLibraryToken = analysis.cancelled
                ? null
                : this.getLibraryToken();
            this.panel.showAnalysis(analysis);
            return !analysis.cancelled;
        } catch (error) {
            this.panel.showError(error?.message || "解析に失敗しました。");
            return false;
        } finally {
            this.#end();
        }
    }

    async execute() {

        if (!this.analysis || !this.#canStart()) return false;
        if (this.analysisLibraryToken !== this.getLibraryToken()) {
            this.analysis = null;
            this.analysisLibraryToken = null;
            this.panel.showError("Libraryが変更されたため再解析してください。");
            return false;
        }

        const analysis = this.analysis;
        const total = analysis.changedCount;

        this.#begin();
        this.panel.showExecuting({ completed: 0, total });

        try {
            const result = await this.service.execute(analysis, {
                rootDirectoryHandle: this.getRootDirectoryHandle(),
                refreshSavedFile: this.refreshSavedFile,
                shouldCancel: () => this.cancelRequested,
                onProgress: progress => this.panel.showExecuting(progress)
            });

            this.analysis = null;
            this.analysisLibraryToken = null;
            this.panel.showResult(result);
            return result;
        } catch (error) {
            this.panel.showError(error?.message || "一括簡略化を開始できませんでした。");
            return false;
        } finally {
            this.#end();
        }
    }

    cancel() {

        if (!this.busy) return false;

        this.cancelRequested = true;
        return true;
    }

    #canStart() {

        this.#refreshAvailability();

        if (this.busy || !this.isLibraryAvailable()) return false;
        if (this.isEditorBusy()) {
            this.panel.showError("Track Editorを終了してから実行してください。");
            return false;
        }
        return true;
    }

    #begin() {

        this.busy = true;
        this.cancelRequested = false;
        this.setBusy(true);
    }

    #end() {

        this.busy = false;
        this.cancelRequested = false;
        this.setBusy(false);
        this.#refreshAvailability();
    }

    #refreshAvailability() {

        const available = this.isLibraryAvailable();
        const folderAvailable = available && this.getEntries("folder").length > 0;

        this.panel.setAvailable(
            available,
            available ? "" : "Libraryを開いてください。"
        );
        this.panel.setFolderScopeAvailable(folderAvailable);
    }
}

export function collectBatchEntries(treeView, scope) {

    const folderPath = treeView.focusedPath;
    const folderMetadata = treeView.nodeMetadata.get(folderPath);

    if (scope === "folder" && folderMetadata?.kind !== "folder") return [];

    return [...treeView.nodeMetadata.values()]
        .filter(metadata => metadata.kind === "file")
        .filter(metadata => !metadata.path.split("/")
            .some(isReservedLibraryFolderName))
        .filter(metadata => scope === "library" ||
            folderPath === "" ||
            metadata.parentPath === folderPath ||
            treeView.isDescendant(metadata.path, folderPath))
        .map(metadata => ({
            relativePath: metadata.path,
            fileHandle: metadata.model,
            directoryHandle: treeView.nodeMetadata
                .get(metadata.parentPath)?.model?.handle
        }))
        .filter(entry => entry.directoryHandle);
}
