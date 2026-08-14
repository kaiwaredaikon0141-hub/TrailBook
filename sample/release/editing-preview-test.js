import EventBus from "../../src/js/core/EventBus.js";
import TrackEditingCoordinator from "../../src/js/core/TrackEditingCoordinator.js";
import EditingPreviewLayerManager, {
    AFTER_POINT_STYLE,
    AFTER_STYLE,
    BEFORE_POINT_STYLE,
    BEFORE_STYLE
} from "../../src/js/map/EditingPreviewLayerManager.js";
import LayerManager from "../../src/js/map/LayerManager.js";
import TrackSimplificationService from "../../src/js/services/TrackSimplificationService.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import TrackEditingInteractionGuard from "../../src/js/ui/TrackEditingInteractionGuard.js";
import TrackEditingPanel from "../../src/js/ui/TrackEditingPanel.js";
import MapView from "../../src/js/ui/MapView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function point(latitude, longitude) {
    return Object.freeze({ latitude, longitude });
}

function createSource() {
    return Object.freeze({
        canSerialize: true,
        sourceFileName: "trip.gpx",
        tracks: Object.freeze([Object.freeze({
            segments: Object.freeze([
                Object.freeze({
                    points: Object.freeze([
                        point(35, 135),
                        point(35, 135.001),
                        point(35, 135.002)
                    ])
                }),
                Object.freeze({
                    points: Object.freeze([
                        point(36, 136),
                        point(Number.NaN, 136.001),
                        point(36, 136.002)
                    ])
                })
            ])
        })])
    });
}

class PanelFake {

    constructor() {
        this.handlers = new Map();
        this.status = { dataset: {} };
        this.mode = "both";
        this.pointMode = "off";
        this.tolerance = 10;
        this.calls = [];
    }

    on(action, handler) { this.handlers.set(action, handler); }
    attach(container) { this.container = container; }
    setSelectedTrack(path) { this.selectedPath = path; }
    getTolerance() { return this.tolerance; }
    getMode() { return this.mode; }
    getPointMode() { return this.pointMode; }
    getTranslationMode() { return false; }
    showLoading(path) { this.calls.push(["loading", path]); }
    showReady(value) { this.calls.push(["ready", value]); }
    showPreviewing(value) { this.calls.push(["previewing", value]); }
    showPreview(value) { this.calls.push(["preview", value]); }
    showApplied(value) { this.calls.push(["applied", value]); }
    showError(value) { this.calls.push(["error", value]); }
    configureSave(value) { this.saveConfig = value; }
    configureDateCorrection(value) { this.dateConfig = value; }
    configureTranslation(value) { this.translation = value; }
    showDateError(value) { this.calls.push(["date-error", value]); }
    showDateMessage(value) { this.calls.push(["date-message", value]); }
    setSaveEnabled(value) { this.saveEnabled = value; }
    showSaving(value) { this.calls.push(["saving", value]); }
    showSaveSuccess(value) { this.calls.push(["saved", value]); }
    showSaveError(value) { this.calls.push(["save-error", value]); }
    showSaveCancelled() { this.calls.push(["save-cancelled"]); }
    getSaveButton() { return {}; }
    setHistoryState(value) { this.history = value; }
    showInactive() { this.calls.push(["inactive"]); }
    showDraft(path) { this.draftPath = path; this.calls.push(["draft", path]); }
    clearDraft() { this.draftPath = null; }
    focusEditButton() { this.focused = true; }
    emit(action, value) { this.handlers.get(action)?.(value); }
}

class PreviewLayersFake {

    constructor() {
        this.calls = [];
    }

    setSource(source) { this.calls.push(["source", source]); }
    setCandidate(source, masks) {
        this.calls.push(["candidate", source, masks]);
    }
    setTranslationPreviewHandler(handler) { this.translationHandler = handler; }
    setTranslationMode(value) { this.calls.push(["translation-mode", value]); }
    setMode(mode) { this.calls.push(["mode", mode]); }
    setPointMode(mode) { this.calls.push(["point-mode", mode]); }
    clear() { this.calls.push(["clear"]); }
}

class InteractionGuardFake {

