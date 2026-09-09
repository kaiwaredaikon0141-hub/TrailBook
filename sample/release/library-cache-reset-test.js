import EventBus from "../../src/js/core/EventBus.js";
import LibraryCacheResetCoordinator, {
    clearLibraryRuntime
} from "../../src/js/core/LibraryCacheResetCoordinator.js";
import DisplaySnapshotStore from "../../src/js/services/DisplaySnapshotStore.js";
import GeometryCacheRepository from "../../src/js/services/GeometryCacheRepository.js";
import LastKnownFolderPresentationCache from
    "../../src/js/services/LastKnownFolderPresentationCache.js";
import PreviousLibraryStore from "../../src/js/services/PreviousLibraryStore.js";
import ViewStateStore from "../../src/js/services/ViewStateStore.js";
import DiscoveryViewStateStore from
    "../../src/js/services/DiscoveryViewStateStore.js";
import LibraryMaintenancePanel from
    "../../src/js/ui/LibraryMaintenancePanel.js";
import ViewStateCoordinator from "../../src/js/core/ViewStateCoordinator.js";
import { createDefaultLibraryViewState } from
    "../../src/js/utils/ViewStateSchema.js";

const output = globalThis.document?.getElementById("result") ?? null;
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class MemoryStorage {
    constructor(entries = {}) { this.entries = new Map(Object.entries(entries)); }
    getItem(key) { return this.entries.get(key) ?? null; }
    setItem(key, value) { this.entries.set(key, value); }
    removeItem(key) { this.entries.delete(key); }
}

async function testPersistentCacheClears() {
    const snapshotDeletes = [];
    const snapshotStore = new DisplaySnapshotStore({
        recordKey: "last", schemaVersion: 1
    }, { adapter: {
        async get() { return null; }, async set() {},
        async delete(key) { snapshotDeletes.push(key); }
    } });
    assert(await snapshotStore.clear() && snapshotDeletes[0] === "last",
        "Display Snapshot was not deleted");

    let geometryClears = 0;
    const geometry = new GeometryCacheRepository({}, {
        adapter: { async clear() { geometryClears += 1; } }
    });
    assert(await geometry.clear() && geometryClears === 1,
        "Geometry Cache was not cleared");

    const storage = new MemoryStorage({
        "trailbook.folderPresentationCache": JSON.stringify({
            version: 1,
            libraries: { "root-name:GPX": { folders: { Trips: "#112233" } } }
        }),
        "trailbook.pendingSharedSettings": "pending",
        "trailbook.uiSettings": "shared-colors"
    });
    const presentations = new LastKnownFolderPresentationCache({ storage });
    assert(presentations.get("root-name:GPX").size === 1,
        "Folder presentation fixture did not load");
    assert(presentations.clear() && presentations.get("root-name:GPX").size === 0,
        "Folder presentation cache was not cleared");
    assert(storage.getItem("trailbook.pendingSharedSettings") === "pending" &&
        storage.getItem("trailbook.uiSettings") === "shared-colors",
    "shared settings or pending settings were deleted");

    let previousDeletes = 0;
    const previous = new PreviousLibraryStore({ recordKey: "last" }, {
        adapter: {
            async delete() { previousDeletes += 1; },
            async get() { return null; }, async set() {}
        }
    });
    assert(await previous.clear() && previousDeletes === 1,
        "Previous Library handle was not deleted");

    const viewStorage = new MemoryStorage();
    const viewState = new ViewStateStore({ storage: viewStorage });
    viewState.setBaseMap("gsiStandard");
    viewState.setLibraryState(
        "root-name:GPX",
        createDefaultLibraryViewState()
    );
    assert(viewState.clearLibraryStates() &&
        !viewState.hasLibraryState("root-name:GPX") &&
        viewState.getBaseMap() === "gsiStandard",
    "Library view state was not cleared independently of global UI state");

    const discoveryStorage = new MemoryStorage();
    const discovery = new DiscoveryViewStateStore({ storage: discoveryStorage });
    discovery.setMode("date");
    discovery.setActiveLibrary("root-name:GPX");
    discovery.setFilter({ query: "Trips", from: "", to: "" });
    assert(discovery.clearLibraryStates() && discovery.getMode() === "date" &&
        discovery.getFilter().query === "",
    "Discovery Library state was not cleared independently of mode");
}

