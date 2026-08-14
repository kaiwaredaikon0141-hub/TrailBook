import EditingPreviewLayerManager from "../map/EditingPreviewLayerManager.js";
import GPXEditingSession from "../models/GPXEditingSession.js";
import GPXEditingSourceLoader from "../services/GPXEditingSourceLoader.js";
import GPXEditingSaveService from "../services/GPXEditingSaveService.js";
import TrackSimplificationMetrics from "../services/TrackSimplificationMetrics.js";
import TrackSimplificationService from "../services/TrackSimplificationService.js";
import TrackEditingInteractionGuard from "../ui/TrackEditingInteractionGuard.js";
import TrackEditingPanel from "../ui/TrackEditingPanel.js";
import GPXEditingSaveDialog from "../ui/GPXEditingSaveDialog.js";

const PREVIEW_DEBOUNCE_MS = 150;
export default class TrackEditingCoordinator {

    constructor({
        eventBus,
        selectionState,
        mapView,
        getFileEntry,
        getLibraryToken = () => null,
        refreshEditedFile = async () => true,
        setSaveBusy = () => {},
        interactionRoot = null,
        sourceLoader = new GPXEditingSourceLoader(),
        saveService = new GPXEditingSaveService(),
        saveDialog = new GPXEditingSaveDialog(),
        simplification = new TrackSimplificationService(),
        metrics = new TrackSimplificationMetrics(),
        panel = new TrackEditingPanel(),
        previewLayers = new EditingPreviewLayerManager(mapView.map),
        interactionGuard = new TrackEditingInteractionGuard(
            mapView,
            interactionRoot
        ),
        previewDebounceMs = PREVIEW_DEBOUNCE_MS
    }) {

        this.eventBus = eventBus;
        this.selectionState = selectionState;
        this.mapView = mapView;
        this.getFileEntry = getFileEntry;
        this.getLibraryToken = getLibraryToken;
        this.refreshEditedFile = refreshEditedFile;
        this.setSaveBusy = setSaveBusy;
        this.interactionGuard = interactionGuard;
        this.sourceLoader = sourceLoader;
        this.saveService = saveService;
        this.saveDialog = saveDialog;
        this.simplification = simplification;
        this.metrics = metrics;
        this.panel = panel;
        this.previewLayers = previewLayers;
        this.previewDebounceMs = previewDebounceMs;
        this.session = null;
        this.sourcePath = null;
        this.abortController = null;
        this.previewTimer = null;
        this.requestId = 0;
        this.loading = false;
        this.saving = false;
        this.confirmingSave = false;
        this.lastSavedMasks = null;
        this.draft = null;
    }

    attach(container) {

        this.panel.attach(container);
        this.saveDialog.attach(container);
        this.panel.setSelectedTrack(this.selectionState.getSelectedPath());
        this.#bindPanel();
        this.#bindEvents();
    }

    async start() {

        if (
            this.session || this.loading || this.saving || this.confirmingSave
        ) return false;

        const path = this.selectionState.getSelectedPath();
        const entry = path ? this.getFileEntry(path) : null;

        if (!entry?.fileHandle) return false;

        if (this.#canResumeDraft(path)) {
            return this.#resumeDraft(path);
        }

        this.#discardDraft();
        this.lastSavedMasks = null;

        const requestId = ++this.requestId;

        this.loading = true;
        this.sourcePath = path;
        this.interactionGuard.setLocked(true);
        this.panel.showLoading(path);

        try {
            const source = await this.sourceLoader.load(entry.fileHandle, path);

            if (requestId !== this.requestId || this.sourcePath !== path) {
                return false;
            }

            if (source.tracks.length === 0) {
                throw new Error("Trackを含む編集sourceを読み込めませんでした。");
            }

            this.session = new GPXEditingSession(source);
            this.mapView.setEditingTargetSuppressed(path, true);
            this.previewLayers.setSource(source);
            this.previewLayers.setCandidate(
                source,
                this.session.getRetainedPointMasks()
            );
            this.previewLayers.setMode(this.panel.getMode());
            this.previewLayers.setPointMode(this.panel.getPointMode());
            let backupExists = null;

            try {
                backupExists = (await this.saveService.inspectBackup(
                    entry.parentFolderHandle,
                    source.sourceFileName
                )).exists;
            } catch {
                // Save rechecks and reports an exact error on explicit action.
            }
            this.panel.configureSave({
                canSerialize: source.canSerialize,
                backupExists
            });
            this.panel.showReady({ canSerialize: source.canSerialize });
            this.#updateHistory();
            this.loading = false;
            await this.requestPreview(this.panel.getTolerance());
            return true;
        } catch (error) {
            if (requestId !== this.requestId) return false;

            this.loading = false;
            this.panel.showError(
                error?.message || "編集sourceを読み込めませんでした。"
            );
            return false;
        }
    }

