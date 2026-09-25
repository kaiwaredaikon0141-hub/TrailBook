import Config from "../../src/js/core/Config.js";
import DisplaySnapshotCoordinator from
    "../../src/js/core/DisplaySnapshotCoordinator.js";
import LibrarySettingsCoordinator from
    "../../src/js/core/LibrarySettingsCoordinator.js";
import PreviousLibraryCoordinator from
    "../../src/js/core/PreviousLibraryCoordinator.js";
import ViewStateCoordinator from "../../src/js/core/ViewStateCoordinator.js";
import FileListDirectorySource from
    "../../src/js/services/FileListDirectorySource.js";
import { getFolderPickerSupport } from
    "../../src/js/services/FolderScanner.js";
import GPXLoader from "../../src/js/services/GPXLoader.js";
import LibrarySettingsRepository from
    "../../src/js/services/LibrarySettingsRepository.js";
import LibraryAccessPanel from "../../src/js/ui/LibraryAccessPanel.js";
import Toolbar from "../../src/js/ui/Toolbar.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function file(path, content = "", options = {}) {
    const name = path.replaceAll("\\", "/").split("/").at(-1);
    const value = new File([content], name, options);

    Object.defineProperty(value, "webkitRelativePath", { value: path });
    return value;
}

async function rejects(operation, name, message) {
    let error = null;
    try { await operation(); } catch (candidate) { error = candidate; }
    assert(error?.name === name, message);
}

function collectFiles(folder, parentPath = "", result = []) {
    folder.gpxFiles.forEach(handle => result.push({
        path: parentPath ? `${parentPath}/${handle.name}` : handle.name,
        handle
    }));
    folder.folders.forEach(child => collectFiles(
        child,
        parentPath ? `${parentPath}/${child.name}` : child.name,
        result
    ));
    return result;
}

function supportWindow({ directoryHandle = false, fileList = false } = {}) {
    const inputPrototype = fileList ? { webkitdirectory: false } : {};

    return {
        isSecureContext: true,
        location: { protocol: "https:", hostname: "example.test" },
        navigator: { userAgent: "test" },
        document: { createElement: () => Object.create(inputPrototype) },
        ...(directoryHandle ? { showDirectoryPicker() {} } : {})
    };
}

function testCapabilityRouting() {
    const directory = getFolderPickerSupport(supportWindow({
        directoryHandle: true,
        fileList: true
    }));
    const fallback = getFolderPickerSupport(supportWindow({ fileList: true }));
    const unsupported = getFolderPickerSupport(supportWindow());

    assert(directory.available && directory.mode === "directory-handle",
        "showDirectoryPicker did not retain priority");
    assert(fallback.available && fallback.mode === "file-list" &&
        fallback.hasFileListDirectoryPicker,
    "webkitdirectory fallback was not selected");
    assert(!unsupported.available && unsupported.mode === "unsupported" &&
        unsupported.reason === "missing-api",
    "unsupported environment became selectable");
}