function testPanel() {
    if (!globalThis.document) return;
    const eventBus = new EventBus();
    let requests = 0;
    let viewRequests = 0;
    eventBus.on("library-cache:reset-requested", () => { requests += 1; });
    eventBus.on("view-state:reset-requested", () => { viewRequests += 1; });
    const controlsElement = document.createElement("section");
    const viewButton = document.createElement("button");
    const viewStatus = document.createElement("p");

    controlsElement.hidden = true;
    viewButton.addEventListener("click", () => {
        eventBus.emit("view-state:reset-requested");
    });
    controlsElement.append(viewStatus, viewButton);
    const panel = new LibraryMaintenancePanel(eventBus);

    document.body.append(panel.element);

    assert(!panel.disclosure.open, "Maintenance was not initially collapsed");
    assert(panel.attachViewStateControls({
        element: controlsElement, resetButton: viewButton, status: viewStatus
    }), "View-state reset was not attached to Maintenance");
    assert(!controlsElement.isConnected &&
        panel.element.contains(viewButton) &&
        viewButton.textContent === "表示状態だけをリセット" &&
        viewButton.disabled,
    "existing view-state reset was not moved into Maintenance");
    viewButton.disabled = false;
    viewButton.click();
    assert(viewRequests === 1, "view-state reset request was not preserved");
    assert(panel.cacheResetButton.textContent.trim() ===
        "Libraryキャッシュをリセット",
        "Library cache reset button is missing");
    panel.cacheResetButton.click();
    assert(panel.cacheResetDialog.isOpen(), "reset confirmation did not open");
    panel.cacheResetDialog.element.querySelector(
        ".library-cache-reset-confirm"
    ).click();
    assert(requests === 1, "Library cache reset request was not emitted");
    panel.setCacheResetState("running");
    assert(panel.cacheResetButton.disabled &&
        panel.cacheResetStatus.textContent.includes("リセット中"),
    "Library cache reset running state is missing");
    panel.setCacheResetState("failed");
    assert(panel.cacheResetStatus.textContent.includes("できませんでした"),
        "Library cache reset failure is not shown");
    panel.element.remove();
}

function testViewPresentationReset() {
    const eventBus = new EventBus();
    let presentationResets = 0;
    let removes = 0;
    const controls = {
        confirmReset: () => true,
        setStoredStateAvailable: value => assert(value === false,
            "saved view-state control remained available")
    };
    const coordinator = new ViewStateCoordinator({
        eventBus,
        store: {
            getBaseMap: () => "osm",
            hasLibraryState: () => true,
            removeLibraryState: () => { removes += 1; return true; }
        },
        mapView: { setBaseMap() {} },
        controls,
        displayState: {},
        displayQueue: {},
        selectionState: {},
        resetPresentation: () => { presentationResets += 1; }
    });

    coordinator.activeLibraryId = "root-name:GPX";
    eventBus.emit("view-state:reset-requested");
    assert(removes === 1 && presentationResets === 1,
        "view-state reset did not clear persisted and runtime presentation");
}

