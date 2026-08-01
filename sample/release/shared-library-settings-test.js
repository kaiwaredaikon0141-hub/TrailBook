import Config from "../../src/js/core/Config.js";
import App from "../../src/js/core/App.js";
import LibrarySettingsRepository from
    "../../src/js/services/LibrarySettingsRepository.js";
import LibrarySettingsState from
    "../../src/js/state/LibrarySettingsState.js";
import FolderColorState from "../../src/js/state/FolderColorState.js";
import {
    normalizeSharedSettings
} from "../../src/js/utils/SharedSettingsSchema.js";

const output = globalThis.document?.getElementById?.("result") || null;
let assertions = 0;

function assert(condition, message) {

    assertions += 1;

    if (!condition) {
        throw new Error(message);
    }
}

function namedError(name) {

    const error = new Error(name);

    error.name = name;

    return error;
}

function validDocument(folderColors = {}) {

    return JSON.stringify({
        schemaVersion: 1,
        settings: { folderColors }
    });
}

function createRoot({
    content = validDocument(),
    getHandleError = null,
    getFileError = null,
    arrayBufferError = null,
    kind = "file",
    handleName = "trailbook.json",
    size = null,
    lastModified = 1234
} = {}) {

    const bytes = new TextEncoder().encode(content);

    return {
        async getFileHandle(name, options) {
            assert(name === "trailbook.json", "wrong shared settings name");
            assert(options?.create === false, "lookup attempted file creation");

            if (getHandleError) {
                throw getHandleError;
            }

            return {
                kind,
                name: handleName,
                async getFile() {
                    if (getFileError) {
                        throw getFileError;
                    }

                    return {
                        size: size ?? bytes.byteLength,
                        lastModified,
                        async arrayBuffer() {
                            if (arrayBufferError) {
                                throw arrayBufferError;
                            }

                            return bytes.buffer.slice(0);
                        }
                    };
                }
            };
        }
    };
}

function createRepository(overrides = {}) {

    return new LibrarySettingsRepository({
        ...Config.sharedLibrarySettings,
        ...overrides
    });
}

function stateResult(status, overrides = {}) {

    return {
        status,
        fileExists: status !== "missing",
        snapshot: null,
        fingerprint: null,
        lastModified: null,
        size: null,
        errorCode: null,
        fallbackAllowed: status === "missing" || status === "read-failed",
        ...overrides
    };
}

async function testSchema() {

    const normalized = normalizeSharedSettings({
        schemaVersion: 1,
        settings: {
            folderColors: {
                "日本語/林道": "#abc",
                "": "#455a64",
                "bike/crf": "#795548"
            }
        }
    }, 1);

    assert(normalized.errorCode === null, "valid schema rejected");
    assert(normalized.snapshot.folderColors[""] === "#455A64", "root color");
    assert(normalized.snapshot.folderColors["日本語/林道"] === "#AABBCC", "Japanese path");
    assert(
        Object.keys(normalized.snapshot.folderColors).join("|") ===
            "|bike/crf|日本語/林道",
        "folder paths were not sorted"
    );

    const invalidCases = [
        [{ schemaVersion: 2, settings: { folderColors: {} } }, "unsupported-schema"],
        [{ schemaVersion: 1, settings: { folderColors: [] } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: null }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: {}, extra: true } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: {} }, extra: true }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "/car": "#fff" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car/": "#fff" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car\\bike": "#fff" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car/../bike": "#fff" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car/./bike": "#fff" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car": "#ffffffff" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car": "red" } } }, "invalid-structure"],
        [{ schemaVersion: 1, settings: { folderColors: { "car": "rgb(1,2,3)" } } }, "invalid-structure"]
    ];

    invalidCases.forEach(([payload, errorCode]) => {
        const result = normalizeSharedSettings(payload, 1);

        assert(result.snapshot === null, "invalid schema was accepted");
        assert(result.errorCode === errorCode, "wrong schema error category");
    });

    const dangerous = normalizeSharedSettings(JSON.parse(
        '{"schemaVersion":1,"settings":{"folderColors":{"__proto__":"#fff"}}}'
    ), 1);

    assert(dangerous.snapshot === null, "dangerous key was accepted");

    const orphan = normalizeSharedSettings({
        schemaVersion: 1,
        settings: { folderColors: { "not/in/tree": "#123456" } }
    }, 1);

    assert(orphan.snapshot !== null, "orphan path should remain valid");
}