    constructor() { this.states = []; }
    setLocked(value) { this.states.push(value); }
}

class MapViewFake {

    constructor() { this.suppression = []; }
    setEditingTargetSuppressed(path, suppressed) {
        this.suppression.push([path, suppressed]);
    }
}

class SaveDialogFake {

    attach() {}
    async confirm(value) { this.value = value; return true; }
}

async function testCoordinatorLifecycle() {
    const eventBus = new EventBus();
    const selectionState = new SelectionState();
    const panel = new PanelFake();
    const previewLayers = new PreviewLayersFake();
    const interactionGuard = new InteractionGuardFake();
    const source = createSource();
    const mapView = new MapViewFake();
    let loadCount = 0;
    const saveBusy = [];
    const saved = [];
    const refreshed = [];

    selectionState.select("trip.gpx", "system");

    const coordinator = new TrackEditingCoordinator({
        eventBus,
        selectionState,
        mapView,
        getLibraryToken: () => "library-a",
        getFileEntry: path => path === "trip.gpx"
            ? {
                path,
                parentPath: "",
                parentFolderHandle: {},
                fileHandle: { name: "trip.gpx" }
            }
            : null,
        sourceLoader: {
            async load(handle, path) {
                loadCount += 1;
                assert(handle.name === "trip.gpx", "wrong FileHandle loaded");
                assert(path === "trip.gpx", "wrong relative path loaded");
                return source;
            }
        },
        simplification: new TrackSimplificationService(),
        dateCorrection: {
            getFirstTrackPointTime() { return new Date("2026-08-08T00:00:00Z"); },
            createDateFileName() { return null; },
            isDateFileName() { return false; },
            calculateOffset(_source, value) {
                assert(value === "2026-09-10", "wrong date correction input");
                return 33 * 24 * 60 * 60 * 1000;
            }
        },
        saveService: {
            async inspectBackup() { return { exists: false }; },
            async save(request) {
                saved.push(request);
                return {
                    fileName: "trip.gpx",
                    fileHandle: { name: "trip.gpx" },
                    source,
                    relativePath: "trip.gpx",
                    backupCreated: true
                };
            }
        },
        saveDialog: new SaveDialogFake(),
        refreshEditedFile: async value => {
            refreshed.push(value);
            return true;
        },
        setSaveBusy: value => saveBusy.push(value),
        panel,
        previewLayers,
        interactionGuard,
        previewDebounceMs: 0
    });

    coordinator.attach({});
    assert(panel.selectedPath === "trip.gpx", "selected Track not projected");
    assert(await coordinator.start(), "explicit Edit did not start session");
    assert(loadCount === 1, "source was loaded more than once");
    assert(interactionGuard.states.join() === "true",
        "selection was not locked while editing");
    assert(mapView.suppression[0].join() === "trip.gpx,true",
        "normal source Track was not suppressed during preview");
    assert(coordinator.session?.isActive, "editing session is not active");
    assert(previewLayers.calls.some(([name]) => name === "source"),
        "Before source layer was not created");
    assert(previewLayers.calls.some(([name]) => name === "candidate"),
        "After preview layer was not created");
    assert(panel.calls.some(([name]) => name === "preview"),
        "initial async preview was not shown");
    assert(panel.calls.some(([name]) => name === "previewing"),
        "preview progress was not shown");

    assert(coordinator.apply(), "Apply did not update working mask");
    assert(coordinator.session.historyLength === 1,
        "Apply did not create exactly one command");
    previewLayers.translationHandler({
        latitudeDelta: 0.1,
        longitudeDelta: 0.2,
        northMeters: 11132,
        eastMeters: 18200
    });
    assert(coordinator.apply(), "translation Apply failed");
    assert(coordinator.session.getTranslation().latitudeDelta === 0.1,
        "translation was not stored in the Session");
    assert(coordinator.done(), "Done rejected translated draft");
    assert(await coordinator.start(), "translated draft could not resume");
    assert(coordinator.session.getTranslation().longitudeDelta === 0.2,
        "Done/resume lost Track translation");
    assert(coordinator.undo(), "Undo failed");
    assert(coordinator.session.canRedo, "Undo did not enable Redo");
    assert(coordinator.redo(), "Redo failed");
    assert(coordinator.session.canUndo, "Redo did not restore Undo state");
    assert(await coordinator.applyDate("2026-09-10"),
        "date correction did not enter the editing history");
    assert(coordinator.session.getTimeOffsetMs() === 33 * 24 * 60 * 60 * 1000,
        "date correction offset was not stored in the Session");

    const saveResult = await coordinator.save();
    assert(saveResult?.refreshSucceeded,
        "verified in-place Save was not refreshed into the Library");
    assert(saved.length === 1 && refreshed.length === 1,
        "Save or Library refresh ran more than once");
    assert(saved[0].timeOffsetMs === 33 * 24 * 60 * 60 * 1000,
        "Save did not receive the Session date offset");
    assert(saved[0].translation.latitudeDelta === 0.1 &&
        saved[0].translation.longitudeDelta === 0.2,
    "Save did not receive the Session Track translation");
    assert(saveBusy.join() === "true,false",
        "Save busy state was not bounded to the operation");
    assert(coordinator.session && !coordinator.session.isDirty,
        "successful Save did not rebase the active session to edited source");

    panel.emit("mode", "before");
    assert(previewLayers.calls.some(call =>
        call[0] === "mode" && call[1] === "before"),
    "Before mode was not forwarded");

    panel.emit("point-mode", "after");
    assert(previewLayers.calls.some(call =>
        call[0] === "point-mode" && call[1] === "after"),
    "After point mode was not forwarded");

    assert(coordinator.done(), "Done did not close active Editor UI");
    assert(coordinator.session === null, "Done left an active UI session");
    assert(coordinator.draft?.session.isActive,
        "Done did not retain the working result in session memory");
    assert(panel.draftPath === "trip.gpx", "Done status did not identify draft");
    assert(mapView.suppression.at(-1).join() === "trip.gpx,false",
        "Done did not restore normal Track presentation");
    assert(await coordinator.start(), "retained draft could not be resumed");
    assert(coordinator.session.historyLength === 0,
        "saved edited source did not become the clean resume baseline");

    assert(coordinator.cancel(), "Cancel did not close editing session");
    assert(coordinator.session === null, "Cancel retained session");
    assert(coordinator.draft === null, "Cancel retained the Done draft");
    assert(interactionGuard.states.join() ===
        "true,false,true,false,true,false",
        "Done / resume / Cancel interaction lock lifecycle is incorrect");
    assert(previewLayers.calls.at(-1)[0] === "clear",
        "Cancel did not remove preview layers");
    assert(panel.focused, "Cancel did not restore Editor focus");
}