function testRuntimeClear() {
    const calls = [];
    const root = { replaceChildren() { calls.push("tree-empty"); } };
    const treeView = {
        renderRequestId: 0,
        element: { querySelector: () => root },
        commitPreparedLibrary(prepared, expanded, focused) {
            assert(prepared.nodeMetadata.size === 0 && expanded.has("") && focused === "",
                "Tree reset state is not empty");
            calls.push("tree-reset");
        }
    };
    const app = {
        currentLibrary: {}, currentLibraryId: "root-name:GPX", treeView,
        clearSelection: () => calls.push("selection"),
        displayQueue: { clear: () => calls.push("queue") },
        displayState: { clearLibrary: () => calls.push("display") },
        mapView: {
            clear: () => calls.push("map"),
            resetView: () => calls.push("map-view")
        },
        trackDiscoveryCoordinator: { clearLibrary: () => calls.push("discovery") },
        librarySnapshotService: { reset: () => calls.push("library-snapshot") },
        libraryTrackCatalogCoordinator: { clear: () => calls.push("catalog") },
        folderColorControl: { setProvisionalPresentations: value => {
            assert(value.size === 0, "provisional Folder presentation survived");
            calls.push("folder-presentation");
        } },
        gpxGeometryLoader: { setLibraryNamespace: value => {
            assert(value === null, "Geometry namespace survived reset");
            calls.push("namespace");
        } },
        searchView: { setAvailable: value => {
            assert(value === false, "Search remained available");
            calls.push("search");
        } },
        librarySettingsPanel: { setAvailable: value => {
            assert(value === false, "settings panel remained visible");
        } },
        viewStateControls: { setStoredStateAvailable: value => {
            assert(value === false, "view reset remained available");
            calls.push("view-state-controls");
        } },
        previousLibraryCoordinator: { resetPersistenceState: () => calls.push("previous") }
    };

    clearLibraryRuntime(app);
    assert(app.currentLibrary === null && app.currentLibraryId === null,
        "active Library survived reset");
    ["tree-empty", "display", "map", "discovery", "catalog", "search",
        "view-state-controls", "previous"]
        .forEach(name => assert(calls.includes(name), `${name} was not reset`));
}

async function testCoordinator() {
    const eventBus = new EventBus();
    const states = [];
    const clears = [];
    let runtimeClears = 0;
    const busyStates = [];
    let permissionRequests = 0;
    let libraryFileWrites = 0;
    const coordinator = new LibraryCacheResetCoordinator({
        eventBus,
        panel: { setCacheResetState: state => states.push(state) },
        confirmReset: () => true,
        prepare: async () => {},
        clearers: ["snapshot", "geometry", "handle"].map(name => ({
            name, clear: async () => { clears.push(name); return true; }
        })),
        setBusy: busy => busyStates.push(busy),
        clearRuntime: () => { runtimeClears += 1; }
    });
    coordinator.bind();
    const result = await coordinator.reset();

    assert(result.status === "success" && clears.length === 3,
        "successful reset did not clear every cache");
    assert(runtimeClears === 1 && states.join(",") === "running,success",
        "successful reset did not clear runtime exactly once");
    assert(busyStates.join(",") === "true,false",
        "Library switching was not bounded during reset");
    assert(permissionRequests === 0 && libraryFileWrites === 0,
        "reset requested permission or changed a Library file");

    const errors = [];
    const failed = new LibraryCacheResetCoordinator({
        eventBus: new EventBus(),
        panel: { setCacheResetState: state => states.push(state) },
        confirmReset: () => true,
        clearers: [{ name: "geometry", clear: async () => false }],
        clearRuntime: () => { runtimeClears += 1; },
        reportError: (message, detail) => errors.push({ message, detail })
    });
    const failure = await failed.reset();

    assert(failure.status === "failed" && failure.failures[0] === "geometry",
        "partial failure was silently reported as success");
    assert(runtimeClears === 1 && errors.length === 1,
        "partial failure cleared runtime or was not reported");

    const cancelled = new LibraryCacheResetCoordinator({
        eventBus: new EventBus(), confirmReset: () => false,
        clearers: [{ name: "unexpected", clear: async () => false }]
    });
    assert((await cancelled.reset()).status === "cancelled",
        "cancel did not stop reset");
}

async function run() {
    await testPersistentCacheClears();
    testPanel();
    testViewPresentationReset();
    testRuntimeClear();
    await testCoordinator();
    if (output) output.textContent = `${assertions} assertions: Pass`;
    else console.log(`${assertions} assertions: Pass`);
}

run().catch(error => {
    if (output) output.textContent = `${assertions} assertions: Fail\n${error.stack}`;
    else console.error(error);
    globalThis.process && (process.exitCode = 1);
});