async function testRepository() {

    const repository = createRepository();
    const validContent = validDocument({ "": "#abc", "bike/crf": "#795548" });
    const loaded = await repository.load(createRoot({ content: validContent }));

    assert(loaded.status === "loaded", "valid file not loaded");
    assert(loaded.snapshot.folderColors[""] === "#AABBCC", "color not normalized");
    assert(loaded.lastModified === 1234, "lastModified missing");
    assert(loaded.size === new TextEncoder().encode(validContent).byteLength, "size mismatch");
    assert(/^[0-9a-f]{64}$/.test(loaded.fingerprint), "SHA-256 missing");

    const expectedHash = [...new Uint8Array(await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(validContent)
    ))].map(byte => byte.toString(16).padStart(2, "0")).join("");

    assert(loaded.fingerprint === expectedHash, "SHA-256 used different bytes");

    const missing = await repository.load(createRoot({
        getHandleError: namedError("NotFoundError")
    }));
    assert(missing.status === "missing", "missing file treated as error");
    assert(missing.fingerprint === null, "missing fingerprint not null");

    for (const content of ["", "   ", "{"]) {
        const result = await repository.load(createRoot({ content }));

        assert(result.status === "invalid", "malformed content accepted");
        assert(result.errorCode === "malformed-json", "malformed category");
        assert(result.fallbackAllowed === false, "malformed allowed fallback");
    }

    const unsupported = await repository.load(createRoot({
        content: JSON.stringify({
            schemaVersion: 2,
            settings: { folderColors: {} }
        })
    }));
    assert(unsupported.errorCode === "unsupported-schema", "unknown schema category");

    const mixed = await repository.load(createRoot({
        content: validDocument({ car: "#123456", bike: "bad" })
    }));
    assert(mixed.snapshot === null, "partial invalid settings were adopted");

    const tooLarge = await repository.load(createRoot({ size: 1048577 }));
    assert(tooLarge.errorCode === "file-too-large", "size limit not enforced");

    const permission = await repository.load(createRoot({
        getFileError: namedError("NotAllowedError")
    }));
    assert(permission.status === "read-failed", "permission did not preserve Viewer fallback");
    assert(permission.errorCode === "permission-denied", "permission category");
    assert(permission.fallbackAllowed === true, "permission fallback disabled");

    const readFailure = await repository.load(createRoot({
        arrayBufferError: new Error("read")
    }));
    assert(readFailure.errorCode === "read-failed", "read failure category");

    const directory = await repository.load(createRoot({ kind: "directory" }));
    assert(directory.status === "invalid", "directory handle accepted");

    const caseMismatch = await repository.load(createRoot({
        handleName: "TrailBook.json"
    }));
    assert(caseMismatch.status === "missing", "case-mismatched file was adopted");

    const noCrypto = await createRepository({ cryptoProvider: null }).load(
        createRoot({ content: validContent })
    );
    assert(noCrypto.status === "loaded", "crypto failure stopped valid settings");
    assert(noCrypto.fingerprint === null, "unavailable fingerprint was populated");
    assert(noCrypto.errorCode === "fingerprint-unavailable", "crypto category");
}

