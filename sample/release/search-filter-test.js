import EventBus from "../../src/js/core/EventBus.js";
import TrackDiscoveryCoordinator from "../../src/js/core/TrackDiscoveryCoordinator.js";
import TrackDiscoveryEntry, {
    DATE_SOURCES
} from "../../src/js/models/TrackDiscoveryEntry.js";
import DiscoveryFilterService, {
    MAX_FILTER_RESULTS
} from "../../src/js/services/DiscoveryFilterService.js";
import DiscoveryViewStateStore from "../../src/js/services/DiscoveryViewStateStore.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import FolderTreeFilterProjection from "../../src/js/ui/FolderTreeFilterProjection.js";
import SearchView, { SEARCH_DEBOUNCE_MS } from "../../src/js/ui/SearchView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class FakeMedia {
    constructor(matches = false) {
        this.matches = matches;
        this.listeners = [];
    }
    addEventListener(name, listener) {
        if (name === "change") this.listeners.push(listener);
    }
    removeEventListener(name, listener) {
        if (name === "change") {
            this.listeners = this.listeners.filter(candidate => candidate !== listener);
        }
    }
    set(matches) {
        this.matches = matches;
        this.listeners.forEach(listener => listener({ matches }));
    }
}

function entry(path, name, date) {
    return new TrackDiscoveryEntry({
        relativePath: path,
        folderPath: path.slice(0, path.lastIndexOf("/")),
        originalFileName: path.split("/").pop(),
        displayName: name,
        resolvedDate: date,
        dateSource: date ? DATE_SOURCES.METADATA : DATE_SOURCES.UNKNOWN
    });
}

function memoryStorage() {
    let value = null;
    return {
        getItem() { return value; },
        setItem(_key, next) { value = next; }
    };
}

function row(path, kind) {
    const item = document.createElement("li");
    const element = document.createElement("div");

    element.dataset.treePath = path;
    element.dataset.nodeKind = kind;
    item.append(element);
    return item;
}

async function flush(delay = 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
}

function testMobileSearchDisclosure() {
    const eventBus = new EventBus();
    const mobileMedia = new FakeMedia(true);
    const searchView = new SearchView(eventBus, { mobileMedia });

    searchView.setAvailable(true);
    assert(!searchView.disclosure.open,
        "mobile Search was not collapsed by default");
    searchView.disclosure.open = true;
    searchView.disclosure.dispatchEvent(new Event("toggle"));
    assert(searchView.mobileExpanded,
        "mobile Search expanded state was not retained");
    searchView.setFilter({ query: "ridge", from: "", to: "" });
    assert(searchView.element.classList.contains("has-active-filter") &&
        searchView.disclosureLabel.textContent === "検索（条件あり）",
    "collapsed Search does not indicate an active filter");
    searchView.disclosure.open = false;
    searchView.disclosure.dispatchEvent(new Event("toggle"));
    assert(searchView.disclosureLabel.textContent === "検索（条件あり）",
        "active filter indication disappeared while collapsed");
    mobileMedia.set(false);
    assert(searchView.disclosure.open,
        "desktop Search was left collapsed");
    searchView.reset();
    assert(!searchView.element.classList.contains("has-active-filter") &&
        searchView.disclosureLabel.textContent === "検索",
    "Search reset retained the active indication");
    searchView.fromInput.value = "2026-08-01";
    searchView.fromInput.dispatchEvent(new Event("input", { bubbles: true }));
    assert(searchView.disclosureLabel.textContent === "検索（条件あり）",
        "date-only filter is not indicated");
    searchView.clearButton.click();
    assert(searchView.disclosureLabel.textContent === "検索",
        "Clear did not reset the compact Search indication");
    searchView.destroy();
    assert(mobileMedia.listeners.length === 0,
        "Search media-query listener was not cleaned up");
}

