import TrackInfoView from "../../src/js/ui/TrackInfoView.js";
import ViewStateControls from "../../src/js/ui/ViewStateControls.js";
import {
    MobileDriveDiagnosticPanel
} from "../../src/js/ui/MobileDriveDiagnosticPanel.js";

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

async function run() {
    const media = new FakeMedia(false);
    const fixture = createFixture(media);
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
    assert(fixture.toolbar.sidebarToggleButton.textContent === "ライブラリ",
        "mobile Library button label missing");

    fixture.toolbar.sidebarToggleButton.click();
    assert(fixture.controls.isSidebarOpen() &&
        fixture.shell.classList.contains("is-mobile-open"),
    "Library button did not open mobile Sidebar");
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
    assert(layoutCss.includes("@media (max-width:768px)") &&
        layoutCss.includes("(pointer:coarse)") &&
        layoutCss.includes("height:100dvh") &&
        layoutCss.includes("width:min(85vw, 360px)"),
    "mobile viewport or Sidebar CSS contract missing");
    assert(themeCss.includes("min-height:44px") &&
        themeCss.includes(".track-editor") &&
        themeCss.includes(".batch-simplification") &&
        themeCss.includes("env(safe-area-inset-bottom)"),
    "touch, editing guard, or safe-area CSS contract missing");
    assert(indexHtml.includes('name="viewport"') &&
        indexHtml.includes("viewport-fit=cover"),
    "mobile viewport metadata missing");

    const diagnosticMedia = new FakeMedia(false);
    const diagnostic = new MobileDriveDiagnosticPanel({
        documentRef: document,
        mobileMedia: diagnosticMedia
    });

    diagnostic.beginAttempt();
    assert(diagnostic.element.hidden,
        "Drive diagnostic panel was exposed on desktop");
    diagnosticMedia.set(true);
    diagnostic.recordAuth(true);
    diagnostic.recordPicker(true);
    diagnostic.recordScanStarted();
    diagnostic.recordFilesListRequest();
    diagnostic.recordDiscovered({ folderCount: 12, gpxCount: 34 });
    diagnostic.recordLibraryApplyStarted();
    diagnostic.recordTreeRenderStarted();
    diagnostic.recordTreeRendered({ folderCount: 12, trackCount: 34 });
    const diagnosticState = diagnostic.getState();

    assert(!diagnostic.element.hidden && diagnosticState.auth === "ok" &&
        diagnosticState.picker === "ok",
    "mobile Drive diagnostic auth or Picker status missing");
    assert(diagnosticState.scanStarted &&
        diagnosticState.filesListRequests === 1 &&
        diagnosticState.discoveredGpxCount === 34 &&
        diagnosticState.discoveredFolderCount === 12,
    "mobile Drive scan counters are incorrect");
    assert(diagnosticState.libraryApplyStarted &&
        diagnosticState.treeRenderStarted &&
        diagnosticState.treeFolderCount === 12 &&
        diagnosticState.treeTrackCount === 34,
    "mobile Drive apply or Tree counters are incorrect");
    diagnostic.recordError(
        "tree-render",
        new Error("https://example.invalid/library/secret.gpx token_12345678901234567890")
    );
    assert(!diagnostic.getState().lastErrorMessage.includes("example.invalid") &&
        !diagnostic.getState().lastErrorMessage.includes("secret.gpx") &&
        !diagnostic.getState().lastErrorMessage.includes("12345678901234567890"),
    "mobile Drive diagnostic exposed a URL, path, or token-like value");
    assert(themeCss.includes(".mobile-drive-diagnostic") &&
        themeCss.includes("@media (max-width:768px)"),
    "mobile-only Drive diagnostic CSS contract missing");

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    await run();
} catch (error) {
    output.textContent = `FAIL: ${error.stack || error}`;
    throw error;
}
