import LibrarySettingsRepository from
    "../services/LibrarySettingsRepository.js";
import LibrarySettingsState from "../state/LibrarySettingsState.js";
import { createLibraryId } from "../utils/LibraryIdentity.js";

const CONFLICT_ERRORS = new Set([
    "conflict",
    "conflict-check-unavailable",
    "invalid-current-file"
]);

function folderColorToken(snapshot) {

    return Object.entries(snapshot?.folderColors || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, color]) => `${path}\u0000${color}`)
        .join("\u0001");
}

/**
 * Coordinates shared settings load, recovery, persistence, and projection.
 */
export default class LibrarySettingsCoordinator {

    constructor({
        config,
        displaySettingsStore,
        folderColorState,
        confirmDiscard = message => globalThis.confirm?.(message) === true,
        setSaveInteraction = () => {},
        applyFolderColorChange = () => {},
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
        this.applyFolderColorChange = applyFolderColorChange;
        this.panel = null;
        this.rootHandle = null;
        this.libraryId = null;
        this.folderPaths = [];
        this.generation = null;
        this.isCurrentLibrary = () => false;
    }

    bindEvents(eventBus) {

        eventBus.on("library-settings:save-requested", () => {
            void this.save();
        });
        eventBus.on("library-settings:migrate-requested", () => {
            void this.migrate();
        });
        eventBus.on("library-settings:reload-requested", () => {
            void this.reload();
        });
        eventBus.on("library-settings:conflict-reload-requested", () => {
            void this.reload({ discardDirty: true });
        });
        eventBus.on("library-settings:overwrite-requested", () => {
            void this.overwrite();
        });
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
        this.libraryId = libraryId;
        this.folderPaths = [...folderPaths];
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

    async reconcileActual(rootHandle, {
        libraryName,
        folderPaths,
        generation,
        isCurrent
    } = {}) {

        const previousStatus = this.state.getStatus();
        const previousColorToken = folderColorToken(this.state.getSnapshot());
        const libraryId = createLibraryId(libraryName);

        if (
            previousStatus.dirty ||
            previousStatus.saving ||
            previousStatus.reloading
        ) {
            return Object.freeze({
                applied: true,
                stale: false,
                skipped: true,
                source: previousStatus.source,
                sourceChanged: false,
                colorsChanged: false,
                libraryId
            });
        }
        const loadContext = await this.load(rootHandle, {
            generation,
            isCurrent
        });

        if (!loadContext) return Object.freeze({
            applied: false,
            stale: true,
            source: previousStatus.source,
            sourceChanged: false,
            colorsChanged: false,
            libraryId: null
        });

        if (!this.applyLoad(loadContext, { libraryId, folderPaths })) {
            return Object.freeze({
                applied: false,
                stale: true,
                source: previousStatus.source,
                sourceChanged: false,
                colorsChanged: false,
                libraryId: null
            });
        }

        const status = this.state.getStatus();
        const colorsChanged = previousColorToken !==
            folderColorToken(this.state.getSnapshot());

        this.displaySettingsStore.setActiveLibrary(libraryName);

        return Object.freeze({
            applied: true,
            stale: false,
            source: status.source,
            sourceChanged: previousStatus.source !== status.source,
            colorsChanged,
            libraryId
        });
    }

    markDirty() {

        this.state.markDirty(
            this.folderColorState.getExplicitColors(),
            this.folderColorState.getFolderPaths()
        );
        this.#render();
    }

    reconcileFolderPaths(folderPaths) {

        this.folderPaths = [...new Set(
            folderPaths.filter(path => typeof path === "string")
        )];
        this.folderColorState.setActiveLibrary(
            this.libraryId,
            this.folderPaths,
            this.state.getSnapshot().folderColors
        );
        this.#render();
    }

    async save() {

        const status = this.state.getStatus();

        if (
            status.saveStatus === "conflict" ||
            (status.status === "invalid" && status.dirty)
        ) {
            this.panel?.openConflict?.({
                invalid: status.status === "invalid"
            });
            return { status: "recovery-required", errorCode: status.errorCode };
        }

        return this.#startSave("save", "require-match");
    }

    async migrate() {

        return this.#startSave("migration", "require-match");
    }

    async overwrite() {

        return this.#startSave("overwrite", "explicit-overwrite");
    }

    async reload({ discardDirty = false } = {}) {

        const status = this.state.getStatus();

        if (
            status.dirty &&
            !discardDirty &&
            !this.confirmDiscard(
                "未保存のLibrary設定を破棄して再読み込みしますか？"
            )
        ) {
            return { status: "cancelled", errorCode: null };
        }

        const reloadRequestId = this.state.beginReload();

        if (reloadRequestId === null || !this.rootHandle) {
            return { status: "ignored", errorCode: null };
        }

        const shouldContinue = this.#createCurrentGuard();

        this.setSaveInteraction(true);
        this.#render();

        try {
            const result = await this.repository.load(this.rootHandle);

            if (
                !shouldContinue() ||
                !this.state.isCurrentReload(reloadRequestId)
            ) {
                this.state.cancelReload(reloadRequestId);
                this.#render();
                return { status: "stale", errorCode: "stale-library" };
            }

            const oldPaths = Object.keys(
                this.folderColorState.getExplicitColors()
            );
            const applied = this.state.applyReload(
                reloadRequestId,
                result,
                this.displaySettingsStore.getFolderColors(this.libraryId)
            );

            if (!applied) {
                this.state.cancelReload(reloadRequestId);
                this.#render();
                return { status: "failed", errorCode: "reload-failed" };
            }

            this.#projectFolderColors(oldPaths);
            this.#render();

            return { status: "reloaded", errorCode: result.errorCode };
        } catch {
            this.state.cancelReload(reloadRequestId);
            this.#render();
            return { status: "failed", errorCode: "reload-failed" };
        } finally {
            this.setSaveInteraction(false);
        }
    }

    canSwitchLibrary() {

        const status = this.state.getStatus();

        if (
            status.saving ||
            status.reloading ||
            this.panel?.isConflictOpen?.()
        ) {
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

        const status = this.state.getStatus();

        return status.saving || status.reloading;
    }

    async #startSave(operation, conflictPolicy) {

        const saveRequestId = operation === "migration"
            ? this.state.beginMigration()
            : operation === "overwrite"
                ? this.state.beginOverwrite()
                : this.state.beginSave();

        if (saveRequestId === null || !this.rootHandle) {
            return { status: "ignored", errorCode: null };
        }

        this.setSaveInteraction(true);

        try {
            return await this.#performSave(saveRequestId, conflictPolicy);
        } finally {
            this.setSaveInteraction(false);
        }
    }

    async #performSave(saveRequestId, conflictPolicy) {

        const shouldContinue = this.#createCurrentGuard();

        this.#render();

        const result = await this.repository.save(this.rootHandle, {
            baseline: this.state.getStatus(),
            snapshot: this.state.getSnapshot(),
            conflictPolicy,
            shouldContinue
        });

        if (!shouldContinue() || !this.state.isCurrentSave(saveRequestId)) {
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

        if (this.state.getStatus().saveStatus === "conflict") {
            this.panel?.openConflict?.({
                invalid: result.errorCode === "invalid-current-file"
            });
        }

        return result;
    }

    #projectFolderColors(oldExplicitPaths) {

        this.folderColorState.setActiveLibrary(
            this.libraryId,
            this.folderPaths,
            this.state.getSnapshot().folderColors
        );

        const affectedPaths = new Set([
            "",
            ...oldExplicitPaths,
            ...Object.keys(this.folderColorState.getExplicitColors())
        ]);

        affectedPaths.forEach(path => {
            if (this.folderColorState.hasFolderPath(path)) {
                this.applyFolderColorChange(path);
            }
        });
    }

    #createCurrentGuard() {

        const generation = this.generation;

        return () => (
            generation === this.generation && this.isCurrentLibrary()
        );
    }

    #render() {

        this.panel?.setAvailable(true);
        this.panel?.render(this.state.getStatus());
    }
}