function testStateAndPrecedence() {

    const state = new LibrarySettingsState({ schemaVersion: 1 });
    const legacy = { car: "#111111", bike: "#222222" };
    let request = state.beginLoad();

    state.applyLoad(request, stateResult("loaded", {
        snapshot: {
            schemaVersion: 1,
            folderColors: { car: "#AAAAAA" }
        },
        fingerprint: "hash",
        lastModified: 10,
        size: 20,
        fallbackAllowed: false
    }), legacy);
    assert(state.getStatus().source === "shared-json", "JSON did not beat legacy");
    assert(state.getSnapshot().folderColors.bike === undefined, "legacy mixed into JSON");
    assert(state.getStatus().dirty === false, "load marked dirty");
    assert(state.getStatus().fingerprint === "hash", "fingerprint not retained");

    request = state.beginLoad();
    state.applyLoad(request, stateResult("loaded", {
        snapshot: { schemaVersion: 1, folderColors: {} },
        fallbackAllowed: false
    }), legacy);
    assert(state.getStatus().source === "shared-json", "empty valid JSON source changed");
    assert(Object.keys(state.getSnapshot().folderColors).length === 0, "empty JSON mixed legacy");

    request = state.beginLoad();
    state.applyLoad(request, stateResult("missing"), legacy);
    assert(state.getStatus().source === "legacy-local", "missing did not use legacy");

    request = state.beginLoad();
    state.applyLoad(request, stateResult("read-failed"), legacy);
    assert(state.getStatus().source === "legacy-local", "temporary failure did not use legacy");

    request = state.beginLoad();
    state.applyLoad(request, stateResult("invalid", {
        errorCode: "malformed-json",
        fallbackAllowed: false
    }), legacy);
    assert(state.getStatus().source === "auto", "invalid JSON used legacy");
    assert(Object.keys(state.getSnapshot().folderColors).length === 0, "invalid kept explicit colors");

    request = state.beginLoad();
    state.applyLoad(request, stateResult("missing"), {});
    assert(state.getStatus().source === "auto", "missing without legacy was not Auto");

    const staleRequest = state.beginLoad();
    const currentRequest = state.beginLoad();
    assert(
        state.applyLoad(staleRequest, stateResult("missing"), legacy) === false,
        "stale request applied"
    );
    assert(state.getStatus().status === "loading", "stale request changed status");
    assert(state.isCurrentRequest(currentRequest), "current request lost");

    state.reset();
    assert(state.getStatus().status === "idle", "reset status");
    assert(state.getStatus().source === "auto", "reset source");
    assert(state.getStatus().fingerprint === null, "reset fingerprint");
}

function testFolderColorProjection() {

    const store = {
        getFolderColors() {
            return { "": "#FF0000" };
        }
    };
    const state = new FolderColorState({
        store,
        pathColorResolver: () => "#000000",
        fallbackColor: "#FFFFFF"
    });

    state.setActiveLibrary("root-name:test", ["", "car"], {
        "": "#00FF00"
    });
    assert(state.getExplicitColor("") === "#00FF00", "shared projection used legacy");
    assert(state.resolveTrackColor("car/test.gpx") === "#00FF00", "shared inheritance failed");

    state.setActiveLibrary("root-name:test", ["", "car"], {});
    assert(state.getExplicitColor("") === null, "Auto retained old explicit color");
}

