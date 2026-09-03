import EventBus from "../../src/js/core/EventBus.js";
import App from "../../src/js/core/App.js";
import TrackDiscoveryCoordinator from "../../src/js/core/TrackDiscoveryCoordinator.js";
import TrackDiscoveryEntry, {
    DATE_SOURCES
} from "../../src/js/models/TrackDiscoveryEntry.js";
import DateTreeBuilder from "../../src/js/services/DateTreeBuilder.js";
import DiscoveryViewStateStore from "../../src/js/services/DiscoveryViewStateStore.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import DateTreeView from "../../src/js/ui/DateTreeView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function entry(path, date, displayName = path) {
    return new TrackDiscoveryEntry({
        relativePath: path,
        folderPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
        originalFileName: path.split("/").pop(),
        displayName,
        resolvedDate: date,
        dateSource: date ? DATE_SOURCES.METADATA : DATE_SOURCES.UNKNOWN
    });
}

function memoryStorage(initial = null) {
    let value = initial;
    return {
        getItem() { return value; },
        setItem(_key, next) { value = next; },
        value() { return value; }
    };
}

function flush() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function testBuilder() {
    const builder = new DateTreeBuilder();
    const groups = builder.build([
        entry("old.gpx", new Date(2025, 0, 2, 10), "Old"),
        entry("same-b.gpx", new Date(2026, 7, 8, 12), "Beta"),
        entry("same-a.gpx", new Date(2026, 7, 8, 12), "Alpha"),
        entry("new.gpx", new Date(2026, 7, 8, 18), "New"),
        entry("previous-day.gpx", new Date(2026, 7, 7, 23), "Previous Day"),
        entry("cross-month.gpx", new Date(2026, 6, 31, 23), "Cross Month"),
        entry("unknown.gpx", null, "Unknown")
    ]);

    assert(Object.isFrozen(groups), "root groups are mutable");
    assert(groups.map(group => group.label).join(",") === "2026年,2025年,Unknown Date",
        "year or Unknown ordering");
    assert(groups[0].children[0].label === "8月", "month label");
    assert(groups[0].children[0].children.every(item => item.relativePath),
        "day group was generated");
    const tracks = groups[0].children[0].children;
    assert(tracks.map(item => item.displayName).join(",") === "New,Alpha,Beta,Previous Day",
        "resolvedDate/displayName stable ordering");
    assert(groups[0].children[1].label === "7月" &&
        groups[0].children[1].children[0].displayName === "Cross Month",
        "resolvedDate start month grouping");
    assert(tracks[0] === groups[0].children[0].children[0],
        "entries were copied instead of referenced");
    assert(groups.at(-1).kind === "unknown" &&
        groups.at(-1).children[0].relativePath === "unknown.gpx",
        "Unknown Date behavior changed");
}

function testModeStore() {
    const storage = memoryStorage();
    const store = new DiscoveryViewStateStore({ storage });
    assert(store.getMode() === "folder", "default mode");
    assert(store.setMode("date"), "date mode not stored");
    assert(JSON.parse(storage.value()).mode === "date", "stored mode value");
    assert(!store.setMode("invalid"), "invalid mode accepted");
    const restored = new DiscoveryViewStateStore({ storage });
    assert(restored.getMode() === "date", "mode not restored");
    const invalid = new DiscoveryViewStateStore({
        storage: memoryStorage('{"version":99,"mode":"date"}')
    });
    assert(invalid.getMode() === "folder", "unknown schema accepted");
}

function testLargeLazyProjection() {
    const entries = Array.from({ length: 806 }, (_, index) => entry(
        `bulk/track-${index}.gpx`,
        new Date(2024 + (index % 3), index % 12, (index % 28) + 1, index % 24),
        `Track ${index}`
    ));
    const view = new DateTreeView(new EventBus());
    const groups = new DateTreeBuilder().build(entries);
    view.showTree(groups, {
        fileHandles: new Map(),
        getDisplay: () => null
    });
    assert(groups.length === 3, "806 entries were not grouped by year");
    assert(view.root.querySelectorAll(".date-tree-track-row").length === 0,
        "806 Track rows were eagerly rendered");
}

