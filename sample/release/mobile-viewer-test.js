import TrackInfoView from "../../src/js/ui/TrackInfoView.js";
import ViewStateControls from "../../src/js/ui/ViewStateControls.js";
import Toolbar from "../../src/js/ui/Toolbar.js";
import LibraryAccessPanel from "../../src/js/ui/LibraryAccessPanel.js";
import FolderColorControl from "../../src/js/ui/FolderColorControl.js";
import DisplayState from "../../src/js/state/DisplayState.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class FakeEventBus {
    constructor() { this.events = []; }
    emit(name, detail) { this.events.push({ name, detail }); }
}

class FakeMedia {
    constructor(matches = false) {
        this.matches = matches;
        this.listeners = [];
    }
    addEventListener(name, listener) {
        if (name === "change") this.listeners.push(listener);
    }
    set(matches) {
        this.matches = matches;
        this.listeners.forEach(listener => listener({ matches }));
    }
}

function createFixture(media) {
    const eventBus = new FakeEventBus();
    const frames = [];
    const workspace = document.createElement("main");
    workspace.className = "workspace";
    const shell = document.createElement("div");
    shell.className = "sidebar-shell";
    const list = document.createElement("div");
    list.className = "sidebar";
    const info = new TrackInfoView();
    shell.append(list, info.element);
    workspace.append(shell);
    const toolbarElement = document.createElement("header");
    toolbarElement.className = "toolbar";
    const sidebarToggleButton = document.createElement("button");
    sidebarToggleButton.textContent = "サイドバー";
    toolbarElement.append(sidebarToggleButton);
    const toolbar = {
        element: toolbarElement,
        sidebarToggleButton,
        setSidebarOpen(open) {
            sidebarToggleButton.setAttribute("aria-pressed", String(open));
        }
    };
    const windowListeners = new Map();
    const controls = new ViewStateControls(eventBus, {
        mobileMedia: media,
        windowObject: {
            addEventListener(name, listener) { windowListeners.set(name, listener); }
        },
        requestFrame(callback) { frames.push(callback); return frames.length; },
        isDesktop: () => true
    });
    controls.attach({ toolbar, workspace, sidebar: shell });
    const flushFrames = () => {
        while (frames.length) frames.shift()();
    };
    return {
        controls, eventBus, workspace, shell, list, info,
        toolbar, windowListeners, flushFrames
    };
}

function createMobileSidebarProbe(trackCount = 1122) {
    const shell = document.createElement("section");
    const close = document.createElement("button");
    const fixed = document.createElement("div");
    const search = document.createElement("section");
    const dates = document.createElement("div");
    const modes = document.createElement("div");
    const drive = document.createElement("section");
    const sidebar = document.createElement("aside");
    const tree = document.createElement("ul");
    const buildInfo = document.createElement("footer");

    shell.className = "sidebar-shell is-mobile-open";
    close.className = "mobile-sidebar-close";
    close.textContent = "Close";
    fixed.className = "sidebar-fixed-controls";
    search.className = "search-view";
    search.innerHTML = '<details class="search-disclosure">' +
        '<summary class="search-disclosure-summary">検索</summary>' +
        '<div class="search-disclosure-content">' +
        '<input class="search-input"><p class="search-summary">1122 GPX</p>' +
        '</div></details>';
    dates.className = "search-date-filter";
    dates.innerHTML = '<label><span>From</span><input type="date"></label>' +
        '<label><span>To</span><input type="date"></label>' +
        '<button class="search-filter-clear">Clear</button>';
    search.querySelector(".search-disclosure-content").append(dates);
    modes.className = "discovery-mode-switch";
    modes.innerHTML = "<button>Folder</button><button>Date</button>";
    drive.className = "drive-library-control";
    drive.innerHTML = "<button>別のGoogle Drive Libraryに直接接続</button>" +
        '<p class="drive-library-description">TrailBookからGoogle Driveへ接続</p>' +
        '<p class="drive-library-status">Drive Library: 1122 GPX</p>';
    const diagnostic = document.createElement("details");

    diagnostic.className = "library-refresh-diagnostic";
    diagnostic.innerHTML = "<summary>Library Refresh</summary><pre>diagnostic</pre>";
    fixed.append(search, modes, drive, diagnostic);
    sidebar.className = "sidebar";
    tree.className = "tree-root";

    for (let index = 0; index < trackCount; index += 1) {
        const item = document.createElement("li");

        item.innerHTML = '<div class="tree-row folder-row">' +
            '<input class="folder-display-toggle" type="checkbox">' +
            '<span class="tree-icon"></span>' +
            `<span class="tree-label">Long folder label ${index}</span>` +
            '<button class="folder-color-control">' +
            '<span class="folder-color-swatch"></span>' +
            '<span class="folder-color-mode">Explicit</span></button>' +
            '<span class="folder-color-readonly" aria-label="表示色: #123456、Auto">' +
            '<span class="folder-color-readonly-swatch" style="background:#123456"></span>' +
            '<span class="folder-color-readonly-mode">Auto</span></span></div>';
        tree.append(item);
    }
    sidebar.append(tree);
    buildInfo.className = "trailbook-build-info";
    buildInfo.textContent = "TrailBook v1.8.0 · testbuild";
    shell.append(close, fixed, sidebar, buildInfo);
    document.body.append(shell);
    return {
        shell, close, fixed, search, modes, drive, diagnostic,
        sidebar, tree, buildInfo
    };
}