    schedulePreview(toleranceMeters) {

        if (!this.session) return;

        clearTimeout(this.previewTimer);
        this.#abortPreview();
        this.requestId += 1;
        this.panel.showPreviewing(this.#emptyProgress());
        this.previewTimer = setTimeout(
            () => void this.requestPreview(toleranceMeters),
            this.previewDebounceMs
        );
    }

    async requestPreview(toleranceMeters) {

        if (!this.session) return false;

        clearTimeout(this.previewTimer);
        this.#abortPreview();

        const requestId = ++this.requestId;
        const session = this.session;
        const controller = new AbortController();

        this.abortController = controller;
        session.clearPreview();
        this.panel.showPreviewing(this.#emptyProgress());

        try {
            const preview = await this.simplification.createPreview(
                session.source,
                toleranceMeters,
                {
                    signal: controller.signal,
                    onProgress: progress => {
                        if (this.#isPreviewCurrent(requestId, session)) {
                            this.panel.showPreviewing(progress);
                        }
                    }
                }
            );

            if (!this.#isPreviewCurrent(requestId, session)) return false;

            session.setPreview(preview);
            this.previewLayers.setCandidate(
                session.source,
                preview.retainedPointMasks
            );
            this.panel.showPreview(preview.metrics);
            this.#updateHistory();
            return true;
        } catch (error) {
            if (
                error?.code !== "SIMPLIFICATION_ABORTED" &&
                this.#isPreviewCurrent(requestId, session)
            ) {
                this.panel.showError(
                    error instanceof TypeError
                        ? "Toleranceには0より大きいmeter値を入力してください。"
                        : "Previewを作成できませんでした。"
                );
            }
            return false;
        } finally {
            if (this.abortController === controller) {
                this.abortController = null;
            }
        }
    }

    apply() {

        if (this.saving || !this.session?.applyPreview()) return false;

        this.#showWorkingState();
        return true;
    }

    undo() {

        if (this.saving || !this.session?.undo()) return false;

        this.#invalidatePendingPreview();
        this.#showWorkingState();
        return true;
    }

    redo() {

        if (this.saving || !this.session?.redo()) return false;

        this.#invalidatePendingPreview();
        this.#showWorkingState();
        return true;
    }

    async save() {

        if (
            this.saving || this.confirmingSave || !this.session?.isActive ||
            !this.session.isDirty || !this.session.source.canSerialize
        ) {
            return false;
        }

        const session = this.session;
        const sourcePath = this.sourcePath;
        const entry = this.getFileEntry(sourcePath);

        if (!entry?.parentFolderHandle) {
            this.panel.showSaveError("The source Folder is unavailable.");
            return false;
        }

        let backup;

        try {
            backup = await this.saveService.inspectBackup(
                entry.parentFolderHandle,
                session.source.sourceFileName
            );
        } catch (error) {
            this.panel.showSaveError(this.#getSaveErrorMessage(error));
            return false;
        }

        const saveMetrics = this.metrics.calculate(
            session.source,
            session.getRetainedPointMasks()
        ).total;

        this.confirmingSave = true;
        let confirmed = false;

        try {
            confirmed = await this.saveDialog.confirm({
                targetPath: sourcePath,
                backupExists: backup.exists,
                metrics: saveMetrics,
                origin: this.panel.getSaveButton()
            });
        } catch {
            this.panel.showSaveError("Save confirmation could not be opened.");
            return false;
        } finally {
            this.confirmingSave = false;
        }

        if (!confirmed || this.session !== session) {
            if (this.session === session) this.panel.showSaveCancelled();
            return false;
        }

        this.#invalidatePendingPreview();
        session.clearPreview();
        this.#showWorkingState();
        this.saving = true;
        this.setSaveBusy(true);
        this.panel.showSaving(session.source.sourceFileName, {
            backupExists: backup.exists
        });

        try {
            const savedMasks = session.getRetainedPointMasks();
            const saved = await this.saveService.save({
                source: session.source,
                retainedPointMasks: savedMasks,
                directoryHandle: entry.parentFolderHandle,
                relativePath: sourcePath
            });
            let refreshSucceeded = false;

            try {
                refreshSucceeded = Boolean(await this.refreshEditedFile({
                    sourcePath,
                    fileHandle: saved.fileHandle
                }));
            } catch {
                refreshSucceeded = false;
            }

            if (this.session === session) {
                this.session = new GPXEditingSession(saved.source);
                this.lastSavedMasks = this.session.getRetainedPointMasks();
                this.previewLayers.setSource(saved.source);
                this.previewLayers.setCandidate(
                    saved.source,
                    this.lastSavedMasks
                );
                this.#showWorkingState();
                this.panel.showSaveSuccess(saved.fileName, {
                    refreshSucceeded,
                    backupCreated: saved.backupCreated
                });
            }

            return Object.freeze({ ...saved, refreshSucceeded });
        } catch (error) {
            if (this.session === session) {
                this.#showWorkingState();
                this.panel.showSaveError(this.#getSaveErrorMessage(error));
            }
            return false;
        } finally {
            this.saving = false;
            this.setSaveBusy(false);
        }
    }

    done() {

        if (!this.session || this.saving || this.confirmingSave) return false;

        this.#invalidatePendingPreview();
        this.session.clearPreview();
        const path = this.sourcePath;

        this.mapView.setEditingTargetSuppressed(path, false);
        this.previewLayers.clear();
        this.interactionGuard.setLocked(false);
        this.draft = {
            path,
            libraryToken: this.getLibraryToken(),
            session: this.session,
            lastSavedMasks: this.lastSavedMasks
        };
        this.session = null;
        this.sourcePath = null;
        this.loading = false;
        this.panel.showDraft(path, {
            saved: this.#isCurrentWorkingSaved(this.draft.session)
        });
        this.panel.focusEditButton();
        return true;
    }

    cancel({ restoreFocus = true } = {}) {

        if (
            this.saving || this.confirmingSave ||
            (!this.session && !this.loading && !this.sourcePath)
        ) return false;

        clearTimeout(this.previewTimer);
        this.#abortPreview();
        this.requestId += 1;
        const path = this.sourcePath;

        this.session?.cancel();
        this.session = null;
        this.sourcePath = null;
        this.loading = false;
        this.lastSavedMasks = null;
        if (path) this.mapView.setEditingTargetSuppressed(path, false);
        this.previewLayers.clear();
        this.interactionGuard.setLocked(false);
        this.panel.clearDraft();
        this.panel.showInactive();
        this.panel.setSelectedTrack(this.selectionState.getSelectedPath());

        if (restoreFocus) this.panel.focusEditButton();
        return true;
    }

    #showWorkingState() {

        const masks = this.session.getRetainedPointMasks();
        const calculated = this.metrics.calculate(this.session.source, masks);

        this.previewLayers.setCandidate(this.session.source, masks);
        this.panel.showApplied(calculated.total, {
            canUndo: this.session.canUndo,
            canRedo: this.session.canRedo
        });
        this.panel.setSaveEnabled(
            this.session.isDirty && this.session.source.canSerialize
        );
    }

    #bindPanel() {

        this.panel.on("edit", () => void this.start());
        this.panel.on("tolerance", value => this.schedulePreview(value));
        this.panel.on("mode", mode => this.previewLayers.setMode(mode));
        this.panel.on(
            "point-mode",
            mode => this.previewLayers.setPointMode(mode)
        );
        this.panel.on("apply", () => this.apply());
        this.panel.on("undo", () => this.undo());
        this.panel.on("redo", () => this.redo());
        this.panel.on("save", () => void this.save());
        this.panel.on("done", () => this.done());
        this.panel.on("cancel", () => this.cancel());
    }

    #bindEvents() {

        this.eventBus.on("selection:changed", ({ path }) => {
            if ((this.session || this.loading) && path !== this.sourcePath) {
                this.cancel({ restoreFocus: false });
            }
            if (
                this.draft &&
                this.draft.libraryToken !== this.getLibraryToken()
            ) {
                this.#discardDraft();
            }
            this.panel.setSelectedTrack(path);
        });
    }

    #abortPreview() {

        this.abortController?.abort();
        this.abortController = null;
    }

    #invalidatePendingPreview() {

        clearTimeout(this.previewTimer);
        this.#abortPreview();
        this.requestId += 1;
    }