async function testAppIntegration() {

    const app = new App();
    const rootHandle = {};
    const library = {
        name: "Test",
        rootFolder: { handle: rootHandle },
        folderCount: 1,
        gpxFileCount: 1
    };

    app.librarySettingsCoordinator.repository = {
        async load(handle) {
            assert(handle === rootHandle, "App did not use Library root handle");

            return stateResult("loaded", {
                snapshot: {
                    schemaVersion: 1,
                    folderColors: { "": "#ABCDEF" }
                },
                fingerprint: "fingerprint",
                fallbackAllowed: false
            });
        }
    };
    app.displaySettingsStore = {
        setActiveLibrary() { return "root-name:Test"; },
        getFolderColors() { return { "": "#111111" }; },
        getStatus() { return { persistence: "available" }; }
    };
    app.librarySettingsCoordinator.displaySettingsStore =
        app.displaySettingsStore;
    app.folderColorState.store = app.displaySettingsStore;
    app.treeView = {
        async render() {},
        getSearchSourceEntries() {
            return [
                { kind: "folder", path: "" },
                { kind: "gpx", path: "track.gpx" }
            ];
        },
        getFileEntries() {
            return [{ path: "track.gpx", fileHandle: {} }];
        }
    };
    app.searchService = { clear() {}, setEntries() {} };
    app.searchView = { setAvailable() {} };
    app.mapView = { clear() {}, resetView() {} };
    app.statusBar = { showLibraryLoaded() {} };
    app.libraryAccessPanel = { hide() {}, showEmpty() {} };
    app.folderColorControl = {
        setPersistenceStatus() {},
        setPresentations() {},
        setFileColor() {}
    };

    const completed = await app.handleLibraryLoaded(library);

    assert(completed === true, "App shared load did not complete");
    assert(app.librarySettingsCoordinator.state.getStatus().source === "shared-json", "App source");
    assert(app.folderColorState.getExplicitColor("") === "#ABCDEF", "App mixed legacy");
    assert(app.displayState.getDisplay("track.gpx").color === "#ABCDEF", "display color");

    app.librarySettingsCoordinator.repository.load = async () => stateResult("missing");
    await app.handleLibraryLoaded(library);
    assert(app.librarySettingsCoordinator.state.getStatus().source === "legacy-local", "App missing fallback");
    assert(app.folderColorState.getExplicitColor("") === "#111111", "App legacy color");

    app.displaySettingsStore.getFolderColors = () => ({});
    await app.handleLibraryLoaded(library);
    assert(app.librarySettingsCoordinator.state.getStatus().source === "auto", "App Auto source");
    assert(app.folderColorState.getExplicitColor("") === null, "App Auto kept explicit color");

    app.displaySettingsStore.getFolderColors = () => ({ "": "#111111" });
    app.librarySettingsCoordinator.repository.load = async () => stateResult("invalid", {
        errorCode: "malformed-json",
        fallbackAllowed: false
    });
    await app.handleLibraryLoaded(library);
    assert(app.librarySettingsCoordinator.state.getStatus().source === "auto", "App invalid used legacy");
    assert(app.folderColorState.getExplicitColor("") === null, "App invalid kept legacy color");

    const staleApp = new App();
    const pendingLoads = new Map();

    staleApp.librarySettingsCoordinator.repository = {
        load(handle) {
            return new Promise(resolve => pendingLoads.set(handle, resolve));
        }
    };
    staleApp.displaySettingsStore = app.displaySettingsStore;
    staleApp.librarySettingsCoordinator.displaySettingsStore =
        staleApp.displaySettingsStore;
    staleApp.folderColorState.store = staleApp.displaySettingsStore;
    staleApp.treeView = app.treeView;
    staleApp.searchService = app.searchService;
    staleApp.searchView = app.searchView;
    staleApp.mapView = app.mapView;
    staleApp.statusBar = app.statusBar;
    staleApp.libraryAccessPanel = app.libraryAccessPanel;
    staleApp.folderColorControl = app.folderColorControl;

    const firstHandle = {};
    const secondHandle = {};
    const firstLoad = staleApp.handleLibraryLoaded({
        ...library,
        rootFolder: { handle: firstHandle }
    });
    const secondLoad = staleApp.handleLibraryLoaded({
        ...library,
        rootFolder: { handle: secondHandle }
    });

    pendingLoads.get(firstHandle)(stateResult("loaded", {
        snapshot: { schemaVersion: 1, folderColors: { "": "#FF0000" } },
        fallbackAllowed: false
    }));
    assert(await firstLoad === false, "stale App load completed");

    pendingLoads.get(secondHandle)(stateResult("loaded", {
        snapshot: { schemaVersion: 1, folderColors: { "": "#00FF00" } },
        fallbackAllowed: false
    }));
    assert(await secondLoad === true, "current App load was rejected");
    assert(staleApp.folderColorState.getExplicitColor("") === "#00FF00", "stale color won");
}

export async function runSharedLibrarySettingsTests() {

    await testSchema();
    await testRepository();
    testStateAndPrecedence();
    testFolderColorProjection();
    await testAppIntegration();

    return { assertions };
}

if (output) {
    runSharedLibrarySettingsTests()
        .then(result => {
            output.textContent = `PASS: ${result.assertions} assertions`;
            document.documentElement.dataset.testStatus = "pass";
        })
        .catch(error => {
            output.textContent = `FAIL: ${error.message}`;
            document.documentElement.dataset.testStatus = "fail";
        });
}
