import LibrarySettingsRepository from
    "../services/LibrarySettingsRepository.js";
import LibrarySettingsState from "../state/LibrarySettingsState.js";
import { createLibraryId } from "../utils/LibraryIdentity.js";
import { normalizeSharedSettings } from "../utils/SharedSettingsSchema.js";

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
        folderPresentationCache = null,
        confirmDiscard = message => globalThis.confirm?.(message) === true,
        setSaveInteraction = () => {},
        applyFolderColorChange = () => {},
        debounceMs = 500,
        storage = globalThis.localStorage,
        lifecycleTarget = globalThis.window,
        documentObject = globalThis.document,
        repository = new LibrarySettingsRepository(config),
        state = new LibrarySettingsState({
            schemaVersion: config.schemaVersion
        })
    } = {}) {

        this.repository = repository;
        this.state = state;
        this.displaySettingsStore = displaySettingsStore;
        this.folderColorState = folderColorState;
        this.folderPresentationCache = folderPresentationCache;
        this.confirmDiscard = confirmDiscard;
        this.setSaveInteraction = setSaveInteraction;
        this.applyFolderColorChange = applyFolderColorChange;
        this.panel = null;
        this.rootHandle = null;
        this.libraryId = null;
        this.folderPaths = [];
        this.generation = null;
        this.isCurrentLibrary = () => false;
        this.debounceMs = debounceMs;
        this.storage = storage;
        this.autosaveTimer = null;
        this.autosavePromise = null;
        this.sharedSettingsWritable = true;
        this.presentationCacheEnabled = true;
        this.pending = {};
        try {
            const stored = JSON.parse(storage?.getItem("trailbook.pendingSharedSettings") || "{}");
            if (stored && typeof stored === "object" && !Array.isArray(stored)) this.pending = stored;
        } catch (error) { console.warn("Shared settings pending cache unavailable", error); }
        lifecycleTarget?.addEventListener?.("pagehide", () => void this.flushAutosave());
        documentObject?.addEventListener?.("visibilitychange", () => {
            if (documentObject.visibilityState === "hidden") void this.flushAutosave();
        });
    }

    bindEvents(eventBus) {

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

    async load(rootHandle, {
        generation,
        isCurrent,
        sharedSettingsWritable = true,
        presentationCacheEnabled = true
    }) {

        this.#rememberPending();
        clearTimeout(this.autosaveTimer);
        // Finish an already-started write before replacing its state object.
        if (this.autosavePromise) await this.autosavePromise;
        const requestId = this.state.beginLoad();

        this.panel?.setAvailable(false);

        const result = await this.repository.load(rootHandle);

        if (!isCurrent() || !this.state.isCurrentRequest(requestId)) {
            return null;
        }

        return {
            requestId,
            result,
            rootHandle,
            generation,
            isCurrent,
            sharedSettingsWritable,
            presentationCacheEnabled
        };
    }

    applyLoad(loadContext, {
        libraryId,
        folderPaths,
        presentationCacheMode = "replace"
    }) {

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
        this.sharedSettingsWritable = loadContext.sharedSettingsWritable !== false;
        this.presentationCacheEnabled =
            loadContext.presentationCacheEnabled !== false;
        this.libraryId = libraryId;
        this.folderPaths = [...folderPaths];
        this.generation = loadContext.generation;
        this.isCurrentLibrary = loadContext.isCurrent;
        const pending = this.pending[libraryId];
        const pendingSnapshot = pending && normalizeSharedSettings(
            { schemaVersion: pending.snapshot?.schemaVersion,
                settings: { folderColors: pending.snapshot?.folderColors } },
            this.state.schemaVersion).snapshot;
        if (pendingSnapshot && folderColorToken(pendingSnapshot) !== folderColorToken(this.state.getSnapshot())) {
            // Keep the original fingerprint: disk changes must still conflict.
            this.state.snapshot = pendingSnapshot;
            this.state.dirty = true;
            this.state.saveStatus = "unsaved";
            this.state.fileExists = pending.baseline?.fileExists ?? null;
            this.state.fingerprint = pending.baseline?.fingerprint ?? null;
            this.state.size = pending.baseline?.size ?? null;
            this.state.lastModified = pending.baseline?.lastModified ?? null;
        }
        this.folderColorState.setActiveLibrary(
            libraryId,
            folderPaths,
            this.state.getSnapshot().folderColors
        );
        this.#cachePresentations(presentationCacheMode);
        this.#render();
        this.#rememberPending();
        this.scheduleAutosave();

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
            if (libraryId === this.libraryId && isCurrent?.()) {
                this.rootHandle = rootHandle;
                this.generation = generation;
                this.isCurrentLibrary = isCurrent;
                await this.flushAutosave();
            }
            return Object.freeze({
                applied: true,
                stale: false,
                skipped: true,
                source: this.state.getStatus().source,
                sourceChanged: previousStatus.source !== this.state.getStatus().source,
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

        if (!this.applyLoad(loadContext, {
            libraryId,
            folderPaths,
            presentationCacheMode: "merge"
        })) {
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

        if (!this.sharedSettingsWritable) return false;
        const activeId = this.folderColorState.activeLibraryId;
        if (activeId && activeId !== this.libraryId) {
            this.#rememberPending();
            clearTimeout(this.autosaveTimer);
            this.state.reset();
            this.state.fileExists = null; // provisional: no verified disk baseline yet
            this.libraryId = activeId;
            this.rootHandle = null;
            this.isCurrentLibrary = () => false;
        }
        const changed = this.state.markDirty(
            this.folderColorState.getExplicitColors(),
            this.folderColorState.getFolderPaths()
        );
        if (!changed) return false;
        this.#rememberPending();
        this.#render();
        this.scheduleAutosave();
        return true;
    }

    scheduleAutosave() {
        clearTimeout(this.autosaveTimer);
        if (!this.sharedSettingsWritable) return;
        if (!this.state.getStatus().dirty && !this.state.canMigrate()) return;
        this.autosaveTimer = setTimeout(() => void this.flushAutosave(), this.debounceMs);
    }

    flushAutosave() {
        clearTimeout(this.autosaveTimer);
        if (!this.sharedSettingsWritable) {
            return Promise.resolve({ status: "read-only" });
        }
        if (this.autosavePromise) return this.autosavePromise;
        this.autosavePromise = this.#autosave().catch(error => {
            console.warn("Shared settings autosave failed", error);
            this.#rememberPending();
            return { status: "failed", errorCode: "write-failed" };
        }).finally(() => { this.autosavePromise = null; });
        return this.autosavePromise;
    }

    async #autosave() {
        const status = this.state.getStatus();
        const root = this.rootHandle;
        const current = this.#createCurrentGuard();
        if (status.dirty && status.status === "invalid" && current()) {
            if (!this.panel?.isConflictOpen?.()) this.panel?.openConflict?.({ invalid: true });
            return { status: "recovery-required" };
        }
        if ((!status.dirty && !this.state.canMigrate()) || status.saving ||
            status.reloading || status.saveStatus === "conflict" ||
            status.status === "invalid" || !root || root.provisional === true ||
            !current()) return { status: "pending" };
        let permission;
        try { permission = await root.queryPermission?.({ mode: "readwrite" }); }
        catch { permission = "denied"; }
        if (!current() || root !== this.rootHandle) return { status: "stale" };
        if (permission !== "granted") {
            this.state.saveStatus = permission === "denied" ? "permission-denied" : "pending";
            this.#rememberPending();
            this.#render();
            return { status: "pending" };
        }
        const result = await this.#startSave(
            this.state.canMigrate() ? "migration" : "save", "require-match", true);
        this.#rememberPending();
        if (result.status === "saved" && this.state.getStatus().dirty) this.scheduleAutosave();
        return result;
    }

    #rememberPending() {
        if (!this.libraryId) return;
        const status = this.state.getStatus();
        if (status.status === "loading") return;
        if (status.dirty) {
            this.pending[this.libraryId] = {
                snapshot: this.state.getSnapshot(),
                baseline: { fileExists: status.fileExists, fingerprint: status.fingerprint,
                    size: status.size, lastModified: status.lastModified }
            };
        } else delete this.pending[this.libraryId];
        try {
            const value = JSON.stringify(this.pending);
            if (this.storage?.getItem("trailbook.pendingSharedSettings") !== value)
                this.storage?.setItem("trailbook.pendingSharedSettings", value);
        } catch (error) { console.warn("Shared settings pending cache write failed", error); }
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
            this.#rememberPending();
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

    async prepareLibrarySwitch() {
        await this.flushAutosave();
        this.#rememberPending();
        return this.canSwitchLibrary();
    }

    async prepareCacheReset() {

        clearTimeout(this.autosaveTimer);
        this.#rememberPending();
        if (this.autosavePromise) await this.autosavePromise;
        this.#rememberPending();
    }

    detachForCacheReset() {

        this.rootHandle = null;
        this.sharedSettingsWritable = true;
        this.presentationCacheEnabled = true;
        this.libraryId = null;
        this.folderPaths = [];
        this.generation = null;
        this.isCurrentLibrary = () => false;
        this.state.reset();
    }

    isSaving() {

        const status = this.state.getStatus();

        return status.saving || status.reloading;
    }

    async #startSave(operation, conflictPolicy, automatic = false) {

        if (!this.sharedSettingsWritable) {
            return { status: "read-only", errorCode: null };
        }
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
            return await this.#performSave(saveRequestId, conflictPolicy, automatic);
        } finally {
            this.setSaveInteraction(false);
        }
    }

    async #performSave(saveRequestId, conflictPolicy, automatic) {

        const shouldContinue = this.#createCurrentGuard();

        this.#render();

        const result = await this.repository.save(this.rootHandle, {
            baseline: this.state.getStatus(),
            snapshot: this.state.getSnapshot(),
            conflictPolicy,
            allowPermissionRequest: !automatic,
            shouldContinue
        }).catch(error => {
            console.warn("Shared settings write failed", error);
            return { status: "failed", errorCode: "write-failed" };
        });

        if (!shouldContinue() || !this.state.isCurrentSave(saveRequestId)) {
            return result;
        }

        if (result.status === "saved") {
            this.state.applySaveSuccess(saveRequestId, result.loadResult);
            if (!this.state.getStatus().dirty) this.#cachePresentations("replace");
        } else if (CONFLICT_ERRORS.has(result.errorCode)) {
            this.state.markConflict(saveRequestId, result.errorCode);
        } else {
            this.state.applySaveFailure(saveRequestId, result.errorCode);
        }

        this.#render();
        this.#rememberPending();

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
        this.#cachePresentations("replace");

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

    #cachePresentations(mode) {

        if (
            !this.presentationCacheEnabled ||
            this.state.getStatus().source !== "shared-json" ||
            !this.folderPresentationCache ||
            !this.libraryId
        ) return 0;
        const presentations = this.folderColorState.getFolderPresentations();

        return mode === "merge"
            ? this.folderPresentationCache.merge(
                this.libraryId,
                presentations
            )
            : this.folderPresentationCache.replace(
                this.libraryId,
                presentations
            );
    }

    #render() {

        this.panel?.setAvailable(this.sharedSettingsWritable);
        this.panel?.render(this.state.getStatus());
    }
}