    #updateHistory() {

        this.panel.setHistoryState({
            canUndo: Boolean(this.session?.canUndo),
            canRedo: Boolean(this.session?.canRedo)
        });
    }

    #getSaveErrorMessage(error) {

        const messages = {
            PERMISSION_DENIED: "Write permission was denied. The working draft is unchanged.",
            SAVE_CANCELLED: "Save was cancelled. The working draft is unchanged.",
            SOURCE_CHANGED: "The source GPX changed. Reopen it before saving.",
            BACKUP_CHECK_FAILED: "The Backup state could not be checked. The source was not changed.",
            BACKUP_CREATE_FAILED: "The original Backup could not be created. The source was not changed.",
            BACKUP_WRITE_FAILED: "Writing the original Backup failed. The source was not changed.",
            BACKUP_VERIFICATION_FAILED: "The original Backup could not be verified. The source was not changed.",
            SOURCE_WRITE_FAILED: "Writing the edited GPX failed. The Backup is retained for recovery.",
            EDITED_VERIFICATION_FAILED: "Edited GPX verification failed. Restore the original from TrailBook_Backup."
        };

        return messages[error?.code] ||
            "Save failed. The Viewer remains available and the working draft is retained.";
    }

    #emptyProgress() {

        const totalSegments = this.session?.source.tracks.reduce(
            (total, track) => total + track.segments.length,
            0
        ) || 0;

        return { processedSegments: 0, totalSegments };
    }

    #isPreviewCurrent(requestId, session) {

        return requestId === this.requestId &&
            session === this.session &&
            session.isActive;
    }

    #canResumeDraft(path) {

        return this.draft?.path === path &&
            this.draft.libraryToken === this.getLibraryToken() &&
            this.draft.session.isActive;
    }

    #resumeDraft(path) {

        this.session = this.draft.session;
        this.lastSavedMasks = this.draft.lastSavedMasks;
        this.draft = null;
        this.sourcePath = path;
        this.panel.clearDraft();
        this.interactionGuard.setLocked(true);
        this.mapView.setEditingTargetSuppressed(path, true);
        const masks = this.session.getRetainedPointMasks();

        this.previewLayers.setSource(this.session.source);
        this.previewLayers.setCandidate(this.session.source, masks);
        this.previewLayers.setMode(this.panel.getMode());
        this.previewLayers.setPointMode(this.panel.getPointMode());
        this.panel.showReady({
            canSerialize: this.session.source.canSerialize
        });
        this.#showWorkingState();
        return true;
    }

    #discardDraft() {

        this.draft?.session.cancel();
        this.draft = null;
        this.lastSavedMasks = null;
        this.panel.clearDraft();
    }

    #isCurrentWorkingSaved(session = this.session) {

        if (!session || !this.lastSavedMasks) return false;

        const current = session.getRetainedPointMasks();

        return current.every((track, trackIndex) => track.every(
            (segment, segmentIndex) => segment.every(
                (value, pointIndex) =>
                    value === this.lastSavedMasks[trackIndex]?.[segmentIndex]?.[pointIndex]
            )
        ));
    }
}

export { PREVIEW_DEBOUNCE_MS };