function testView() {
    const eventBus = new EventBus();
    const view = new DateTreeView(eventBus);
    const displayState = new DisplayState();
    const fileHandle = { name: "new.gpx" };
    const items = [
        entry("new.gpx", new Date(2026, 7, 8, 18), "New"),
        entry("other.gpx", new Date(2025, 0, 2), "Other")
    ];
    const groups = new DateTreeBuilder().build(items);
    let selected = null;
    let toggled = null;
    eventBus.on("gpx:selection-requested", value => { selected = value; });
    eventBus.on("gpx:display-toggled", value => { toggled = value; });
    displayState.setLibrary({});
    displayState.registerFile("new.gpx", fileHandle, "#000000");
    displayState.registerFile("other.gpx", { name: "other.gpx" }, "#000000");
    view.showTree(groups, {
        fileHandles: new Map([["new.gpx", fileHandle]]),
        getDisplay: path => displayState.getDisplay(path)
    });

    assert(view.root.children.length === 2, "top-level group rendering");
    assert(view.root.querySelectorAll(".date-tree-track-row").length === 0,
        "initial DOM eagerly rendered Tracks");
    view.root.querySelector(".date-tree-group-row").click();
    assert(view.root.querySelectorAll(".date-tree-track-row").length === 0,
        "year expansion eagerly rendered Tracks");
    view.root.querySelector(".date-tree-group-row[aria-expanded='true'] + ul .date-tree-group-row").click();
    const trackRow = view.root.querySelector(".date-tree-track-row");
    assert(trackRow, "month expansion did not render Tracks");
    const colorIndicator = trackRow.querySelector(".date-tree-color-indicator");
    assert(colorIndicator.style.backgroundColor &&
        colorIndicator.getAttribute("aria-label").includes("#000000"),
    "Date Track resolved color indicator missing");
    assert(view.root.querySelectorAll(".date-tree-track-row").length === 1,
        "unexpanded months rendered Tracks");
    assert(![...view.root.querySelectorAll(".date-tree-group-row")]
        .some(row => /日$/.test(row.querySelector(".date-tree-label")?.textContent || "")),
        "Date Tree rendered a day node");
    trackRow.click();
    assert(selected?.path === "new.gpx" && selected.source === "tree" && selected.refocus,
        "selection event contract");
    const checkbox = trackRow.querySelector("input");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    assert(toggled?.path === "new.gpx" && toggled.fileHandle === fileHandle && toggled.checked,
        "display toggle event contract");
    const spaceEvent = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true
    });
    trackRow.dispatchEvent(spaceEvent);
    assert(
        toggled?.checked === false,
        `Track row Space did not toggle display: key=${spaceEvent.key}, code=${spaceEvent.code}, prevented=${spaceEvent.defaultPrevented}, checked=${checkbox.checked}`
    );
    selected = null;
    trackRow.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true
    }));
    assert(selected?.path === "new.gpx", "Track row Enter did not select");
    assert(trackRow.getAttribute("role") === "treeitem", "Track ARIA role");
    displayState.setChecked("new.gpx", true);
    view.syncDisplay("new.gpx");
    assert(checkbox.checked, "DisplayState checked not projected");
    view.setSelectedPath("new.gpx");
    assert(trackRow.getAttribute("aria-current") === "true", "selection ARIA");
    view.setSelectedPath(null);
    assert(!trackRow.hasAttribute("aria-current"), "selection clear");
    const yearRow = view.root.querySelector(".date-tree-group-row");

    yearRow.click();
    assert(yearRow.getAttribute("aria-expanded") === "false",
        "test setup did not collapse selected year");
    const checkedBeforeReveal = displayState.getCheckedPaths().join(",");

    view.setSelectedPath("new.gpx", { reveal: true });
    const revealedMonth = yearRow.nextElementSibling.querySelector(
        ".date-tree-group-row"
    );
    const revealedTrack = view.renderedTrackRows.get("new.gpx");

    assert(yearRow.getAttribute("aria-expanded") === "true" &&
        revealedMonth.getAttribute("aria-expanded") === "true",
    "selection reveal did not expand year/month");
    assert(revealedTrack?.getAttribute("aria-current") === "true",
        "revealed Date Track was not selected");
    assert(displayState.getCheckedPaths().join(",") === checkedBeforeReveal,
        "Date selection reveal changed visibility");
}