async function testSelectionAndSourceGuards() {
    const eventBus = new EventBus();
    const selectionState = new SelectionState();
    const panel = new PanelFake();
    const previewLayers = new PreviewLayersFake();
    const interactionGuard = new InteractionGuardFake();
    const mapView = new MapViewFake();
    const coordinator = new TrackEditingCoordinator({
        eventBus,
        selectionState,
        mapView,
        getFileEntry: () => null,
        sourceLoader: { async load() { throw new Error("unexpected load"); } },
        panel,
        previewLayers,
        interactionGuard
    });

    coordinator.attach({});
    assert(!await coordinator.start(), "Edit started without selection");
    assert(interactionGuard.states.length === 0,
        "missing selection changed interaction state");

    selectionState.select("missing.gpx", "system");
    eventBus.emit("selection:changed", { path: "missing.gpx" });
    assert(panel.selectedPath === "missing.gpx",
        "selection change was not projected to Edit action");
    assert(!await coordinator.start(), "Edit started without FileHandle");
}

async function testPreviewAbort() {
    const eventBus = new EventBus();
    const selectionState = new SelectionState();
    const panel = new PanelFake();
    const source = createSource();
    const mapView = new MapViewFake();
    const signals = [];
    let call = 0;
    let resolvePending = null;
    const service = {
        async createPreview(candidate, tolerance, options) {
            call += 1;
            signals.push(options.signal);
            if (call === 1) {
                return new TrackSimplificationService().createPreview(
                    candidate,
                    tolerance,
                    options
                );
            }
            return new Promise(resolve => { resolvePending = resolve; });
        }
    };

    selectionState.select("trip.gpx", "system");
    const coordinator = new TrackEditingCoordinator({
        eventBus,
        selectionState,
        mapView,
        getFileEntry: () => ({ fileHandle: {} }),
        sourceLoader: { async load() { return source; } },
        simplification: service,
        panel,
        previewLayers: new PreviewLayersFake(),
        interactionGuard: new InteractionGuardFake(),
        previewDebounceMs: 1000
    });

    coordinator.attach({});
    await coordinator.start();
    const pending = coordinator.requestPreview(20);
    await Promise.resolve();
    coordinator.schedulePreview(30);
    assert(signals[1].aborted, "new preview did not abort prior request");
    coordinator.cancel({ restoreFocus: false });
    resolvePending?.(null);
    await pending;
    assert(coordinator.session === null, "stale preview revived cancelled session");
}