async function testLargeColorProjection() {
    const trackCount = 1050;
    const element = document.createElement("aside");
    const folderNodes = new Map();
    const fileNodes = new Map();
    const nodeMetadata = new Map([["", {
        kind: "folder", path: "", parentPath: ""
    }]]);
    const presentations = new Map([["", {
        mode: "auto", explicitColor: null, resolvedColor: null
    }]]);

    for (let index = 0; index < trackCount; index += 1) {
        const folderPath = `folder-${index}`;
        const filePath = `${folderPath}/track.gpx`;
        const folderRow = document.createElement("div");
        const fileRow = document.createElement("div");

        folderRow.className = "folder-row";
        folderRow.dataset.nodeKind = "folder";
        folderRow.dataset.treePath = folderPath;
        folderRow.innerHTML = `<span class="tree-label">${folderPath}</span>`;
        fileRow.className = "gpx-file";
        fileRow.dataset.nodeKind = "file";
        fileRow.dataset.treePath = filePath;
        fileRow.innerHTML = '<span class="tree-color-indicator"></span>';
        element.append(folderRow, fileRow);
        folderNodes.set(folderPath, folderRow);
        fileNodes.set(filePath, fileRow);
        nodeMetadata.set(folderPath, {
            kind: "folder", path: folderPath, parentPath: ""
        });
        nodeMetadata.set(filePath, {
            kind: "file", path: filePath, parentPath: folderPath, color: null
        });
        presentations.set(folderPath, {
            mode: "auto", explicitColor: null, resolvedColor: null
        });
    }
    let resolverCalls = 0;
    const control = new FolderColorControl({
        element, folderNodes, fileNodes, nodeMetadata
    }, new FakeEventBus(), null, () => {
        resolverCalls += 1;
        return "#123456";
    });

    control.setPresentations(presentations);
    assert(resolverCalls === trackCount,
        "1000+ Track color projection was not linear");
    assert(element.querySelectorAll(".folder-color-readonly").length ===
        trackCount,
    "large Folder projection omitted read-only indicators");
    await new Promise(resolve => setTimeout(resolve, 0));
    const callsAfterObserver = resolverCalls;

    await new Promise(resolve => setTimeout(resolve, 0));
    assert(resolverCalls === callsAfterObserver,
        "color indicator MutationObserver entered a refresh loop");
    control.setPresentations(presentations);
    assert(resolverCalls === callsAfterObserver,
        "unchanged Phase B presentation recalculated Track colors");
}