function testSemantics() {
    const service = new DiscoveryFilterService();
    const brokenNameSummary = new TrackSummaryBuilder().build(
        "msx/2022-01-02_12-39_Sun_reduce.gpx",
        {
            name: "2022-01-02_12-39_Sun_reduce.gpx",
            size: 1,
            lastModified: 1
        },
        {
            metadata: { name: null, time: null },
            tracks: [{ name: "���", segments: [] }],
            waypoints: []
        }
    );
    const entries = [
        entry("Library/北/alpha.gpx", "Morning Ride", new Date(2026, 7, 8, 12)),
        entry("Library/南/beta.gpx", "ＥＶＥＮＩＮＧ", new Date(2026, 6, 1, 12)),
        entry("Library/北/unknown.gpx", "不明日", null),
        new TrackDiscoveryEntry({
            relativePath: "Library/西/multi.gpx",
            folderPath: "Library/西",
            originalFileName: "multi.gpx",
            displayName: "Metadata title",
            trackNames: ["Actual Track"],
            dateSource: DATE_SOURCES.UNKNOWN
        }),
        brokenNameSummary
    ];

    assert(service.filter(entries, { query: "morning" }).totalCount === 1,
        "case-insensitive Track name search");
    assert(service.filter(entries, { query: "evening" }).totalCount === 1,
        "NFKC search");
    assert(service.filter(entries, { query: "北" }).totalCount === 2,
        "Japanese Folder path search");
    assert(service.filter(entries, { query: "不明" }).totalCount === 1,
        "Unknown Date missing from text-only search");
    assert(service.filter(entries, { query: "actual track" }).totalCount === 1,
        "secondary Track name search");
    assert(service.filter(entries, {
        query: "2022-01-02_12-39"
    }).results[0]?.displayName === "2022-01-02_12-39_Sun_reduce.gpx",
    "Search did not use shared filename fallback");
    assert(service.filter(entries, { query: "���" }).totalCount === 0,
        "broken Track name remained searchable");
    assert(service.filter(entries, { from: "2026-08-01" }).totalCount === 1,
        "inclusive from or Unknown exclusion");
    assert(service.filter(entries, { to: "2026-07-01" }).totalCount === 2,
        "inclusive to boundary");
    assert(service.filter(entries, {
        from: "2026-07-01",
        to: "2026-08-08"
    }).totalCount === 2, "inclusive date range");
    assert(service.filter(entries, {
        from: "2026-08-08",
        to: "2026-07-01"
    }).totalCount === 0, "reversed range should not match");
    assert(service.filter(entries, { query: "missing" }).totalCount === 0,
        "zero-result state");
    const many = Array.from({ length: 806 }, (_, index) => entry(
        `Library/Tracks/${index}.gpx`,
        `Track ${index}`,
        new Date(2026, 0, 1)
    ));
    const bounded = service.filter(many, { query: "track" });
    assert(bounded.totalCount === 806, "total count lost");
    assert(bounded.results.length === MAX_FILTER_RESULTS, "100 result limit");
}

function testStateStore() {
    const storage = memoryStorage();
    const store = new DiscoveryViewStateStore({ storage });

    store.setActiveLibrary("Library-A");
    store.setFilter({ query: "北", from: "2026-01-01", to: "" });
    store.setActiveLibrary("Library-B");
    assert(store.getFilter().query === "", "filter leaked to another Library");
    store.setFilter({ query: "south" });
    store.setActiveLibrary("Library-A");
    assert(store.getFilter().query === "北", "Library filter not restored");
    const restored = new DiscoveryViewStateStore({ storage });
    restored.setActiveLibrary("Library-B");
    assert(restored.getFilter().query === "south", "device-local state not persisted");
}

