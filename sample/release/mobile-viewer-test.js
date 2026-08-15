import TrackInfoView from "../../src/js/ui/TrackInfoView.js";
import ViewStateControls from "../../src/js/ui/ViewStateControls.js";
import Toolbar from "../../src/js/ui/Toolbar.js";
import LibraryAccessPanel from "../../src/js/ui/LibraryAccessPanel.js";

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

    shell.className = "sidebar-shell is-mobile-open";
    close.className = "mobile-sidebar-close";
    close.textContent = "Close";
    fixed.className = "sidebar-fixed-controls";
    search.className = "search-view";
    search.innerHTML = '<input class="search-input"><p class="search-summary">1122 GPX</p>';
    dates.className = "search-date-filter";
    dates.innerHTML = '<label><span>From</span><input type="date"></label>' +
        '<label><span>To</span><input type="date"></label>' +
        '<button class="search-filter-clear">Clear</button>';
    search.append(dates);
    modes.className = "discovery-mode-switch";
    modes.innerHTML = "<button>Folder</button><button>Date</button>";
    drive.className = "drive-library-control";
    drive.innerHTML = "<button>別のGoogle Drive Libraryに直接接続</button>" +
        '<p class="drive-library-description">TrailBookからGoogle Driveへ接続</p>' +
        '<p class="drive-library-status">Drive Library: 1122 GPX</p>';
    fixed.append(search, modes, drive);
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
            '<span class="folder-color-mode">Explicit</span></button></div>';
        tree.append(item);
    }
    sidebar.append(tree);
    shell.append(close, fixed, sidebar);
    document.body.append(shell);
    return { shell, close, fixed, search, modes, drive, sidebar, tree };
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
    assert(layoutCss.includes("flex-direction:column") &&
        layoutCss.includes("overflow-y:auto") &&
        layoutCss.includes("flex:1 0 240px"),
    "mobile Sidebar is not a scrollable vertical flow");
    assert(themeCss.includes("min-height:44px") &&
        themeCss.includes(".track-editor") &&
        themeCss.includes(".batch-simplification") &&
        themeCss.includes("env(safe-area-inset-bottom)"),
    "touch, editing guard, or safe-area CSS contract missing");
    assert(themeCss.includes(
        "left:max(52px, calc(env(safe-area-inset-left) + 44px))"
    ), "mobile Library control does not clear the Leaflet zoom control");
    assert(themeCss.includes("grid-column:1 / -1") &&
        themeCss.includes("flex:0 0 76px") &&
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

    accessCopy.showInitial();
    assert(toolbarCopy.pickFolderButton.textContent.includes(
        "端末からライブラリを開く"
    ), "local Library action wording is unclear");
    assert(accessCopy.element.textContent.includes("端末・Files・Google Driveなど"),
        "local Library source explanation is missing");
    assert(!themeCss.includes(".mobile-drive-diagnostic"),
        "obsolete Mobile Drive diagnostic CSS remains");

    if (matchMedia("(max-width:768px)").matches) {
        const probe = createMobileSidebarProbe();
        const flow = [probe.close, probe.fixed, probe.sidebar]
            .map(element => element.getBoundingClientRect());
        const row = probe.tree.querySelector(".tree-row");
        const label = row.querySelector(".tree-label").getBoundingClientRect();
        const colorButton = row.querySelector(".folder-color-control");
        const color = colorButton.getBoundingClientRect();

        assert(flow[0].bottom <= flow[1].top + 1 &&
            flow[1].bottom <= flow[2].top + 1,
        "mobile Sidebar sections overlap vertically");
        assert(probe.sidebar.scrollHeight > probe.sidebar.clientHeight,
            "1122-row Folder Tree is not vertically scrollable");
        assert(probe.shell.scrollWidth <= probe.shell.clientWidth + 1 &&
            probe.sidebar.scrollWidth <= probe.sidebar.clientWidth + 1,
        "mobile Sidebar introduces horizontal scrolling");
        assert(label.right <= color.left + 1 && color.width >= 75 &&
            color.height >= 43,
        "Folder label and Explicit color control overlap");
        let colorActivations = 0;

        colorButton.addEventListener("click", () => { colorActivations += 1; });
        colorButton.click();
        assert(colorActivations === 1,
            "Explicit color control is not operable in the mobile row");
        assert(getComputedStyle(probe.shell).overflowY === "auto" &&
            getComputedStyle(probe.sidebar).overflowY === "auto",
        "mobile Sidebar or Tree scrolling contract is inactive");
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
