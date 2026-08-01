import LibrarySettingsRepository from
    "../services/LibrarySettingsRepository.js";
import LibrarySettingsState from "../state/LibrarySettingsState.js";

const CONFLICT_ERRORS = new Set([
    "conflict",
    "conflict-check-unavailable",
    "invalid-current-file"
]);

/**
 * Coordinates shared settings state, persistence, projection, and status UI.
 */
export default class LibrarySettingsCoordinator {

    constructor({
        config,
        displaySettingsStore,
        folderColorState,
        confirmDiscard = message => globalThis.confirm?.(message) === true,
        setSaveInteraction = () => {},
        repository = new LibrarySettingsRepository(config),
        state = new LibrarySettingsState({
            schemaVersion: config.schemaVersion
        })
    } = {}) {

        this.repository = repository;
        this.state = state;
        this.displaySettingsStore = displaySettingsStore;
        this.folderColorState = folderColorState;
        this.confirmDiscard = confirmDiscard;
        this.setSaveInteraction = setSaveInteraction;
        this.panel = null;
        this.rootHandle = null;
        this.generation = null;
        this.isCurrentLibrary = () => false;
    }

    setPanel(panel) {

        this.panel = panel;
        this.panel?.setAvailable(false);
    }

    async load(rootHandle, { generation, isCurrent }) {

        const requestId = this.state.beginLoad();

        this.panel?.setAvailable(false);

        const result = await this.repository.load(rootHandle);

        if (!isCurrent() || !this.state.isCurrentRequest(requestId)) {
            return null;
        }

        return { requestId, result, rootHandle, generation, isCurrent };
    }

    applyLoad(loadContext, { libraryId, folderPaths }) {

        if (
            !loadContext?.isCurrent() ||
            !this.state.applyLoad(
                loadContext.requestId,
                loadContext.result,
                this.displaySettingsStore.getFolderColors(libraryId)
            )
        ) {
            return false;
        }

        this.rootHandle = loadContext.rootHandle;
        this.generation = loadContext.generation;
        this.isCurrentLibrary = loadContext.isCurrent;
        this.folderColorState.setActiveLibrary(
            libraryId,
            folderPaths,
            this.state.getSnapshot().folderColors
        );
        this.#render();

        return true;
    }

    markDirty() {

        this.state.markDirty(
            this.folderColorState.getExplicitColors(),
            this.folderColorState.getFolderPaths()
        );
        this.#render();
    }

    async save() {

        const saveRequestId = this.state.beginSave();

        if (saveRequestId === null || !this.rootHandle) {
            return { status: "ignored", errorCode: null };
        }

        this.setSaveInteraction(true);

        try {
            return await this.#performSave(saveRequestId);
        } finally {
            this.setSaveInteraction(false);
        }
    }

    async #performSave(saveRequestId) {

        const generation = this.generation;
        const shouldContinue = () => (
            generation === this.generation && this.isCurrentLibrary()
        );

        this.#render();

        const result = await this.repository.save(this.rootHandle, {
            baseline: this.state.getStatus(),
            snapshot: this.state.getSnapshot(),
            shouldContinue
        });

        if (
            !shouldContinue() ||
            !this.state.isCurrentSave(saveRequestId)
        ) {
            return result;
        }

        if (result.status === "saved") {
            this.state.applySaveSuccess(saveRequestId, result.loadResult);
        } else if (CONFLICT_ERRORS.has(result.errorCode)) {
            this.state.markConflict(saveRequestId, result.errorCode);
        } else {
            this.state.applySaveFailure(saveRequestId, result.errorCode);
        }

        this.#render();

        return result;
    }

    canSwitchLibrary() {

        const status = this.state.getStatus();

        if (status.saving) {
            return false;
        }

        if (!status.dirty) {
            return true;
        }

        return this.confirmDiscard(
            "共有設定に未保存の変更があります。保存せずLibraryを切り替えますか？"
        );
    }

    isSaving() {

        return this.state.getStatus().saving;
    }

    #render() {

        this.panel?.setAvailable(true);
        this.panel?.render(this.state.getStatus());
    }
}
