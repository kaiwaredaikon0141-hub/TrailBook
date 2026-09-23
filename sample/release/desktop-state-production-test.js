import App from "../../src/js/core/App.js";
import TrackSourceResolver from "../../src/js/core/TrackSourceResolver.js";
import Folder from "../../src/js/models/Folder.js";
import Library from "../../src/js/models/Library.js";
import TrackSummaryBuilder from "../../src/js/services/TrackSummaryBuilder.js";

const output = document.getElementById("result");
const SESSION_QUERY = new URLSearchParams(location.search).has("session");
const LIBRARY_NAME = "Desktop State Production";
const NAMESPACE = "local:desktop-state-production";
const TRACKS = ["one.gpx", "two.gpx"];
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function waitFor(predicate, message, timeout = 5000) {
    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
        const poll = () => {
            if (predicate()) return resolve();
            if (performance.now() - startedAt > timeout) {
                return reject(new Error(message));
            }
            setTimeout(poll, 10);
        };
        poll();
    });
}

function geometry(offset) {
    return {
        metadata: null,
        tracks: [{
            segments: [{ points: [
                { latitude: 34.5 + offset, longitude: 135.5 + offset },
                { latitude: 34.6 + offset, longitude: 135.6 + offset }
            ] }]
        }],
        waypoints: [],
        warnings: []
    };
}

function createLibraryFixture() {
    const rootHandle = { kind: "directory", name: LIBRARY_NAME };
    const root = new Folder(LIBRARY_NAME, rootHandle);
    const files = TRACKS.map((name, index) => {
        const file = new File([
            `<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="${34.5 + index}" lon="${135.5 + index}"/></trkseg></trk></gpx>`
        ], name, { type: "application/gpx+xml", lastModified: 1700000000000 + index });
        return {
            kind: "file",
            name,
            provisional: false,
            async getFile() { return file; },
            file,
            result: geometry(index / 10)
        };
    });

    root.gpxFiles.push(...files);
    return {
        library: new Library(LIBRARY_NAME, root, 1, files.length),
        files
    };
}

async function createSession({ actual = false } = {}) {
    document.body.innerHTML = '<main id="app"></main><pre id="session-result"></pre>';
    const sessionResult = document.getElementById("session-result");
    const app = new App();

    app.getColor = () => "#8f8300";
    app.librarySettingsCoordinator.load = async () => ({ source: "none" });
    app.librarySettingsCoordinator.applyLoad = () => true;
    app.initialize();
    await waitFor(
        () => app.displaySnapshotCoordinator.getStatus().restoreState === "phaseB",
        "startup did not reach Fast Restore phase B"
    );

    if (actual) {
        const fixture = createLibraryFixture();
        const resolver = new TrackSourceResolver({
            catalog: app.libraryTrackCatalogCoordinator.catalog,
            getLibraryIdentity: () => app.gpxGeometryLoader.namespace
        });

        app.gpxGeometryLoader.setSourceResolver(resolver);
        app.trackDiscoveryCoordinator.setSourceResolver(resolver);
        await app.handleLibraryLoaded(fixture.library, {
            generation: 1,
            isCurrent: () => true,
            cacheNamespace: NAMESPACE
        });
        await waitFor(
            () => app.displaySnapshotCoordinator.getStatus().restoreState === "ready",
            "actual Library did not become ready"
        );
        const builder = new TrackSummaryBuilder();

        for (const [index, handle] of fixture.files.entries()) {
            const summary = builder.build(handle.name, handle.file, handle.result);
            await app.gpxGeometryLoader.repository.set(
                NAMESPACE,
                handle.name,
                handle.file,
                handle.result,
                summary
            );
            app.displayState.setCachedResult(handle.name, handle.result);
        }
    } else {
        await waitFor(
            () => app.librarySnapshotService.isProvisional(),
            "Display Snapshot did not restore a provisional Library"
        );
        await waitFor(
            () => !app.viewStateCoordinator.isRestoring(),
            "provisional View State restore did not settle"
        );
    }

    const checkbox = path => app.treeView.fileNodes.get(path)
        ?.querySelector(".gpx-display-toggle");
    const setChecked = async (path, checked) => {
        const input = checkbox(path);
        if (!input) throw new Error(`missing production checkbox: ${path}`);
        input.checked = checked;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await waitFor(
            () => app.displayState.getDisplay(path)?.checked === checked,
            `runtime checkbox did not become ${checked}: ${path}`
        );
    };
    const setMap = async value => {
        app.mapView.map.setView([value.lat, value.lng], value.zoom, {
            animate: false
        });
        await waitFor(() => {
            const current = app.mapView.getViewState();
            return current.lat === value.lat && current.lng === value.lng &&
                current.zoom === value.zoom;
        }, "Leaflet map did not reach requested state");
    };
    const snapshot = () => ({
        libraryId: app.viewStateCoordinator.getStatus().activeLibraryId,
        checked: TRACKS.filter(path => checkbox(path)?.checked),
        runtimeChecked: app.displayState.getCheckedPaths(),
        map: app.mapView.getViewState(),
        persisted: JSON.parse(localStorage.getItem("trailbook.viewState") ||
            '{"libraries":{}}')
    });
    const saveAndClose = async () => {
        app.viewStateCoordinator.flush();
        await app.displaySnapshotCoordinator.flush("production-path-test");
        dispatchEvent(new PageTransitionEvent("pagehide"));
        await Promise.resolve();
        return snapshot();
    };

    return { app, checkbox, setChecked, setMap, snapshot, saveAndClose };
}