async function testFileListSource() {
    const source = new FileListDirectorySource({
        createSessionId: () => "fixture"
    });
    const settings = JSON.stringify({
        schemaVersion: 1,
        settings: { folderColors: { A: "#8F8300" } }
    });
    const library = await source.scan([
        file("GPX/root.gpx", "<gpx></gpx>", { lastModified: 30 }),
        file("GPX/A/same.gpx", "<gpx></gpx>", { lastModified: 20 }),
        file("GPX/B/same.gpx", "<gpx></gpx>", { lastModified: 10 }),
        file("GPX/A\\nested\\slash.gpx", "<gpx></gpx>"),
        file("GPX/trailbook.json", settings),
        file("GPX/notes/readme.txt", "ignored"),
        file("GPX/TrailBook_Backup/hidden.gpx", "<gpx></gpx>")
    ]);
    const entries = collectFiles(library.rootFolder);

    assert(library.name === "GPX" && library.sourceType === "file-list" &&
        library.readOnly && library.capabilities.persistent === false &&
        library.capabilities.refreshMode === "reselect" &&
        library.capabilities.sharedSettingsWritable === false,
    "FileList source capabilities changed");
    assert(library.identityName === "file-list-session-fixture" &&
        library.cacheNamespace === "file-list-session:fixture",
    "session identity is not stable within the selection");
    assert(entries.length === 4 && entries.map(entry => entry.path).join("|") ===
        "root.gpx|A/same.gpx|A/nested/slash.gpx|B/same.gpx",
    "nested paths, slash normalization, or GPX filtering failed");
    assert(entries.filter(entry => entry.handle.name === "same.gpx").length === 2,
        "duplicate filenames in separate Folders collided");
    assert(!entries.some(entry => entry.path.includes("TrailBook_Backup")),
        "reserved Backup entered the FileList Library");
    assert(!library.rootFolder.gpxFiles.some(handle =>
        handle.name === "trailbook.json" || handle.name === "readme.txt"),
    "non-GPX files entered Track discovery");
    assert(entries.every(entry => entry.handle.kind === "file" &&
        entry.handle.readOnly && typeof entry.handle.getFile === "function" &&
        typeof entry.handle.createWritable !== "function"),
    "File adapter exposed a writable or incompatible contract");
    const loaded = await new GPXLoader().load(entries[0].handle);

    assert(loaded.text === "<gpx></gpx>" && loaded.sourceFileName === "root.gpx",
        "existing GPXLoader did not consume the File-backed adapter");
    const settingsRepository = new LibrarySettingsRepository(
        Config.sharedLibrarySettings
    );
    const loadedSettings = await settingsRepository.load(
        library.rootFolder.handle
    );

    assert(loadedSettings.status === "loaded" &&
        loadedSettings.snapshot.folderColors.A === "#8F8300",
    "root trailbook.json was not loaded read-only");
    assert(typeof library.rootFolder.handle.queryPermission === "undefined" &&
        typeof library.rootFolder.handle.requestPermission === "undefined" &&
        typeof library.rootFolder.handle.createWritable === "undefined",
    "FileList root exposed permission or write APIs");
    await rejects(
        () => library.rootFolder.handle.getFileHandle("new.gpx", { create: true }),
        "NotAllowedError",
        "FileList root allowed source file creation"
    );
    await rejects(
        () => source.scan([file("GPX/../escape.gpx")]),
        "DataError",
        "path traversal was accepted"
    );
    await rejects(
        () => source.scan([file("GPX/a.gpx"), file("Other/b.gpx")]),
        "DataError",
        "mixed roots were accepted"
    );
    await rejects(
        () => source.scan([file("GPX/A\\same.gpx"), file("GPX/A/same.gpx")]),
        "DataError",
        "canonical path collision was accepted"
    );
    await rejects(
        () => source.scan([file("single.gpx")]),
        "DataError",
        "path without a selected root was accepted"
    );
}

function testNativeDirectoryInputs() {
    const toolbar = new Toolbar("1.9.1");
    const panel = new LibraryAccessPanel();
    let toolbarSelections = 0;
    let panelSelections = 0;

    document.body.append(toolbar.element, panel.element);
    toolbar.setDirectoryAction(files => { toolbarSelections += files.length; });
    toolbar.setMobileLayout(false);
    toolbar.element.classList.remove("is-mobile-layout");
    toolbar.setFolderPickerMode("file-list");
    toolbar.setFolderPickerState({ disabled: false });
    panel.showFileListFallback();
    panel.setFolderPickerMode("file-list");
    panel.setFileListSession(true);
    panel.setFolderPickerState({ disabled: false });
    panel.setManualLibraryAction(files => { panelSelections += files.length; });
    panel.libraryChange.open = true;
    const toolbarInput = toolbar.directoryInput;
    const panelInput = panel.manualDirectoryInput;
    const panelInputStyle = getComputedStyle(panelInput);

    assert(panelInput.type === "file" &&
        panelInput.hasAttribute("webkitdirectory") && panelInput.multiple &&
        panelInput.isConnected && !panelInput.hidden && !panelInput.disabled,
    "fallback control is not a direct connected directory file input");
    assert(panelInputStyle.opacity === "1" &&
        panelInputStyle.pointerEvents !== "none" &&
        panelInputStyle.position === "static",
    "fallback directory input is not the direct interactive target");
    assert(panelInputStyle.fontSize === "0px" &&
        getComputedStyle(panel.element.querySelector(
            ".manual-library-directory-label"
        )).pointerEvents === "none",
    "browser-native filename status is visibly exposed");
    assert(panel.element.querySelectorAll(
        'input[type="file"][webkitdirectory][multiple]'
    ).length === 1 &&
        !panel.element.querySelector(".library-refresh-directory"),
    "Library panel exposes more than one directory picker");
    const visiblePickerActions = [...panel.element.querySelectorAll(
        ".manual-library-open, .manual-library-directory"
    )].filter(element => getComputedStyle(element).display !== "none");

    assert(visiblePickerActions.length === 1 &&
        visiblePickerActions[0] === panelInput,
    "Library change panel does not expose exactly one picker action");
    assert(getComputedStyle(toolbar.sidebarToggleButton).display === "none" &&
        getComputedStyle(toolbar.pickFolderButton).display === "none" &&
        getComputedStyle(toolbarInput).display === "none",
    "desktop toolbar still exposes duplicate Library controls");
    assert(toolbarInput.type === "file" && toolbarInput.isConnected,
        "hidden toolbar action/event contract was removed");
    assert(panel.previousLibraryButton.hidden,
        "dedicated Previous Library reconnect action remains visible");
    const selected = file("GPX/one.gpx", "<gpx></gpx>");

    Object.defineProperty(toolbarInput, "files", {
        configurable: true,
        value: [selected]
    });
    toolbarInput.dispatchEvent(new Event("change"));
    Object.defineProperty(panelInput, "files", {
        configurable: true,
        value: [selected]
    });
    panelInput.dispatchEvent(new Event("change"));
    panelInput.dispatchEvent(new Event("change"));
    assert(toolbarSelections === 1 && panelSelections === 2,
        "direct selection or same-Folder reselection did not reach its action once");
    Object.defineProperty(panelInput, "files", {
        configurable: true,
        value: []
    });
    panelInput.dispatchEvent(new Event("change"));
    assert(panelSelections === 2, "picker cancellation triggered a Library load");
    toolbar.element.remove();
    panel.element.remove();
}