function testGroupBulk() {
    const eventBus = new EventBus();
    const displayState = new DisplayState();
    const view = new DateTreeView(eventBus);
    const items = [
        entry("bulk/a.gpx", new Date(2026, 7, 8, 12), "A"),
        entry("bulk/b.gpx", new Date(2026, 7, 8, 11), "B"),
        entry("bulk/c.gpx", new Date(2026, 6, 1, 10), "C")
    ];
    const handles = new Map(items.map(item => [
        item.relativePath,
        { name: item.originalFileName }
    ]));
    let bulk = null;
    let bulkEvents = 0;
    let selections = 0;

    eventBus.on("folder:display-toggled", value => {
        bulk = value;
        bulkEvents += 1;
    });
    eventBus.on("gpx:selection-requested", () => { selections += 1; });
    displayState.setLibrary({});
    items.forEach(item => displayState.registerFile(
        item.relativePath,
        handles.get(item.relativePath),
        "#000000"
    ));
    view.showTree(new DateTreeBuilder().build(items), {
        fileHandles: handles,
        getDisplay: path => displayState.getDisplay(path)
    });

    const checkbox = view.root.querySelector(".date-tree-group-checkbox");
    assert(!checkbox.checked && !checkbox.indeterminate,
        "empty group state is not unchecked");
    displayState.setChecked("bulk/a.gpx", true);
    view.syncDisplay("bulk/a.gpx");
    assert(!checkbox.checked && checkbox.indeterminate,
        "partial group state is not indeterminate");
    displayState.setChecked("bulk/b.gpx", true);
    displayState.setChecked("bulk/c.gpx", true);
    view.syncDisplay("bulk/b.gpx");
    view.syncDisplay("bulk/c.gpx");
    assert(checkbox.checked && !checkbox.indeterminate,
        "complete group state is not checked");
    assert(view.root.querySelectorAll(".date-tree-track-row").length === 0,
        "group state required expanded Track DOM");
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    assert(
        bulk?.checked === false &&
        bulk.source === "date-tree" &&
        bulk.preserveMapView === true &&
        bulk.preserveSelection === true,
        "Date group did not use bulk display event");
    assert(bulkEvents === 1, "Date group emitted per-Track bulk events");
    assert(bulk?.fileEntries.length === 3,
        "collapsed descendants missing from bulk event");
    assert(selections === 0, "Date group bulk changed selection");
}

function testMapPreservationContract() {
    const app = new App();
    const fileHandle = { name: "preserve.gpx" };
    let startOptions = null;
    let stopOptions = null;

    app.treeView = { setDisplayChecked() {} };
    app.displayState.registerFile("preserve.gpx", fileHandle, "#000000");
    app.startDisplay = (_path, _handle, options) => { startOptions = options; };
    app.stopDisplay = (_path, options) => { stopOptions = options; };
    app.handleDisplayToggled({
        path: "preserve.gpx",
        fileHandle,
        checked: true,
        preserveMapView: true
    });
    assert(startOptions?.refocus === false,
        "Date bulk ON did not suppress Map refocus");
    app.handleDisplayToggled({
        path: "preserve.gpx",
        fileHandle,
        checked: false,
        preserveMapView: true,
        preserveSelection: true
    });
    assert(stopOptions?.refocus === false,
        "Date bulk OFF did not suppress Map refocus");
    assert(stopOptions?.preserveSelection === true,
        "Date bulk OFF did not preserve selection contract");

    const keepApp = new App();
    keepApp.treeView = {
        setDisplayChecked() {},
        setDisplayIdle() {}
    };
    keepApp.mapView = { removeGPX() {} };
    keepApp.scheduleSearchRefresh = () => {};
    keepApp.updateDisplayStatus = () => {};
    keepApp.displayState.registerFile("selected.gpx", fileHandle, "#000000");
    keepApp.displayState.setChecked("selected.gpx", true);
    keepApp.selectionState.select("selected.gpx", "tree");
    keepApp.stopDisplay("selected.gpx", {
        refocus: false,
        preserveSelection: true
    });
    assert(keepApp.selectionState.isSelected("selected.gpx"),
        "Date bulk OFF cleared selected Track");
}