function createLeafletFakes() {
    const createdLines = [];
    const displayed = new Set();
    const panes = new Map();
    let draggingEnabled = true;
    const map = {
        getPane: name => panes.get(name) || null,
        createPane(name) {
            const pane = { style: {} };
            panes.set(name, pane);
            return pane;
        },
        hasLayer: group => displayed.has(group),
        getCenter: () => ({ lat: 35, lng: 135 }),
        getZoom: () => 10,
        project: value => ({ x: value.lng * 100, y: -value.lat * 100 }),
        unproject: value => ({ lat: -value.y / 100, lng: value.x / 100 }),
        mouseEventToContainerPoint: event => ({
            x: event.clientX,
            y: event.clientY
        }),
        dragging: {
            enabled: () => draggingEnabled,
            disable: () => { draggingEnabled = false; },
            enable: () => { draggingEnabled = true; }
        }
    };

    globalThis.L = {
        canvas(options = {}) { return { kind: "canvas", options }; },
        layerGroup() {
            return {
                layers: [],
                addTo() { displayed.add(this); return this; },
                remove() { displayed.delete(this); }
            };
        },
        polyline(latLngs, options) {
            const line = {
                latLngs,
                options,
                handlers: {},
                on(name, handler) { this.handlers[name] = handler; return this; },
                setStyle(style) { Object.assign(this.options, style); },
                bringToFront() { this.broughtToFront = true; },
                addTo(group) { group.layers.push(this); return this; }
            };
            createdLines.push(line);
            return line;
        },
        circleMarker(latLng, options) {
            const pointLayer = {
                latLng,
                options,
                isPoint: true,
                addTo(group) { group.layers.push(this); return this; }
            };
            createdLines.push(pointLayer);
            return pointLayer;
        }
    };

    return { map, createdLines, displayed, panes };
}

function testNormalTrackSuppression() {
    const { map, displayed } = createLeafletFakes();
    const clickedPaths = [];
    const manager = new LayerManager(map, {
        trackStyle: {
            selectedWeightOffset: 3,
            outlineWeightOffset: 2
        }
    }, {
        onTrackClick(path) { clickedPaths.push(path); }
    });
    const result = {
        tracks: [{ segments: [{ points: [point(35, 135), point(35, 136)] }] }],
        waypoints: []
    };

    manager.setTrackPresentationVisible("trip.gpx", false);
    manager.displayGPX("trip.gpx", result, {
        color: "#123456",
        weight: 2,
        opacity: 0.55
    });
    assert(displayed.size === 0,
        "late normal Track display bypassed editing suppression");
    manager.setSelectedPath(
        "trip.gpx",
        { color: "#123456", weight: 5, opacity: 1 },
        { color: "#ffffff", weight: 7, opacity: 0.95 }
    );
    assert(displayed.size === 0,
        "selection outline bypassed editing suppression");
    assert(manager.setTrackPresentationVisible("trip.gpx", true),
        "normal Track presentation could not be restored");
    assert(displayed.size === 2,
        "normal Track and outline were not restored together");
    const mainLayer = manager.layers.get("trip.gpx").segments[0].mainLayer;
    assert(mainLayer.options.interactive === true,
        "restored normal Track is not interactive");
    assert(typeof mainLayer.handlers.click === "function",
        "restored normal Track lost its click listener");
    mainLayer.handlers.click({ originalEvent: {} });
    assert(clickedPaths.at(-1) === "trip.gpx",
        "restored normal Track click did not reach selection callback");
    assert(manager.setTrackPresentationVisible("trip.gpx", false),
        "normal Track presentation could not be hidden again");
    assert(displayed.size === 0,
        "normal Track or outline remained visible in After mode");
}