function coordinatorUi() {
    return {
        toolbar: {
            setDirectoryAction(action) { this.directoryAction = action; },
            setFolderPickerMode() {}, setFolderPickerState() {}
        },
        accessPanel: {
            descriptionId: "test", setPreviousLibraryAction() {},
            setManualLibraryAction(action) { this.manualAction = action; },
            setFolderPickerMode() {}, setFolderPickerState() {},
            showFileListFallback() {}, setPreviousLibraryStatus() {},
            showLoading() {}, hide() {}, setFileListSession() {},
            showLoadFailure() {}
        },
        statusBar: {
            showInitial() {}, showLibraryLoading() {}, showLibraryLoaded() {},
            showError() {}
        }
    };
}

async function testCoordinatorRouting() {
    const fallbackUi = coordinatorUi();
    let storeLoads = 0;
    let storeSaves = 0;
    let appliedContext = null;
    let sessionSequence = 0;
    const fallbackSource = new FileListDirectorySource({
        createSessionId: () => `coordinator-${++sessionSequence}`
    });
    const fallback = new PreviousLibraryCoordinator({
        store: {
            load: async () => { storeLoads += 1; return null; },
            save: async () => { storeSaves += 1; return true; },
            getStatus: () => "empty"
        },
        scanner: { scan: async () => { throw new Error("wrong path"); } },
        fileListSource: fallbackSource,
        ...fallbackUi,
        canSwitchLibrary: async () => true,
        flushViewState() {}, beforeLoad() {},
        applyLibrary: async (library, context) => {
            appliedContext = { library, context };
            return true;
        },
        getCurrentLibrary: () => appliedContext?.library || null,
        getSupport: () => ({ available: true, mode: "file-list" })
    });

    assert(await fallback.initialize() === false && storeLoads === 0,
        "fallback startup accessed the persistent DirectoryHandle store");
    assert(await fallback.openManual([
        file("GPX/track.gpx", "<gpx></gpx>")
    ]) === true, "FileList selection did not open a Library");
    assert(appliedContext.context.persistent === false &&
        appliedContext.library.sourceType === "file-list" && storeSaves === 0 &&
        fallback.getRefreshHandle() === null,
    "FileList session was persisted or exposed as a rescan handle");
    const firstSession = appliedContext.library;

    assert(await fallback.openManual([
        file("GPX/reselected.gpx", "<gpx></gpx>")
    ]) === true && appliedContext.library !== firstSession &&
        appliedContext.library.cacheNamespace !== firstSession.cacheNamespace &&
        collectFiles(appliedContext.library.rootFolder)[0]?.path ===
            "reselected.gpx",
    "Folder reselection did not atomically replace the FileList session");
    const reselectedSession = appliedContext.library;

    assert(await fallback.openManual([]) === false &&
        appliedContext.library === reselectedSession,
    "cancelled Folder reselection replaced the current FileList session");

    const directoryUi = coordinatorUi();
    const handle = {
        kind: "directory", name: "GPX",
        queryPermission: async () => "granted",
        requestPermission: async () => "granted"
    };
    let picks = 0;
    let scans = 0;
    let saves = 0;
    const directory = new PreviousLibraryCoordinator({
        store: {
            load: async () => null,
            save: async value => { saves += Number(value === handle); return true; },
            resolveCacheNamespace: async () => "directory-cache",
            getStatus: () => "empty"
        },
        scanner: {
            scan: async value => {
                scans += Number(value === handle);
                return { name: "GPX", rootFolder: { handle }, folderCount: 1,
                    gpxFileCount: 0 };
            },
            getLastScanDiagnostic: () => ({})
        },
        ...directoryUi,
        canSwitchLibrary: async () => true,
        flushViewState() {}, beforeLoad() {},
        applyLibrary: async () => true,
        getCurrentLibrary: () => null,
        getSupport: () => ({ available: true, mode: "directory-handle" }),
        pickDirectory: async () => { picks += 1; return handle; }
    });

    assert(await directory.openManual() && picks === 1 && scans === 1 && saves === 1,
        "existing DirectoryHandle selection/persistence path changed");
}