async function testCoordinator() {
    const eventBus = new EventBus();
    const displayState = new DisplayState();
    const storage = memoryStorage();
    const modeStore = new DiscoveryViewStateStore({ storage });
    let loads = 0;
    const summaries = new Map([
        ["a.gpx", entry("a.gpx", new Date(2026, 0, 1), "A")],
        ["b.gpx", entry("b.gpx", null, "B")]
    ]);
    const loader = {
        setLibraryNamespace() {},
        async loadSummary(path) { loads += 1; return summaries.get(path); }
    };
    const coordinator = new TrackDiscoveryCoordinator({
        eventBus,
        loader,
        displayState,
        modeStore
    });
    const folderTree = document.querySelector("#sidebar .tree-root");
    const sidebarShell = coordinator.attach({ folderTree });
    coordinator.bindEvents();
    assert(sidebarShell.matches(".sidebar-shell"), "sidebar shell missing");
    assert(folderTree.closest(".sidebar") !== null,
        "Folder Tree left the independent scroll region");
    assert(!coordinator.trackInfo.element.closest(".sidebar"),
        "Track Info was placed inside the Track list scroll region");
    assert(sidebarShell.lastElementChild === coordinator.trackInfo.element,
        "Track Info is not fixed at the sidebar bottom");
    const handles = ["a.gpx", "b.gpx"].map(path => ({
        path,
        fileHandle: { name: path }
    }));

    coordinator.setSourceResolver({
        resolve: path => ({
            status: "ready",
            relativePath: path,
            actualFileHandle: handles.find(entry => entry.path === path)
                ?.fileHandle
        })
    });
    displayState.setLibrary({});
    handles.forEach(({ path, fileHandle }) =>
        displayState.registerFile(path, fileHandle, "#000000")
    );
    coordinator.setLibrary({
        namespace: "date-tree-test",
        fileEntries: handles,
        generation: 1,
        isCurrent: () => true
    });
    assert(loads === 0, "Folder mode eagerly built Discovery Index");
    assert(!folderTree.hidden, "Folder Tree hidden before Date mode");
    coordinator.setMode("date");
    await flush();
    await flush();
    assert(loads === 2, "Date mode did not build one entry per GPX");
    assert(folderTree.hidden && !coordinator.dateTree.element.hidden,
        "Folder/Date projection switch");
    assert(coordinator.dateTree.root.children.length === 2,
        "Date and Unknown groups missing");
    const checkedBeforeSelection = displayState.getCheckedPaths().join(",");

    eventBus.emit("selection:changed", { path: "a.gpx", source: "map" });
    const yearRow = coordinator.dateTree.root.querySelector(
        ".date-tree-group-row"
    );
    const monthRow = yearRow.nextElementSibling.querySelector(
        ".date-tree-group-row"
    );
    const trackRow = coordinator.dateTree.root.querySelector(
        ".date-tree-track-row"
    );

    assert(yearRow.getAttribute("aria-expanded") === "true" &&
        monthRow.getAttribute("aria-expanded") === "true",
    "Map selection did not reveal collapsed Date year/month");
    assert(trackRow.getAttribute("aria-current") === "true",
        "Map selection did not select the Date Track row");
    assert(displayState.getCheckedPaths().join(",") === checkedBeforeSelection,
        "Map selection changed Date visibility");
    displayState.setChecked("a.gpx", true);
    await flush();
    assert(trackRow.querySelector("input").checked,
        "DisplayState subscription did not synchronize Date Tree");
    eventBus.emit("selection:changed", { path: "a.gpx", source: "map" });
    assert(trackRow.getAttribute("aria-current") === "true",
        "SelectionState event did not synchronize Date Tree");
    await flush();
    assert(
        coordinator.trackInfo.view.element.querySelector(
            '[data-track-info-field="displayName"]'
        ).textContent === "A",
        "SelectionState event did not synchronize Track Info"
    );
    assert(loads === 2, "Track Info duplicated a prepared summary load");
    const checkedBeforeSwitch = displayState.getCheckedPaths().join(",");
    coordinator.setMode("folder");
    assert(!folderTree.hidden && coordinator.dateTree.element.hidden,
        "Date/Folder projection switch");
    assert(displayState.getCheckedPaths().join(",") === checkedBeforeSwitch,
        "Tree switch changed visibility");
    assert(modeStore.getMode() === "folder", "mode state not synchronized");
    coordinator.setMode("date");
    await flush();
    assert(coordinator.dateTree.renderedTrackRows.get("a.gpx")
        ?.getAttribute("aria-current") === "true",
    "Folder/Date switch did not restore current Date selection");
    coordinator.clearLibrary();
    assert(loads === 2 && !folderTree.hidden, "Library clear rebuilt or hid Folder Tree");
}

try {
    testBuilder();
    testModeStore();
    testLargeLazyProjection();
    testView();
    testGroupBulk();
    testMapPreservationContract();
    await testCoordinator();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.stack || error}`;
}