async function runChild() {
    const actual = new URLSearchParams(location.search).get("actual") === "1";
    window.productionSession = await createSession({ actual });
    document.getElementById("session-result").textContent = "READY";
}

function openSession(actual = false) {
    const iframe = document.createElement("iframe");
    iframe.src = `desktop-state-production-test.html?session=1&actual=${actual ? 1 : 0}&t=${Date.now()}`;
    document.getElementById("session-host").append(iframe);
    return waitFor(
        () => iframe.contentWindow?.productionSession,
        "production App session did not initialize"
    ).then(() => iframe);
}

async function closeSession(iframe) {
    const state = await iframe.contentWindow.productionSession.saveAndClose();
    iframe.remove();
    return state;
}

function sameMap(actual, expected) {
    return Math.abs(actual?.lat - expected.lat) < 0.001 &&
        Math.abs(actual?.lng - expected.lng) < 0.001 &&
        actual?.zoom === expected.zoom;
}

async function runParent() {
    localStorage.removeItem("trailbook.viewState");
    await new Promise(resolve => {
        const request = indexedDB.deleteDatabase("trailbook.displaySnapshot");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    await new Promise(resolve => {
        const request = indexedDB.deleteDatabase("trailbook.geometryCache");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    const positions = [
        { lat: 34.11, lng: 135.11, zoom: 11 },
        { lat: 35.22, lng: 136.22, zoom: 12 },
        { lat: 36.33, lng: 137.33, zoom: 13 }
    ];

    let frame = await openSession(true);
    let session = frame.contentWindow.productionSession;
    await session.setChecked("one.gpx", true);
    await session.setChecked("two.gpx", true);
    await session.setMap(positions[0]);
    const beforeToggle = session.app.mapView.getViewState();
    await session.setChecked("two.gpx", false);
    await new Promise(resolve => setTimeout(resolve, 300));
    let afterToggle = session.app.mapView.getViewState();
    assert(sameMap(afterToggle, beforeToggle),
        `Track checkbox OFF moved the production Leaflet map: ${JSON.stringify({ beforeToggle, afterToggle })}`);
    await session.setChecked("two.gpx", true);
    await new Promise(resolve => setTimeout(resolve, 300));
    afterToggle = session.app.mapView.getViewState();
    assert(sameMap(afterToggle, beforeToggle),
        `Track checkbox ON moved the production Leaflet map: ${JSON.stringify({ beforeToggle, afterToggle })}`);
    const first = await session.saveAndClose();
    const libraryId = first.libraryId;
    frame.remove();

    frame = await openSession(false);
    session = frame.contentWindow.productionSession;
    let state = session.snapshot();
    assert(state.libraryId === libraryId,
        `Library identity changed A->B: ${libraryId} -> ${state.libraryId}`);
    assert(state.checked.join(",") === "one.gpx,two.gpx",
        `A checkbox state did not reach reconstructed DOM: ${state.checked}`);
    assert(sameMap(state.map, positions[0]),
        `A map state not restored: ${JSON.stringify(state.map)}`);
    await session.setChecked("two.gpx", false);
    await session.setMap(positions[1]);
    const savedB = await closeSession(frame);
    assert(savedB.persisted.libraries[libraryId]?.visibleTracks?.join(",") ===
        "one.gpx",
    `B visibleTracks were not persisted: ${JSON.stringify(savedB.persisted)}`);

    frame = await openSession(false);
    session = frame.contentWindow.productionSession;
    state = session.snapshot();
    assert(state.libraryId === libraryId,
        `Library identity changed B->C: ${libraryId} -> ${state.libraryId}`);
    assert(state.checked.join(",") === "one.gpx",
        `B checkbox state did not reach reconstructed DOM: ${JSON.stringify({ dom: state.checked, runtime: state.runtimeChecked, view: state.persisted.libraries[libraryId] })}`);
    assert(sameMap(state.map, positions[1]),
        `B map state not restored: ${JSON.stringify(state.map)}`);
    await session.setChecked("one.gpx", false);
    await session.setMap(positions[2]);
    const savedC = await closeSession(frame);
    assert(savedC.persisted.libraries[libraryId]?.visibleTracks?.length === 0,
        `C visibleTracks were not persisted: ${JSON.stringify(savedC.persisted)}`);

    frame = await openSession(false);
    session = frame.contentWindow.productionSession;
    state = session.snapshot();
    assert(state.libraryId === libraryId,
        `Library identity changed C->D: ${libraryId} -> ${state.libraryId}`);
    assert(state.checked.length === 0,
        `C checkbox state did not reach reconstructed DOM: ${state.checked}`);
    assert(sameMap(state.map, positions[2]),
        `C map state not restored: ${JSON.stringify(state.map)}`);
    frame.remove();
}

try {
    if (SESSION_QUERY) {
        await runChild();
    } else {
        await runParent();
        output.textContent = `PASS: ${assertions} assertions`;
    }
} catch (error) {
    (document.getElementById("session-result") || output).textContent =
        `FAIL after ${assertions} assertions\n${error.stack || error}`;
    throw error;
}