function testPreviewLayers() {
    const { map, createdLines, displayed, panes } = createLeafletFakes();
    const manager = new EditingPreviewLayerManager(map);
    const source = createSource();
    const masks = [[[true, false, true], [true, true, true]]];

    manager.setSource(source);
    manager.setCandidate(source, masks);
    assert(displayed.size === 2, "Both mode did not display two LayerGroups");
    assert(createdLines.some(line => line.options.dashArray === "8 6"),
        "Before layer is not visually distinct");
    assert(createdLines.some(line => line.options.color === AFTER_STYLE.color),
        "After layer style was not applied");
    assert(createdLines.every(line => line.options.interactive === false),
        "preview Polyline became interactive");
    assert(createdLines.every(line => line.options.bubblingMouseEvents === false),
        "preview Polyline bubbles selection clicks");
    assert(BEFORE_STYLE.color !== AFTER_STYLE.color,
        "Before and After styles are indistinguishable");
    assert(panes.get("trailbook-edit-before").style.zIndex === "620",
        "Before pane z-index is incorrect");
    assert(panes.get("trailbook-edit-after").style.zIndex === "630",
        "After pane z-index is incorrect");
    assert([...panes.values()].every(
        pane => pane.style.pointerEvents === "none"
    ), "editing preview pane can intercept normal Map pointer events");
    assert(manager.pointRenderer.options.pane ===
        "trailbook-edit-after-points",
    "point preview renderer was attached to an interactive Map pane");
    assert(manager.setMode("after"), "After mode was rejected");
    assert(displayed.size === 1, "After mode left Before visible");
    assert(!manager.setMode("invalid"), "invalid preview mode was accepted");
    manager.clear();
    assert(displayed.size === 0, "preview clear left layers on Map");
    assert(createdLines.filter(line => !line.isPoint).every(line =>
        line.latLngs.every(
        ([latitude, longitude]) =>
            Number.isFinite(latitude) && Number.isFinite(longitude)
    )), "invalid coordinate reached Leaflet line");

    manager.setSource(source);
    manager.setCandidate(source, masks);
    assert(manager.setPointMode("before"), "Before point mode was rejected");
    const beforePoints = createdLines.filter(line =>
        line.isPoint && line.options.fillColor === "#ffffff");
    assert(beforePoints.length === 5,
        "Before point mode did not show all valid source points");
    assert(manager.setPointMode("after"), "After point mode was rejected");
    const afterPoints = createdLines.filter(line =>
        line.isPoint && line.options.fillColor === "#f97316");
    assert(afterPoints.length === 4,
        "After point mode did not show retained valid points only");
    assert(BEFORE_POINT_STYLE.radius === 4,
        "Before point marker radius is not the accepted visible size");
    assert(AFTER_POINT_STYLE.radius === 5.5,
        "After point marker radius is not the accepted visible size");
    assert(AFTER_POINT_STYLE.radius > BEFORE_POINT_STYLE.radius,
        "After points are not larger than Before points");
    assert(beforePoints.every(layer =>
        layer.options.radius === BEFORE_POINT_STYLE.radius),
    "Before point marker did not receive the shared style radius");
    assert(afterPoints.every(layer =>
        layer.options.radius === AFTER_POINT_STYLE.radius),
    "After point marker did not receive the shared style radius");
    assert(afterPoints.every(layer => layer.options.renderer.kind === "canvas"),
        "point preview does not share Canvas renderer");
    assert(!manager.setPointMode("invalid"), "invalid point mode was accepted");
    let translated = null;

    manager.setTranslationPreviewHandler(value => { translated = value; });
    assert(manager.setTranslationMode(true), "Track translation mode rejected");
    assert(panes.get("trailbook-edit-after").style.pointerEvents === "auto",
        "translation mode did not enable After Track hit testing");
    const draggable = createdLines.findLast(line =>
        !line.isPoint && line.options.interactive);

    assert(typeof draggable?.handlers.mousedown === "function",
        "interactive After Track has no drag handler");
    draggable.handlers.mousedown({
        originalEvent: {
            clientX: 10,
            clientY: 10,
            preventDefault() {},
            stopPropagation() {}
        }
    });
    document.dispatchEvent(new MouseEvent("mousemove", {
        clientX: 110,
        clientY: -40
    }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    assert(translated?.latitudeDelta === 0.5 &&
        translated?.longitudeDelta === 1,
    "drag did not use project/unproject translation");
    manager.setTranslationMode(false);
    assert(panes.get("trailbook-edit-after").style.pointerEvents === "none",
        "translation mode left After Track interactive");
    manager.clear();
    assert(displayed.size === 0, "point preview clear left layers on Map");
}

function testPanelAccessibility() {
    const panel = new TrackEditingPanel();
    const host = document.createElement("div");
    let editCount = 0;
    let saveCount = 0;
    let appliedDate = null;
    let translationMode = null;

    panel.on("edit", () => { editCount += 1; });
    panel.on("save", () => { saveCount += 1; });
    panel.on("date-apply", value => { appliedDate = value; });
    panel.on("translation-mode", value => { translationMode = value; });
    panel.attach(host);
    panel.setSelectedTrack("trip.gpx");
    assert(!panel.editButton.disabled, "selected Track did not enable Edit");
    panel.editButton.click();
    assert(editCount === 1, "keyboard-capable native Edit button not wired");
    panel.showLoading("trip.gpx");
    assert(!panel.actionButtons.get("cancel").disabled,
        "Cancel unavailable during source load");
    panel.showReady();
    assert(!panel.toleranceInput.disabled, "tolerance stayed disabled");
    panel.configureSave({ canSerialize: true });
    assert(panel.backupStatus.textContent.includes("TrailBook_Backup"),
        "first-save Backup policy was not shown");
    panel.configureDateCorrection({
        sourceStartTime: new Date(2026, 7, 8, 12, 34, 56),
        timeOffsetMs: 0
    });
    assert(panel.dateInput.value === "2026-08-08" &&
        !panel.actionButtons.get("date-apply").disabled,
        "valid Track time did not enable date correction");
    panel.dateInput.value = "2026-09-10";
    panel.actionButtons.get("date-apply").click();
    assert(appliedDate === "2026-09-10",
        "date correction action did not emit the input value");
    panel.configureDateCorrection({ sourceStartTime: null });
    assert(panel.actionButtons.get("date-apply").disabled &&
        panel.dateStatus.textContent.includes("修正できません"),
        "missing Track time did not disable date correction");
    panel.showPreview({
        sourcePointCount: 3,
        retainedPointCount: 2,
        reductionRatio: 1 / 3,
        sourceDistanceMeters: 200,
        simplifiedDistanceMeters: 190,
        distanceDifferenceMeters: -10,
        maxDeviationMeters: 4
    });
    assert(!panel.actionButtons.get("apply").disabled,
        "completed preview did not enable Apply");
    panel.configureTranslation({ northMeters: 0, eastMeters: 0 });
    assert(panel.actionButtons.get("apply").disabled,
        "zero translation enabled Apply");
    panel.translationMode.checked = true;
    panel.translationMode.dispatchEvent(new Event("change", { bubbles: true }));
    assert(translationMode === true,
        "translation mode checkbox did not emit its state");
    panel.configureTranslation({
        northMeters: -12.3,
        eastMeters: 45.6,
        pending: true
    });
    assert(!panel.actionButtons.get("apply").disabled &&
        panel.translationNorth.textContent.includes("南") &&
        panel.translationEast.textContent.includes("東"),
    "translation amount/status was not presented");
    assert(panel.status.getAttribute("role") === "status",
        "Editor status lacks status role");
    assert(panel.status.getAttribute("aria-live") === "polite",
        "Editor status is not announced politely");
    assert(panel.progress.getAttribute("aria-label") === "Preview progress",
        "Editor progress has no accessible name");
    assert(panel.metrics.get("points").textContent.includes("3"),
        "point metrics were not displayed");
    assert(panel.metrics.get("reduction").textContent === "33.3%",
        "reduction metric format is incorrect");
    assert(panel.actionButtons.get("done").textContent.includes("編集終了"),
        "Done and Cancel semantics are not labeled distinctly");
    assert(panel.actionButtons.get("cancel").textContent.includes("破棄"),
        "Cancel does not state that it discards the draft");
    panel.showDraft("trip.gpx");
    assert(!panel.editButton.disabled,
        "Done draft left the Edit button disabled");
    assert(panel.editButton.textContent === "編集を再開",
        "Done draft does not expose the resume action");
    panel.body.hidden = false;
    panel.setSaveEnabled(true);
    assert(!panel.actionButtons.get("save").disabled,
        "Save button did not become available for a dirty serializable session");
    panel.actionButtons.get("save").click();
    assert(saveCount === 1, "Save did not emit the explicit action");
    panel.showSaving("trip.gpx", { backupExists: false });
    assert(panel.actionButtons.get("save").disabled &&
        panel.actionButtons.get("cancel").disabled,
    "saving did not suppress duplicate Save and lifecycle actions");
    panel.showSaveError("collision");
    assert(!panel.actionButtons.get("save").disabled,
        "Save failure did not keep the working draft retryable");
}

function testInteractionGuard() {
    const selectionStates = [];
    const root = document.createElement("div");
    const guard = new TrackEditingInteractionGuard({
        setSelectionInteractionEnabled(value) {
            selectionStates.push(value);
        }
    }, root);

    assert(guard.setLocked(true) === true,
        "editing guard did not report active state");
    assert(guard.locked, "editing guard active state was not retained");
    assert(root.inert, "selection root was not made inert");
    assert(root.classList.contains("is-editing-locked"),
        "selection root has no locked presentation");
    assert(root.hasAttribute("inert"),
        "selection root inert attribute was not applied");
    assert(root.getAttribute("aria-disabled") === "true",
        "selection lock is not exposed to accessibility APIs");
    assert(selectionStates.at(-1) === false,
        "Map selection remained enabled while editing");
    assert(guard.setLocked(false) === false,
        "editing guard did not report inactive state after Done");
    assert(!guard.locked, "editing guard remained active after Done");
    assert(!root.inert, "selection root remained inert after Cancel");
    assert(!root.classList.contains("is-editing-locked"),
        "locked presentation remained after Cancel");
    assert(!root.hasAttribute("inert"),
        "selection root inert attribute remained after Done / Cancel");
    assert(!root.hasAttribute("aria-disabled"),
        "selection root accessibility lock remained after Done / Cancel");
    assert(root.style.cursor === "" && root.style.pointerEvents === "",
        "editing guard left cursor or pointer style behind");
    assert(selectionStates.at(-1) === true,
        "Map selection was not restored after Cancel");
}

function testMapSelectionInteractionLifecycle() {
    const eventBus = new EventBus();
    const mapView = new MapView({ map: {} }, eventBus);
    let backgroundClicks = 0;

    eventBus.on("map:background-clicked", () => { backgroundClicks += 1; });
    assert(mapView.setSelectionInteractionEnabled(false) === false,
        "Map selection lock did not report disabled state");
    mapView.handleMapClick();
    assert(backgroundClicks === 0,
        "Map background selection fired while editing");
    assert(mapView.setSelectionInteractionEnabled(true) === true,
        "Map selection unlock did not report enabled state");
    mapView.handleMapClick();
    assert(backgroundClicks === 1,
        "Map background selection did not recover after Done");
}

async function run() {
    await testCoordinatorLifecycle();
    await testSelectionAndSourceGuards();
    await testPreviewAbort();
    testPreviewLayers();
    testNormalTrackSuppression();
    testPanelAccessibility();
    testInteractionGuard();
    testMapSelectionInteractionLifecycle();
    output.textContent = `PASS: ${assertions} assertions`;
}

run().catch(error => {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
});