async function run() {
    const media = new FakeMedia(false);
    const fixture = createFixture(media);

    await testLargeColorProjection();
    fixture.flushFrames();

    assert(!fixture.controls.isMobile(), "desktop layout was not the default");
    assert(!fixture.shell.hidden && fixture.controls.isSidebarOpen(),
        "desktop Sidebar behavior changed");
    assert(fixture.info.element.parentNode === fixture.shell,
        "desktop Track Info left the Sidebar");

    const selectedPath = "rides/track.gpx";
    media.set(true);
    fixture.flushFrames();
    assert(fixture.controls.isMobile(), "mobile breakpoint change was ignored");
    assert(fixture.workspace.classList.contains("is-mobile-layout"),
        "mobile workspace class missing");
    assert(!fixture.controls.isSidebarOpen() && !fixture.shell.hidden,
        "mobile Sidebar was not initially closed as an overlay");
    assert(fixture.shell.getAttribute("aria-hidden") === "true",
        "closed mobile Sidebar was not hidden from accessibility tree");
    assert(fixture.info.element.parentNode === fixture.workspace,
        "mobile Track Info was not moved to the bottom-sheet layer");
    assert(fixture.toolbar.sidebarToggleButton.textContent === "" &&
        fixture.toolbar.sidebarToggleButton.getAttribute("aria-label") ===
            "ライブラリ",
    "mobile Library control is not icon-only accessible UI");

    fixture.toolbar.sidebarToggleButton.click();
    assert(fixture.controls.isSidebarOpen() &&
        fixture.shell.classList.contains("is-mobile-open"),
    "Library button did not open mobile Sidebar");
    assert(fixture.eventBus.events.some(event =>
        event.name === "library:sidebar-opened"),
    "opening the Library Sidebar did not request a background refresh");
    assert(!fixture.workspace.querySelector(".mobile-sidebar-backdrop").hidden,
        "mobile backdrop did not open");
    fixture.workspace.querySelector(".mobile-sidebar-backdrop").click();
    assert(!fixture.controls.isSidebarOpen(), "backdrop did not close Sidebar");
    assert(selectedPath === "rides/track.gpx",
        "Sidebar interaction changed selection identity");

    fixture.info.showEntry({
        status: "ready",
        displayName: "Track",
        folderPath: "rides",
        resolvedDate: null,
        dateSource: "unknown",
        distance: 0,
        pointCount: 1,
        startTime: null,
        endTime: null,
        duration: 0,
        elevationMin: null,
        elevationMax: null
    });
    assert(fixture.info.element.classList.contains("has-track-info"),
        "selected Track did not expose Track Info bottom sheet");
    fixture.info.element.querySelector(".track-info-close").click();
    assert(fixture.info.element.classList.contains("is-mobile-dismissed"),
        "Track Info close did not dismiss the bottom sheet");

    fixture.flushFrames();
    fixture.eventBus.events.length = 0;
    fixture.windowListeners.get("resize")();
    fixture.windowListeners.get("resize")();
    fixture.flushFrames();
    assert(fixture.eventBus.events.filter(
        event => event.name === "view-state:sidebar-layout-changed"
    ).length === 1, "resize invalidation was not coalesced");

    media.set(false);
    fixture.flushFrames();
    assert(!fixture.controls.isMobile() &&
        fixture.info.element.parentNode === fixture.shell,
    "desktop layout was not restored");
    assert(fixture.toolbar.sidebarToggleButton.textContent === "サイドバー",
        "desktop Sidebar label was not restored");

    const layoutCss = await fetch("../../src/css/layout.css").then(r => r.text());
    const themeCss = await fetch("../../src/css/theme.css").then(r => r.text());
    const indexHtml = await fetch("../../src/index.html").then(r => r.text());
    const accessPanelSource = await fetch(
        "../../src/js/ui/LibraryAccessPanel.js"
    ).then(r => r.text());
    assert(layoutCss.includes("@media (max-width:768px)") &&
        layoutCss.includes("(pointer:coarse)") &&
        layoutCss.includes("height:100dvh") &&
        layoutCss.includes("width:min(85vw, 360px)"),
    "mobile viewport or Sidebar CSS contract missing");
    assert(layoutCss.includes("flex-direction:column") &&
        layoutCss.includes("overflow-y:hidden") &&
        layoutCss.includes("flex:1 1 auto") &&
        layoutCss.includes("min-height:0"),
    "mobile Sidebar does not reserve its flexible area for the Track Tree");
    assert(themeCss.includes("min-height:44px") &&
        themeCss.includes(".track-editor") &&
        themeCss.includes(".batch-simplification") &&
        themeCss.includes("env(safe-area-inset-bottom)"),
    "touch, editing guard, or safe-area CSS contract missing");
    assert(themeCss.includes(".mobile-map-controls") &&
        themeCss.includes("top:max(76px") &&
        themeCss.includes("left:max(64px"),
    "mobile map controls are not placed below the zoom row");
    assert(
        themeCss.includes(".leaflet-top.leaflet-left .leaflet-control-zoom") &&
        themeCss.includes("display:flex") &&
        themeCss.includes(".leaflet-control-zoom a") &&
        themeCss.includes("height:60px") &&
        themeCss.includes("line-height:60px") &&
        themeCss.includes(".leaflet-control-zoom-out") &&
        themeCss.includes("order:1"),
        "mobile Leaflet zoom is not a 60px horizontal minus/plus row"
    );
    assert(themeCss.includes(".map-toolbar") &&
        themeCss.includes("display:none") &&
        themeCss.includes(".mobile-sidebar-display-controls"),
    "mobile selects or Map Waypoint/Clear controls remain on the Map");
    assert(themeCss.includes(".search-disclosure-summary") &&
        themeCss.includes(".search-view.has-active-filter") &&
        themeCss.includes("max-height:28dvh"),
    "mobile Search disclosure or active-filter presentation is missing");
    assert(themeCss.includes(
        ".sidebar-shell:has(.library-refresh-diagnostic[open])"
    ) && themeCss.includes("overflow-y:visible") &&
        !themeCss.includes("max-height:min(42dvh, 360px)") &&
        !themeCss.includes("overscroll-behavior:contain") &&
        !themeCss.includes("touch-action:pan-y"),
    "mobile Library refresh diagnostic still owns a nested scroll area");
    assert(accessPanelSource.includes(
        'matchMedia?.("(max-width:768px)").matches !== true'
    ) && accessPanelSource.includes(
        '<details class="fast-restore-diagnostic library-refresh-diagnostic">'
    ), "mobile Library refresh diagnostic is not collapsed by default");
    assert(themeCss.includes("body.is-driving-mode .map-toolbar") &&
        !themeCss.includes("body.is-driving-mode .mobile-map-controls"),
    "driving mode hides the required mobile Map toggles");
    assert(
        themeCss.includes(".trailbook-build-info") &&
        themeCss.includes("flex:0 0 auto"),
        "mobile build information can shrink out of the sidebar"
    );
    assert(themeCss.includes("grid-column:1 / -1") &&
        themeCss.includes(".folder-color-readonly") &&
        themeCss.includes("flex:0 0 18px") &&
        themeCss.includes("text-overflow:ellipsis"),
    "mobile controls or Folder rows can overlap horizontally");
    assert(layoutCss.includes(".track-editor") &&
        layoutCss.includes("left:52px"),
    "desktop Track Editor does not clear the Leaflet zoom control");
    assert(indexHtml.includes('name="viewport"') &&
        indexHtml.includes("viewport-fit=cover"),
    "mobile viewport metadata missing");

    const toolbarCopy = new Toolbar("test");
    const accessCopy = new LibraryAccessPanel();

    toolbarCopy.setMobileLayout(true);
    assert(toolbarCopy.sidebarToggleButton.textContent.trim() === "" &&
        toolbarCopy.sidebarToggleButton.querySelector("svg path"),
    "mobile Library control does not use the inline SVG icon");
    assert(toolbarCopy.sidebarToggleButton.getAttribute("aria-label") ===
        "ライブラリ" && toolbarCopy.sidebarToggleButton.title === "ライブラリ",
    "mobile Library icon accessible name missing");
    toolbarCopy.setMobileLayout(false);
    assert(toolbarCopy.sidebarToggleButton.textContent === "サイドバー",
        "desktop Sidebar presentation did not recover");

    accessCopy.showInitial();
    assert(toolbarCopy.pickFolderButton.textContent.includes(
        "端末からライブラリを開く"
    ), "local Library action wording is unclear");
    assert(accessCopy.element.textContent.includes("端末・Files・Google Driveなど"),
        "local Library source explanation is missing");
    assert(!accessCopy.element.querySelector(".manual-library-primary").hidden &&
        accessCopy.previousLibraryButton.hidden,
    "no-previous state does not prioritize device Library open");
    assert(!accessCopy.libraryChange.open,
        "Library change options expanded by default");
    assert(!accessCopy.element.querySelector(".manual-library-secondary").hidden,
        "no-previous Library change route omits device open");
    accessCopy.showPreviousLibrary("Previous", "prompt");
    assert(!accessCopy.previousLibraryButton.hidden &&
        accessCopy.element.querySelector(".manual-library-primary").hidden,
    "previous Library is not the primary action");
    assert(!accessCopy.element.querySelector(".manual-library-secondary").hidden,
        "device Library change action missing");
    accessCopy.setProvisionalLibrary(true);
    accessCopy.showPreviousLibrary("Previous", "prompt");
    assert(accessCopy.primaryContent.hidden &&
        !accessCopy.libraryChange.hidden &&
        accessCopy.element.classList.contains("is-compact"),
    "cached viewer tree did not suppress the redundant previous-Library action");
    let refreshRequests = 0;

    accessCopy.setLibraryRefreshAction(() => { refreshRequests += 1; });
    accessCopy.setPreviousLibraryStatus("saved / prompt");
    assert(accessCopy.libraryRefreshButton.hidden,
        "Panel inferred refresh visibility before Coordinator state arrived");
    const promptRefreshState = Object.freeze({
        runtimeBuildId: "test-build",
        runtimeMarkerSource: "loaded",
        permission: "prompt",
        hasHandle: true,
        libraryState: "provisional",
        canManualRefresh: true,
        cachedCount: null,
        scannedCount: null,
        addedCount: null,
        removedCount: null,
        modifiedCount: null,
        reason: "waiting-permission",
        result: "waiting"
    });
    accessCopy.setLibraryRefreshState(promptRefreshState);
    assert(accessCopy.libraryRefreshState === promptRefreshState,
        "LibraryAccessPanel merged/reconstructed Coordinator refresh state");
    assert(!accessCopy.libraryRefreshButton.hidden,
        "explicit Coordinator refresh state did not expose refresh action");
    assert(accessCopy.libraryChangeContainer.contains(
        accessCopy.libraryRefreshButton
    ), "refresh action is not inside expanded Library change options");
    accessCopy.libraryChange.open = false;
    accessCopy.setLibraryRefreshState(promptRefreshState);
    accessCopy.libraryChange.open = true;
    assert(!accessCopy.libraryRefreshButton.hidden,
        "collapsed state update was lost when Library options expanded");
    accessCopy.libraryChange.dispatchEvent(new Event("toggle"));
    assert(!accessCopy.libraryRefreshButton.hidden,
        "expanded re-render did not preserve latest manual refresh state");
    accessCopy.element.querySelector(".library-refresh-action").click();
    assert(refreshRequests === 1,
        "cached Library refresh action was not available for permission reconnect");
    accessCopy.setLibraryRefreshState(Object.freeze({
        ...promptRefreshState,
        cachedCount: 1123
    }));
    const refreshDiagnostic = accessCopy.element.querySelector(
        ".library-refresh-diagnostic"
    );

    assert(refreshDiagnostic.open ===
        (matchMedia("(max-width:768px)").matches !== true) &&
        refreshDiagnostic.textContent.includes("runtime module: test-build") &&
        refreshDiagnostic.textContent.includes("runtime marker source: loaded") &&
        refreshDiagnostic.textContent.includes("permission: prompt") &&
        refreshDiagnostic.textContent.includes("cached: 1123") &&
        refreshDiagnostic.textContent.includes("scanned: -") &&
        refreshDiagnostic.textContent.includes("manual refresh: yes"),
    "Library refresh diagnostic is not visible with prompt counts");
    accessCopy.setLibraryRefreshState(Object.freeze({
        ...promptRefreshState,
        entryTrace: Object.freeze({
            path: "Trips/New.gpx",
            classification: "new",
            discoveryStatus: "ready",
            displayState: "idle",
            errorName: null,
            errorMessage: null,
            checked: false,
            visibility: false,
            trackColor: "#F08000",
            folderResolvedColor: "#F08000",
            treeColor: "#F08000",
            folderDomColor: "#F08000",
            trackDomColor: "#F08000",
            fileHandleKind: "file",
            fileHandleProvisional: false,
            fileHandleActual: true,
            permissionState: "granted",
            resolverResult: "actual",
            getFileResult: "success",
            getFileErrorName: null,
            getFileErrorMessage: null,
            checkboxStage: "map layer: created",
            checkboxTrace: ["click: received-on", "map layer: created"]
        })
    }));
    assert(refreshDiagnostic.textContent.includes(
        "relativePath: Trips/New.gpx"
    ) && refreshDiagnostic.textContent.includes(
        "FileHandle provisional / actual: no / yes"
    ) && refreshDiagnostic.textContent.includes(
        "Folder DOM swatch: #F08000"
    ) && refreshDiagnostic.textContent.includes(
        "checkbox last stage: map layer: created"
    ), "Android entry diagnostic omitted runtime state/trace fields");
    accessCopy.setLibraryRefreshState(Object.freeze({
        ...promptRefreshState,
        enumerationDiagnostic: Object.freeze({
            rootHandleName: "GPX",
            rootHandleKind: "directory",
            permission: "granted",
            enumerationStartedAt: "2026-08-31T00:00:00.000Z",
            enumerationFinishedAt: "2026-08-31T00:00:01.000Z",
            gpxCount: 1124,
            totalFileCount: 1130,
            totalDirectoryCount: 20,
            gpxTailPaths: Object.freeze(["Trips/New.gpx"]),
            candidatePaths: Object.freeze([Object.freeze({
                path: "Trips/New.gpx",
                known: false,
                tree: false,
                snapshot: false
            })]),
            actualPathCount: 1124,
            knownPathCount: 1123,
            treePathCount: 1123,
            snapshotPathCount: 1123,
            handleSource: "actual",
            handleOrigin: "saved-handle",
            sameAsSavedHandle: true
        })
    }));
    assert(refreshDiagnostic.textContent.includes("Directory Enumeration") &&
        refreshDiagnostic.textContent.includes("root: GPX") &&
        refreshDiagnostic.textContent.includes("actual paths: 1124") &&
        refreshDiagnostic.textContent.includes("known paths: 1123") &&
        refreshDiagnostic.textContent.includes("Tree paths: 1123") &&
        refreshDiagnostic.textContent.includes("Snapshot paths: 1123") &&
        refreshDiagnostic.textContent.includes(
            "Trips/New.gpx [known:no Tree:no Snapshot:no]"
        ), "Android enumeration diagnostic omitted raw path comparisons");
    accessCopy.setLibraryRefreshState(Object.freeze({
        ...promptRefreshState,
        cachedCount: 1123
    }));
    accessCopy.setLibraryRefreshHydrationDiagnostic({
        previous: {
            getterCalled: true,
            initialized: true,
            initializationStage: "complete",
            hasHandle: true,
            permission: "prompt",
            handleType: "directory",
            status: "saved / prompt"
        },
        snapshot: {
            getterCalled: true,
            provisional: true,
            cachedCount: 1123,
            libraryIdentity: "local:test"
        },
        coordinator: {
            runtimeBuildId: "test-build",
            hydrateCallCount: 4,
            reason: "sidebar-open",
            permission: "prompt",
            hasHandle: true,
            libraryState: "provisional",
            cachedCount: 1123
        }
    });
    const hydrationDiagnostic = accessCopy.element.querySelector(
        ".library-refresh-hydration-source"
    );

    assert(hydrationDiagnostic.textContent.includes("getter called: yes") &&
        hydrationDiagnostic.textContent.includes("runtime module: test-build") &&
        hydrationDiagnostic.textContent.includes("permission: prompt") &&
        hydrationDiagnostic.textContent.includes("provisional: yes") &&
        hydrationDiagnostic.textContent.includes("cachedCount: 1123") &&
        hydrationDiagnostic.textContent.includes(
            "last hydrate reason: sidebar-open"
        ) && hydrationDiagnostic.textContent.includes(
            "resulting libraryState: provisional"
        ),
    "raw refresh hydration sources were not rendered without reconstruction");
    let diagnosticMutations = 0;
    const diagnosticObserver = new MutationObserver(records => {
        diagnosticMutations += records.length;
    });

    diagnosticObserver.observe(refreshDiagnostic.querySelector("pre"), {
        childList: true, characterData: true, subtree: true
    });
    accessCopy.setLibraryRefreshState(Object.freeze({
        ...promptRefreshState,
        cachedCount: 1123
    }));
    await new Promise(resolve => setTimeout(resolve, 0));
    diagnosticObserver.disconnect();
    assert(diagnosticMutations === 0,
        "unchanged Library refresh diagnostic caused a DOM refresh loop");
    accessCopy.setLibraryRefreshState({
        ...promptRefreshState,
        permission: "granted", canManualRefresh: false,
        reason: "manual-refresh", result: "checking"
    });
    assert(!accessCopy.libraryRefreshButton.hidden &&
        accessCopy.libraryRefreshButton.disabled &&
        accessCopy.libraryRefreshButton.textContent === "確認中…",
    "running refresh did not expose disabled progress feedback");
    accessCopy.setLibraryRefreshState({
        ...promptRefreshState,
        permission: "denied", canManualRefresh: false,
        reason: "manual-refresh", result: "permission-denied"
    });
    assert(!accessCopy.libraryRefreshButton.hidden &&
        !accessCopy.libraryRefreshButton.disabled &&
        accessCopy.libraryRefreshButton.textContent === "更新失敗",
    "failed refresh did not expose failure feedback");
    accessCopy.setLibraryRefreshState({
        ...promptRefreshState,
        libraryState: "ready", canManualRefresh: false,
        addedCount: 1, recoveredCount: 1,
        reason: "manual-refresh", result: "success"
    });
    assert(!accessCopy.libraryRefreshButton.hidden &&
        accessCopy.libraryRefreshButton.textContent === "更新完了（+2件）",
    "successful refresh did not expose added/recovered feedback");
    accessCopy.setLibraryRefreshState({
        ...promptRefreshState,
        libraryState: "ready", canManualRefresh: false,
        addedCount: 0, recoveredCount: 0,
        reason: "manual-refresh", result: "success"
    });
    assert(accessCopy.libraryRefreshButton.textContent === "更新完了（変更なし）",
        "no-change refresh did not expose completion feedback");
    accessCopy.showPreviousLibrary("Previous", "denied");
    assert(accessCopy.primaryContent.hidden &&
        !accessCopy.libraryChange.hidden &&
        accessCopy.element.classList.contains("is-compact"),
    "permission denial removed the cached viewer tree controls");
    accessCopy.setProvisionalLibrary(false);
    accessCopy.showPreviousLibrary("Previous", "prompt");
    assert(!accessCopy.element.classList.contains("is-compact"),
        "unresolved Previous Library state stayed compact");
    accessCopy.hide();
    document.body.append(accessCopy.element);
    assert(accessCopy.primaryContent.hidden &&
        !accessCopy.libraryChange.hidden &&
        getComputedStyle(accessCopy.libraryChange).display !== "none",
    "open Library state does not preserve compact Library change access");
    accessCopy.element.remove();
    const driveOption = document.createElement("section");
    driveOption.className = "drive-library-control";
    driveOption.textContent = "Google Driveに直接接続";
    accessCopy.libraryChangeContainer.append(driveOption);
    accessCopy.libraryChange.open = true;
    assert(accessCopy.libraryChange.textContent.includes(
        "端末からライブラリを開く"
    ) && accessCopy.libraryChange.textContent.includes(
        "Google Driveに直接接続"
    ), "Library change disclosure does not contain both open routes");
    assert(!themeCss.includes(".mobile-drive-diagnostic"),
        "obsolete Mobile Drive diagnostic CSS remains");

    const colorTree = document.createElement("aside");
    const folderRow = document.createElement("div");
    const fileRow = document.createElement("div");
    const colorEvents = new FakeEventBus();
    const colorState = new DisplayState();

    folderRow.className = "tree-row folder-row";
    folderRow.dataset.treePath = "Trips";
    folderRow.dataset.nodeKind = "folder";
    folderRow.innerHTML = '<span class="tree-label">Trips</span>';
    fileRow.className = "tree-row gpx-file";
    fileRow.dataset.treePath = "Trips/ride.gpx";
    fileRow.dataset.nodeKind = "file";
    fileRow.innerHTML = '<span class="tree-color-indicator"></span>' +
        '<span class="tree-label">ride.gpx</span>';
    colorTree.append(folderRow, fileRow);
    const colorTreeView = {
        element: colorTree,
        folderNodes: new Map([["Trips", folderRow]]),
        fileNodes: new Map([["Trips/ride.gpx", fileRow]]),
        nodeMetadata: new Map([
            ["Trips", { kind: "folder", path: "Trips" }],
            ["Trips/ride.gpx", {
                kind: "file", path: "Trips/ride.gpx", parentPath: "Trips",
                color: null
            }]
        ])
    };
    const colorControl = new FolderColorControl(
        colorTreeView,
        colorEvents,
        colorState,
        () => "#123456"
    );

    colorState.setLibrary({});
    colorState.registerFile("Trips/ride.gpx", {}, "#123456");
    colorControl.setPresentations(new Map([["Trips", {
        mode: "auto", explicitColor: null, resolvedColor: null
    }]]));
    const readonly = folderRow.querySelector(".folder-color-readonly");
    const trackSwatch = fileRow.querySelector(".tree-color-indicator");

    assert(readonly?.tagName === "SPAN" &&
        readonly.querySelector(".folder-color-readonly-mode").textContent === "Auto" &&
        readonly.getAttribute("aria-label").includes("#123456"),
    "mobile Auto Folder color is not exposed as a read-only resolved swatch");
    assert(colorControl.getResolvedFolderColor("Trips") === "#123456",
        "Auto Folder presentation color is not available to incremental refresh");
    colorState.getDisplay("Trips/ride.gpx").color = "#008080";
    colorTreeView.nodeMetadata.get("Trips/ride.gpx").color = "#008080";
    assert(colorControl.getResolvedFolderColor("Trips") === "#123456",
        "Folder color getter recomputed a different sibling Track color");
    colorState.getDisplay("Trips/ride.gpx").color = "#123456";
    colorTreeView.nodeMetadata.get("Trips/ride.gpx").color = "#123456";
    assert(trackSwatch.getAttribute("aria-label").includes("#123456") &&
        fileRow.querySelector(".tree-color-mode").textContent === "Auto",
    "mobile resolved Track color is missing");
    const eventCount = colorEvents.events.length;

    readonly.click();
    assert(colorEvents.events.length === eventCount,
        "read-only mobile color indicator triggered an edit action");
    folderRow.querySelector(".folder-color-control").click();
    assert(colorEvents.events.at(-1)?.name === "folder:color-edit-requested",
        "existing desktop Folder color edit action regressed");
    colorState.registerFile("Trips/ride.gpx", {}, "#AABBCC");
    colorControl.setPresentations(new Map([["Trips", {
        mode: "explicit", explicitColor: "#AABBCC", resolvedColor: "#AABBCC"
    }]]));
    assert(readonly.querySelector(".folder-color-readonly-mode").textContent ===
        "Explicit" && trackSwatch.getAttribute("aria-label").includes("#AABBCC"),
    "explicit Folder/Track resolved color was not refreshed");
    assert(colorControl.getResolvedFolderColor("Trips") === "#AABBCC",
        "explicit Folder presentation color is not authoritative");
    colorState.registerFile("Trips/ride.gpx", {}, "#445566");
    colorControl.setPresentations(new Map([["Trips", {
        mode: "inherited", explicitColor: null, resolvedColor: "#445566"
    }]]));
    assert(fileRow.querySelector(".tree-color-mode").textContent === "Inherited",
        "inherited Track color mode is not identified");
    assert(colorControl.getResolvedFolderColor("Trips") === "#445566",
        "inherited Folder presentation color is not authoritative");

    if (matchMedia("(max-width:768px)").matches) {
        const probe = createMobileSidebarProbe();
        const flow = [probe.close, probe.fixed, probe.sidebar, probe.buildInfo]
            .map(element => element.getBoundingClientRect());
        const row = probe.tree.querySelector(".tree-row");
        const label = row.querySelector(".tree-label").getBoundingClientRect();
        const colorButton = row.querySelector(".folder-color-control");
        const color = row.querySelector(".folder-color-readonly")
            .getBoundingClientRect();

        assert(flow[0].bottom <= flow[1].top + 1 &&
            flow[1].bottom <= flow[2].top + 1 &&
            flow[2].bottom <= flow[3].top + 1,
        "mobile Sidebar sections overlap vertically");
        assert(probe.sidebar.scrollHeight > probe.sidebar.clientHeight,
            "1122-row Folder Tree is not vertically scrollable");
        assert(probe.shell.scrollWidth <= probe.shell.clientWidth + 1 &&
            probe.sidebar.scrollWidth <= probe.sidebar.clientWidth + 1,
        "mobile Sidebar introduces horizontal scrolling");
        assert(label.right <= color.left + 1 && color.width >= 18,
            "Folder label and read-only color indicator overlap");
        assert(getComputedStyle(colorButton).display === "none" &&
            getComputedStyle(row.querySelector(".folder-color-readonly")).display ===
                "inline-flex",
        "mobile color editor was not replaced by the read-only indicator");
        assert(getComputedStyle(probe.shell).overflowY === "hidden" &&
            getComputedStyle(probe.sidebar).overflowY === "auto",
        "mobile shell or dedicated Tree scrolling contract is inactive");
        assert(!probe.diagnostic.open,
            "mobile Library refresh diagnostic is not collapsed by default");
        probe.diagnostic.open = true;
        assert(getComputedStyle(probe.shell).overflowY === "auto" &&
            getComputedStyle(probe.sidebar).overflowY === "visible",
        "expanded diagnostic did not move scrolling to the mobile sidebar");
        probe.diagnostic.open = false;
        assert(!probe.search.querySelector(".search-disclosure").open,
            "mobile Search probe was not collapsed by default");
        assert(probe.buildInfo.getBoundingClientRect().top >=
            probe.sidebar.getBoundingClientRect().bottom - 1,
        "BuildInfo overlaps the mobile Folder Tree");
        probe.shell.remove();
    }

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    await run();
} catch (error) {
    output.textContent = `FAIL: ${error.stack || error}`;
    throw error;
}