async function testReadOnlyPersistenceBoundaries() {
    let saves = 0;
    const folderColorState = {
        setActiveLibrary() {}, getExplicitColors: () => ({}),
        getFolderPaths: () => [], getFolderPresentations: () => new Map()
    };
    const settings = new LibrarySettingsCoordinator({
        config: { schemaVersion: 1 },
        displaySettingsStore: { getFolderColors: () => ({}) },
        folderColorState,
        repository: {
            load: async () => ({
                status: "missing", fileExists: false, snapshot: null,
                fingerprint: null, lastModified: null, size: null,
                errorCode: null, fallbackAllowed: true
            }),
            save: async () => { saves += 1; return { status: "saved" }; }
        },
        storage: null,
        lifecycleTarget: null,
        documentObject: null
    });
    const load = await settings.load({}, {
        generation: 1,
        isCurrent: () => true,
        sharedSettingsWritable: false,
        presentationCacheEnabled: false
    });

    assert(settings.applyLoad(load, {
        libraryId: "root-name:file-list-session-test",
        folderPaths: [""]
    }), "read-only shared settings load was not applied");
    assert(settings.markDirty() === false &&
        (await settings.flushAutosave()).status === "read-only" &&
        (await settings.save()).status === "read-only" && saves === 0,
    "read-only shared settings attempted autosave or write");

    let viewReads = 0;
    let viewWrites = 0;
    const view = new ViewStateCoordinator({
        eventBus: { on() {} },
        store: {
            getBaseMap: () => "osm", setBaseMap() {},
            getLibraryState: () => { viewReads += 1; return null; },
            setLibraryState: () => { viewWrites += 1; return true; }
        },
        mapView: {
            setBaseMap() {}, invalidateSize() {}, getViewState: () => ({}),
            isValidViewState: () => false, getDisplayedPaths: () => []
        },
        controls: {
            setLibrary() {}, setSidebarWidth() {}, setTrackInfoHeight() {},
            setSidebarOpen() {}, getDefaultSidebarWidth: () => 260,
            getDefaultTrackInfoHeight: () => 220, isSidebarOpen: () => true,
            getSidebarWidth: () => 260, getTrackInfoHeight: () => 220
        },
        displayState: {
            getLibraryGeneration: () => 1, getDisplays: () => new Map(),
            getCheckedPaths: () => []
        },
        displayQueue: { whenEnqueued: async () => {}, whenIdle: async () => {} },
        selectionState: { getSelectedPath: () => null },
        documentTarget: null, windowTarget: null
    });

    assert(await view.restoreLibrary({
        libraryId: "root-name:file-list-session-test",
        libraryName: "GPX", generation: 1, isCurrent: () => true,
        persistent: false
    }), "session-only View State initialization failed");
    assert(viewReads === 0 && viewWrites === 0 &&
        view.getStatus().activeLibraryId === null,
    "FileList View State was associated with persistent storage");

    let snapshotClears = 0;
    let snapshotSaves = 0;
    let ready = 0;
    const snapshot = new DisplaySnapshotCoordinator({
        eventBus: { on() {} },
        store: {
            config: { schemaVersion: 1 },
            load: async () => null,
            clear: async () => { snapshotClears += 1; return true; },
            save: async () => { snapshotSaves += 1; return true; }
        },
        repository: {},
        mapView: {}, controls: {},
        displayState: { subscribe() {} }, selectionState: {},
        markLibraryReady: () => { ready += 1; },
        documentTarget: null, windowTarget: null
    });

    await snapshot.setPersistenceEnabled(false, { clear: true });
    snapshot.beginPhaseB();
    snapshot.setLibraryContext({
        libraryIdentity: "root-name:file-list-session-test",
        cacheNamespace: "file-list-session:test"
    });
    assert(await snapshot.commitLibrarySwitch() &&
        await snapshot.completePhaseB({ restored: true }),
    "session-only Display Snapshot did not complete runtime Phase B");
    assert(snapshotClears === 1 && snapshotSaves === 0 && ready === 1,
        "FileList Display Snapshot was persisted or not cleared");
}

async function run() {
    testCapabilityRouting();
    await testFileListSource();
    testNativeDirectoryInputs();
    await testCoordinatorRouting();
    await testReadOnlyPersistenceBoundaries();
    output.textContent = `PASS: ${assertions} assertions`;
}

run().catch(error => {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack || error}`;
    throw error;
});
