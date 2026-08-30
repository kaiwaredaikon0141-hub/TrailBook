import EditingPreviewLayerManager from "../map/EditingPreviewLayerManager.js";
import GPXEditingSession from "../models/GPXEditingSession.js";
import GPXEditingSourceLoader from "../services/GPXEditingSourceLoader.js";
import GPXEditingSaveService from "../services/GPXEditingSaveService.js";
import TrackDateCorrectionService from "../services/TrackDateCorrectionService.js";
import TrackSimplificationMetrics from "../services/TrackSimplificationMetrics.js";
import TrackSimplificationService from "../services/TrackSimplificationService.js";
import TrackPointEditingService from "../services/TrackPointEditingService.js";
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
        resolveEditableEntry = async path => getFileEntry(path),
        getLibraryToken = () => null,
        getAvailabilityContext = () => ({}),
        subscribeAvailabilityChanges = () => () => {},
        refreshEditedFile = async () => true,
        setSaveBusy = () => {},
        isExternalBusy = () => false,
        interactionRoot = null,
        sourceLoader = new GPXEditingSourceLoader(),
        saveService = new GPXEditingSaveService(),
        saveDialog = new GPXEditingSaveDialog(),
        dateCorrection = new TrackDateCorrectionService(),
        pointEditing = new TrackPointEditingService(),
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
        this.resolveEditableEntry = resolveEditableEntry;
        this.getLibraryToken = getLibraryToken;
        this.getAvailabilityContext = getAvailabilityContext;
        this.subscribeAvailabilityChanges = subscribeAvailabilityChanges;
        this.refreshEditedFile = refreshEditedFile;
        this.setSaveBusy = setSaveBusy;
        this.isExternalBusy = isExternalBusy;
        this.interactionGuard = interactionGuard;
        this.sourceLoader = sourceLoader;
        this.saveService = saveService;
        this.saveDialog = saveDialog;
        this.dateCorrection = dateCorrection;
        this.pointEditing = pointEditing;
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
        this.fileNameCandidate = null;
        this.fileNameCandidateOffsetMs = null;
        this.pointEditingPreviousPreviewMode = null;
        this.pointAddMode = false;
        this.editabilityRequestId = 0;
        this.editableEntry = null;
        this.editablePath = null;
        this.previewLayers.setTranslationPreviewHandler?.(
            translation => this.#handleTranslationPreview(translation)
        );
        this.previewLayers.setPointSelectionHandler?.(
            identity => this.#configurePointEditing(identity)
        );
        this.previewLayers.setPointEditHandler?.(
            (identity, coordinate) => this.#handlePointEdit(identity, coordinate)
        );
        this.previewLayers.setPointAddHandler?.(
            candidate => this.#handlePointAdd(candidate)
        );
        this.previewLayers.setPointDeleteHandler?.(
            identity => this.#deletePoint(identity)
        );
    }

    attach(container) {

        this.panel.attach(container);
        this.saveDialog.attach(container);
        this.panel.setSelectedTrack(this.selectionState.getSelectedPath());
        this.#bindPanel();
        this.#bindEvents();
        void this.#refreshEditingAvailability("startup");
        this.unsubscribeAvailabilityChanges =
            this.subscribeAvailabilityChanges((state = {}, context = {}) => {
                const trigger = context.reason === "hydrated"
                    ? "permission-hydrated"
                    : "permission-changed";

                void this.#refreshEditingAvailability(trigger);
            });
    }

    async start() {

        if (
            this.session || this.loading || this.saving || this.confirmingSave ||
            this.isExternalBusy()
        ) return false;

        const path = this.selectionState.getSelectedPath();
        if (!this.#getEditableEntry(path)) {
            await this.#refreshEditingAvailability("edit-request");
        }
        const entry = this.#getEditableEntry(path);

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

            const candidateFileName = this.dateCorrection.createDateFileName(source);
            const resolvedCandidate = candidateFileName
                ? await this.#resolveDateFileName(
                    candidateFileName,
                    source.sourceFileName,
                    entry.parentFolderHandle
                )
                : null;

            if (requestId !== this.requestId || this.sourcePath !== path) {
                return false;
            }
            const defaultRename = Boolean(candidateFileName) &&
                !this.dateCorrection.isDateFileName(source.sourceFileName);

            this.session = new GPXEditingSession(source, {
                desiredFileName: defaultRename
                    ? resolvedCandidate
                    : source.sourceFileName
            });
            this.fileNameCandidate = resolvedCandidate;
            this.fileNameCandidateOffsetMs = 0;
            this.mapView.setEditingTargetSuppressed(path, true);
            this.previewLayers.setMap?.(this.mapView.map);
            this.previewLayers.setSource(source);
            this.previewLayers.setCandidate(
                source,
                this.session.getRetainedPointMasks(),
                this.session.getTranslation(),
                this.session.getPointEdits(),
                this.session.getDeletedPoints(),
                this.session.getAddedPoints()
            );
            this.previewLayers.setMode(this.panel.getMode());
            this.previewLayers.setPointMode(this.panel.getPointMode());
            this.previewLayers.setTranslationMode?.(
                this.panel.getTranslationMode?.()
            );
            this.previewLayers.setPointEditingMode?.(
                this.panel.getPointEditingMode?.()
            );
            this.#configureTranslation();
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
            this.#configureDateCorrection();
            this.#configureFileName();
            this.#configurePointEditing();
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

    isBusy() {

        return Boolean(
            this.session || this.loading || this.saving || this.confirmingSave
        );
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
        session.clearSimplificationPreview();
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
                preview.retainedPointMasks,
                session.getTranslationPreview() || session.getTranslation(),
                session.getPointEdits(),
                session.getDeletedPoints(),
                session.getAddedPoints()
            );
            this.panel.showPreview(preview.metrics);
            this.panel.setSaveEnabled(
                session.isDirty && session.source.canSerialize
            );
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

    async applyDate(dateText) {

        if (this.saving || !this.session?.isActive) return false;

        const session = this.session;
        const sourcePath = this.sourcePath;

        try {
            const offsetMs = this.dateCorrection.calculateOffset(
                session.source,
                dateText
            );

            const candidate = this.dateCorrection.createDateFileName(
                session.source,
                offsetMs
            );
            const renameEnabled = this.panel.isDateRenameEnabled?.();

            this.panel.updateFileNameCandidate?.(candidate, renameEnabled);
            const entry = this.#getEditableEntry(this.sourcePath);
            const resolvedCandidate = candidate
                ? await this.#resolveDateFileName(
                    candidate,
                    session.source.sourceFileName,
                    entry?.parentFolderHandle
                )
                : null;
            if (this.session !== session || this.sourcePath !== sourcePath) {
                return false;
            }
            const desiredFileName = renameEnabled
                ? resolvedCandidate
                : session.source.sourceFileName;

            this.fileNameCandidate = resolvedCandidate;
            this.fileNameCandidateOffsetMs = offsetMs;

            if (!session.applyDateOffset(offsetMs, desiredFileName)) {
                this.panel.showDateMessage?.("指定日は現在の開始日と同じです。");
                return false;
            }

            this.#invalidatePendingPreview();
            this.#showWorkingState();
            return true;
        } catch (error) {
            this.panel.showDateError?.(
                error?.message || "日付を適用できませんでした。"
            );
            return false;
        }
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
        const entry = this.#getEditableEntry(sourcePath);

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
                targetPath: this.#targetPath(
                    sourcePath,
                    session.getDesiredFileName()
                ),
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
                timeOffsetMs: session.getTimeOffsetMs(),
                translation: session.getTranslation(),
                pointEdits: session.getPointEdits(),
                deletedPoints: session.getDeletedPoints(),
                addedPoints: session.getAddedPoints(),
                desiredFileName: session.getDesiredFileName(),
                directoryHandle: entry.parentFolderHandle,
                relativePath: sourcePath
            });
            let refreshSucceeded = false;

            try {
                refreshSucceeded = Boolean(await this.refreshEditedFile({
                    sourcePath,
                    targetPath: saved.relativePath,
                    fileHandle: saved.fileHandle
                }));
            } catch {
                refreshSucceeded = false;
            }

            if (this.session === session) {
                if (saved.relativePath !== sourcePath) {
                    this.mapView.setEditingTargetSuppressed(sourcePath, false);
                    this.mapView.setEditingTargetSuppressed(
                        saved.relativePath,
                        true
                    );
                }
                this.sourcePath = saved.relativePath;
                this.editablePath = saved.relativePath;
                this.editableEntry = {
                    path: saved.relativePath,
                    relativePath: saved.relativePath,
                    parentPath: entry.parentPath,
                    parentFolderHandle: entry.parentFolderHandle,
                    fileHandle: saved.fileHandle
                };
                this.session = new GPXEditingSession(saved.source);
                this.lastSavedMasks = this.session.getRetainedPointMasks();
                this.previewLayers.setSource(saved.source);
                this.previewLayers.setCandidate(
                    saved.source,
                    this.lastSavedMasks,
                    this.session.getTranslation(),
                    this.session.getPointEdits(),
                    this.session.getDeletedPoints(),
                    this.session.getAddedPoints()
                );
                this.#showWorkingState();
                this.panel.showSaveSuccess(saved.fileName, {
                    refreshSucceeded,
                    backupCreated: saved.backupCreated,
                    cleanupWarning: saved.cleanupWarning
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
        this.pointAddMode = false;
        this.previewLayers.clear();
        this.#restorePointEditingPreviewMode();
        this.panel.configurePointEditing?.({ enabled: false });
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
        this.pointAddMode = false;
        this.previewLayers.clear();
        this.#restorePointEditingPreviewMode();
        this.panel.configurePointEditing?.({ enabled: false });
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

        this.previewLayers.setMap?.(this.mapView.map);
        this.previewLayers.setCandidate(
            this.session.source,
            masks,
            this.session.getTranslation(),
            this.session.getPointEdits(),
            this.session.getDeletedPoints(),
            this.session.getAddedPoints()
        );
        this.panel.showApplied(calculated.total, {
            canUndo: this.session.canUndo,
            canRedo: this.session.canRedo
        });
        this.panel.setSaveEnabled(
            this.session.isDirty && this.session.source.canSerialize
        );
        this.#configureDateCorrection();
        this.#configureFileName();
        this.#configureTranslation();
        this.#configurePointEditing();
    }

    #bindPanel() {

        this.panel.on("edit", () => void this.start());
        this.panel.on("tolerance", value => this.schedulePreview(value));
        this.panel.on("mode", mode => this.previewLayers.setMode(mode));
        this.panel.on(
            "point-mode",
            mode => this.previewLayers.setPointMode(mode)
        );
        this.panel.on("translation-mode", enabled => {
            if (enabled) {
                this.#setPointEditingMode(false);
                this.panel.configurePointEditing?.({ enabled: false });
            }
            this.previewLayers.setTranslationMode?.(enabled);
        });
        this.panel.on("point-editing-mode", enabled => {
            this.#setPointEditingMode(enabled);
        });
        this.panel.on("point-selection-clear", () => {
            this.previewLayers.clearPointSelection?.();
        });
        this.panel.on("point-add-mode", enabled => {
            this.pointAddMode = Boolean(enabled) &&
                Boolean(this.previewLayers.pointEditingMode);
            this.previewLayers.setPointAddMode?.(this.pointAddMode);
            this.#configurePointEditing();
        });
        this.panel.on("point-delete", () => this.#deleteSelectedPoint());
        this.panel.on("apply", () => this.apply());
        this.panel.on("undo", () => this.undo());
        this.panel.on("redo", () => this.redo());
        this.panel.on("date-apply", value => void this.applyDate(value));
        this.panel.on("filename-toggle", checked => {
            void this.#applyFileNameToggle(checked);
        });
        this.panel.on("save", () => void this.save());
        this.panel.on("done", () => this.done());
        this.panel.on("cancel", () => this.cancel());
    }

    #bindEvents() {

        this.eventBus.on("library:provisional-state-changed", ({ provisional }) => {
            void this.#refreshEditingAvailability("provisional-changed");
        });
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
            void this.#refreshEditingAvailability("selected-track-changed");
        });
    }

    async #refreshEditingAvailability(reason) {

        const requestId = ++this.editabilityRequestId;
        const selectedPath = this.selectionState.getSelectedPath();
        const context = this.getAvailabilityContext(selectedPath) || {};
        const mobile = Boolean(context.mobile);
        const permission = context.permission || "unknown";
        let entry = null;

        if (!this.session && !this.loading) {
            this.editableEntry = null;
            this.editablePath = null;
        }
        this.panel.setEditingAvailable?.(false);

        if (
            !mobile && selectedPath && context.directoryHandle &&
            permission === "granted"
        ) {
            entry = await this.resolveEditableEntry(
                selectedPath,
                context.directoryHandle
            );
        }

        if (
            requestId !== this.editabilityRequestId ||
            selectedPath !== this.selectionState.getSelectedPath()
        ) {
            return false;
        }

        const writeCapability = Boolean(
            entry?.fileHandle &&
            typeof entry.fileHandle.createWritable === "function"
        );
        const editingAvailable = !mobile && Boolean(selectedPath) &&
            permission === "granted" && Boolean(context.directoryHandle) &&
            Boolean(entry?.fileHandle) && writeCapability;

        if (editingAvailable) {
            this.editableEntry = entry;
            this.editablePath = selectedPath;
        } else if (!this.session && !this.loading) {
            this.editableEntry = null;
            this.editablePath = null;
        }
        this.panel.setEditingAvailable?.(editingAvailable);
        return editingAvailable;
    }

    #getEditableEntry(path) {

        return path && path === this.editablePath ? this.editableEntry : null;
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
            BACKUP_INDEX_READ_FAILED: "The Backup association could not be read. The source was not changed.",
            BACKUP_INDEX_WRITE_FAILED: "The Backup association could not be saved. The old source was retained.",
            BACKUP_INDEX_VERIFICATION_FAILED: "The Backup association could not be verified. The old source was retained.",
            FILENAME_COLLISION: "An available date filename could not be found. The old source was retained.",
            INVALID_TARGET_FILENAME: "The date filename is invalid. The old source was retained.",
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

        this.previewLayers.setMap?.(this.mapView.map);
        this.previewLayers.setSource(this.session.source);
        this.previewLayers.setCandidate(
            this.session.source,
            masks,
            this.session.getTranslation(),
            this.session.getPointEdits(),
            this.session.getDeletedPoints(),
            this.session.getAddedPoints()
        );
        this.previewLayers.setMode(this.panel.getMode());
        this.previewLayers.setPointMode(this.panel.getPointMode());
        this.previewLayers.setTranslationMode?.(
            this.panel.getTranslationMode?.()
        );
        this.previewLayers.setPointEditingMode?.(
            this.panel.getPointEditingMode?.()
        );
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

        if (
            !session || !this.lastSavedMasks ||
            session.getTimeOffsetMs() !== 0 ||
            session.getDesiredFileName() !== session.source.sourceFileName ||
            Math.abs(session.getTranslation().latitudeDelta) >= 1e-12 ||
            Math.abs(session.getTranslation().longitudeDelta) >= 1e-12 ||
            session.getPointEdits().length > 0 ||
            session.getDeletedPoints().length > 0 ||
            session.getAddedPoints().length > 0
        ) return false;

        const current = session.getRetainedPointMasks();

        return current.every((track, trackIndex) => track.every(
            (segment, segmentIndex) => segment.every(
                (value, pointIndex) =>
                    value === this.lastSavedMasks[trackIndex]?.[segmentIndex]?.[pointIndex]
            )
        ));
    }

    #configureDateCorrection() {

        if (!this.session || !this.panel.configureDateCorrection) return;

        this.panel.configureDateCorrection({
            sourceStartTime: this.dateCorrection.getFirstTrackPointTime(
                this.session.source
            ),
            timeOffsetMs: this.session.getTimeOffsetMs()
        });
    }

    #targetPath(sourcePath, fileName) {

        const separator = sourcePath.lastIndexOf("/");

        return separator < 0
            ? fileName
            : `${sourcePath.slice(0, separator + 1)}${fileName}`;
    }

    #configureFileName() {

        if (!this.session || !this.panel.configureFileName) return;

        const sourceFileName = this.session.source.sourceFileName;
        const generatedCandidate = this.dateCorrection.createDateFileName(
            this.session.source,
            this.session.getTimeOffsetMs()
        );
        const desired = this.session.getDesiredFileName();
        const candidate = desired !== sourceFileName
            ? desired
            : this.fileNameCandidateOffsetMs === this.session.getTimeOffsetMs()
                ? this.fileNameCandidate
                : generatedCandidate;

        this.panel.configureFileName({
            currentFileName: sourceFileName,
            candidateFileName: candidate,
            renameEnabled: Boolean(candidate),
            defaultRename: Boolean(candidate) &&
                this.session.getDesiredFileName() !== sourceFileName
        });
    }

    async #applyFileNameToggle(checked) {

        if (this.saving || !this.session?.isActive) return false;

        const session = this.session;
        const sourcePath = this.sourcePath;

        const candidate = this.dateCorrection.createDateFileName(
            session.source,
            session.getTimeOffsetMs()
        );
        this.panel.updateFileNameCandidate?.(candidate, checked);
        const entry = this.#getEditableEntry(this.sourcePath);
        const resolvedCandidate = checked && candidate
            ? await this.#resolveDateFileName(
                candidate,
                session.source.sourceFileName,
                entry?.parentFolderHandle
            )
            : candidate;
        if (this.session !== session || this.sourcePath !== sourcePath) {
            return false;
        }
        const desiredFileName = checked && resolvedCandidate
            ? resolvedCandidate
            : session.source.sourceFileName;

        this.fileNameCandidate = resolvedCandidate;
        this.fileNameCandidateOffsetMs = session.getTimeOffsetMs();

        if (!session.applyDesiredFileName(desiredFileName)) return false;

        this.#invalidatePendingPreview();
        this.#showWorkingState();
        return true;
    }

    async #resolveDateFileName(candidate, sourceFileName, directoryHandle) {

        try {
            return await this.saveService.resolveTargetFileName(
                directoryHandle,
                sourceFileName,
                candidate
            );
        } catch {
            // Explicit Save performs the authoritative collision check.
            return candidate;
        }
    }

    #handleTranslationPreview(translation) {

        if (!this.session?.isActive || this.saving) return;

        const pending = this.session.setTranslationPreview(translation);

        this.panel.configureTranslation?.({
            ...translation,
            pending,
            canApply: pending || Boolean(this.session.getPreview())
        });
        this.panel.setSaveEnabled(
            this.session.isDirty && this.session.source.canSerialize
        );
    }

    #setPointEditingMode(enabled) {

        if (!this.session?.isActive || this.saving) return false;

        const next = Boolean(enabled);

        if (!next) this.pointAddMode = false;

        if (next) {
            if (this.pointEditingPreviousPreviewMode === null) {
                this.pointEditingPreviousPreviewMode = this.panel.getMode();
            }
            this.#invalidatePendingPreview();
            this.previewLayers.setTranslationMode?.(false);
            this.panel.setTranslationMode?.(false);
            this.panel.setMode?.("after");
            this.panel.setModeDisabled?.(true);
            this.previewLayers.setMode("after");
        }

        this.previewLayers.setPointEditingMode?.(next);
        this.previewLayers.setPointAddMode?.(next && this.pointAddMode);
        if (!next) this.#restorePointEditingPreviewMode();
        this.#configurePointEditing();
        return true;
    }

    #restorePointEditingPreviewMode() {

        const mode = this.pointEditingPreviousPreviewMode;

        this.panel.setModeDisabled?.(false);
        if (mode === null) return;

        this.panel.setMode?.(mode);
        this.previewLayers.setMode(mode);
        this.pointEditingPreviousPreviewMode = null;
    }

    #handlePointEdit(identity, displayedCoordinate) {

        if (!this.session?.isActive || this.saving) return false;

        try {
            const sourceCoordinate = this.pointEditing.toSourceCoordinate(
                displayedCoordinate,
                this.session.getTranslation()
            );

            if (!this.session.applyPointEdit(identity, sourceCoordinate)) {
                this.#showWorkingState();
                return false;
            }

            this.#invalidatePendingPreview();
            this.#showWorkingState();
            return true;
        } catch {
            this.#showWorkingState();
            return false;
        }
    }

    #handlePointAdd(candidate) {

        if (!this.session?.isActive || this.saving) return null;

        try {
            const coordinate = this.pointEditing.toSourceCoordinate(
                candidate,
                this.session.getTranslation()
            );
            const added = this.session.addPoint({ ...candidate, ...coordinate });

            this.#invalidatePendingPreview();
            this.#showWorkingState();
            return added;
        } catch {
            this.#showWorkingState();
            return null;
        }
    }

    #deleteSelectedPoint() {

        const selected = this.previewLayers.pointSelection;

        return this.#deletePoint(selected);
    }

    #deletePoint(identity) {

        if (!this.session?.isActive || !identity || this.saving) return false;
        if (!this.session.deletePoint(identity)) {
            this.#configurePointEditing(identity);
            return false;
        }

        this.previewLayers.clearPointSelection?.();
        this.#invalidatePendingPreview();
        this.#showWorkingState();
        return true;
    }

    #configurePointEditing(identity = this.previewLayers.pointSelection) {

        const enabled = Boolean(this.previewLayers.pointEditingMode);
        const addMode = enabled && this.pointAddMode;
        let canDelete = false;

        if (enabled && identity && this.session?.isActive) {
            try {
                canDelete = this.session.canDeletePoint(identity);
            } catch {
                canDelete = false;
            }
        }

        this.previewLayers.setPointAddMode?.(addMode);
        this.panel.configurePointEditing?.({
            enabled,
            selected: enabled ? identity : null,
            canDelete,
            addMode
        });
    }

    #configureTranslation() {

        if (!this.session || !this.panel.configureTranslation) return;

        const translation = this.session.getTranslationPreview() ||
            this.session.getTranslation();

        this.panel.configureTranslation({
            ...translation,
            pending: Boolean(this.session.getTranslationPreview()),
            canApply: this.session.hasPreview
        });
    }
}

export { PREVIEW_DEBOUNCE_MS };