async function testLazyFolderProjection() {
    const root = document.createElement("ul");
    const library = row("", "folder");
    const north = row("Library/北", "folder");
    const south = row("Library/南", "folder");
    const match = row("Library/北/alpha.gpx", "file");
    const miss = row("Library/南/beta.gpx", "file");

    root.append(library, north, south, match, miss);
    const projection = new FolderTreeFilterProjection(root);
    projection.setMatchingPaths(["Library/北/alpha.gpx"]);
    assert(!match.hidden && !north.hidden && !library.hidden,
        "matching path ancestors hidden");
    assert(miss.hidden && south.hidden, "nonmatching branch visible");
    const lazyMiss = row("Library/南/lazy.gpx", "file");
    root.append(lazyMiss);
    await flush();
    assert(lazyMiss.hidden, "lazy DOM bypassed filter");
    projection.clear();
    assert(!miss.hidden && !lazyMiss.hidden, "Clear did not restore Folder Tree");
    projection.destroy();
}

async function testCoordinator() {
    const eventBus = new EventBus();
    const displayState = new DisplayState();
    const storage = memoryStorage();
    const modeStore = new DiscoveryViewStateStore({ storage });
    const summaries = new Map([
        ["Library/北/alpha.gpx", entry(
            "Library/北/alpha.gpx", "Alpha", new Date(2026, 7, 8)
        )],
        ["Library/南/beta.gpx", entry(
            "Library/南/beta.gpx", "Beta", new Date(2025, 0, 1)
        )]
    ]);
    let loads = 0;
    const loader = {
        setLibraryNamespace() {},
        async loadSummary(path) {
            loads += 1;
            return summaries.get(path);
        }
    };
    const coordinator = new TrackDiscoveryCoordinator({
        eventBus,
        loader,
        displayState,
        modeStore
    });
    const folderTree = document.createElement("ul");
    const sidebar = document.createElement("section");
    const searchView = new SearchView(eventBus);
    const handles = [...summaries.keys()].map(path => ({
        path,
        fileHandle: { name: path.split("/").pop() }
    }));

    sidebar.append(searchView.element, folderTree);
    folderTree.append(
        row("", "folder"),
        row("Library/北", "folder"),
        row("Library/南", "folder"),
        row("Library/北/alpha.gpx", "file"),
        row("Library/南/beta.gpx", "file")
    );
    coordinator.attach({ folderTree, searchView });
    coordinator.bindEvents();
    displayState.setLibrary({});
    handles.forEach(({ path, fileHandle }) =>
        displayState.registerFile(path, fileHandle, "#123456")
    );
    searchView.setAvailable(true);
    coordinator.setLibrary({
        namespace: "test",
        libraryId: "Library-A",
        fileEntries: handles,
        generation: 1,
        isCurrent: () => true
    });
    eventBus.emit("search:filter-changed", {
        filter: { query: "Alpha", from: "", to: "" }
    });
    await flush(20);
    assert(loads === 2, "Discovery Index did not build exactly once per GPX");
    assert(searchView.results.length === 1, "Search result projection mismatch");
    assert(searchView.element.classList.contains("has-active-filter"),
        "coordinator-driven Search did not expose its active state");
    assert(searchView.results[0].path === "Library/北/alpha.gpx",
        "Track result path mismatch");
    assert(!displayState.getDisplay("Library/南/beta.gpx").checked,
        "filter changed Map visibility");
    eventBus.emit("search:filter-changed", {
        filter: { query: "", from: "", to: "" }
    });
    await flush();
    assert(loads === 2, "Clear rebuilt or reparsed the Index");
    assert(searchView.results.length === 0, "Clear retained Search results");
    assert(!searchView.element.classList.contains("has-active-filter"),
        "cleared coordinator filter retained its active state");

    searchView.input.value = "Beta";
    searchView.input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(SEARCH_DEBOUNCE_MS + 25);
    assert(searchView.results[0]?.name === "Beta", "debounced input not applied");
}

try {
    testSemantics();
    testStateStore();
    testMobileSearchDisclosure();
    await testLazyFolderProjection();
    await testCoordinator();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack || error}`;
}
