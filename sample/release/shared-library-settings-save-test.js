import Config from "../../src/js/core/Config.js";
import LibrarySettingsCoordinator from
    "../../src/js/core/LibrarySettingsCoordinator.js";
import LibrarySettingsRepository from
    "../../src/js/services/LibrarySettingsRepository.js";
import LibrarySettingsState from
    "../../src/js/state/LibrarySettingsState.js";
import {
    serializeSharedSettings
} from "../../src/js/utils/SharedSettingsSchema.js";

const output = globalThis.document?.getElementById?.("result") || null;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
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

function documentText(folderColors = {}) {

    return serializeSharedSettings({ folderColors }, 1).serializedText;
}

function createMemoryRoot({
    content = null,
    permission = "granted",
    requestResult = "granted",
    queryError = null,
    requestError = null,
    createFileError = null,
    createWritableError = null,
    writeError = null,
    closeError = null,
    tamperAfterClose = null
} = {}) {

    const state = {
        content,
        lastModified: 100,
        queryCalls: 0,
        requestCalls: 0,
        createFalseCalls: 0,
        createTrueCalls: 0,
        createWritableCalls: 0,
        writeCalls: 0,
        closeCalls: 0,
        abortCalls: 0
    };

    const fileHandle = {
        kind: "file",
        name: "trailbook.json",
        async getFile() {
            const bytes = encoder.encode(state.content ?? "");

            return {
                size: bytes.byteLength,
                lastModified: state.lastModified,
                async arrayBuffer() {
                    return bytes.buffer.slice(0);
                }
            };
        },
        async createWritable() {
            state.createWritableCalls += 1;

            if (createWritableError) {
                throw createWritableError;
            }

            let pending = null;

            return {
                async write(bytes) {
                    state.writeCalls += 1;

                    if (writeError) {
                        throw writeError;
                    }

                    pending = new Uint8Array(bytes).slice();
                },
                async close() {
                    state.closeCalls += 1;

                    if (closeError) {
                        throw closeError;
                    }

                    state.content = decoder.decode(pending);
                    state.lastModified += 1;

                    if (tamperAfterClose !== null) {
                        state.content = tamperAfterClose;
                        state.lastModified += 1;
                    }
                },
                async abort() {
                    state.abortCalls += 1;
                    pending = null;
                }
            };
        }
    };

    const root = {
        state,
        async queryPermission(options) {
            state.queryCalls += 1;
            assert(options?.mode === "readwrite", "query mode was not readwrite");

            if (queryError) {
                throw queryError;
            }

            return permission;
        },
        async requestPermission(options) {
            state.requestCalls += 1;
            assert(options?.mode === "readwrite", "request mode was not readwrite");

            if (requestError) {
                throw requestError;
            }

            permission = requestResult;

            return requestResult;
        },
        async getFileHandle(name, options) {
            assert(name === "trailbook.json", "wrong file name");

            if (options?.create === true) {
                state.createTrueCalls += 1;

                if (createFileError) {
                    throw createFileError;
                }

                if (state.content === null) {
                    state.content = "";
                }

                return fileHandle;
            }

            state.createFalseCalls += 1;

            if (state.content === null) {
                throw namedError("NotFoundError");
            }

            return fileHandle;
        }
    };

    return root;
}

function createRepository(overrides = {}) {

    return new LibrarySettingsRepository({
        ...Config.sharedLibrarySettings,
        ...overrides
    });
}

async function baseline(repository, root) {

    return repository.load(root);
}

async function testSerialization() {

    const serialized = serializeSharedSettings({
        folderColors: {
            car: "#abc",
            "": "#455a64",
            "bike/crf": "#795548"
        }
    }, 1);
    const expected = [
        "{",
        '  "schemaVersion": 1,',
        '  "settings": {',
        '    "folderColors": {',
        '      "": "#455A64",',
        '      "bike/crf": "#795548",',
        '      "car": "#AABBCC"',
        "    }",
        "  }",
        "}",
        ""
    ].join("\n");

    assert(serialized.serializedText === expected, "serialization format mismatch");
    assert(!serialized.serializedText.includes("\r"), "serialization used CRLF");
    assert(serialized.serializedText.endsWith("\n"), "final newline missing");
    assert(serialized.snapshot.folderColors.car === "#AABBCC", "color not normalized");
}

async function testPermissionAndWrite() {

    const repository = createRepository();
    const missingRoot = createMemoryRoot();
    const missingBaseline = await baseline(repository, missingRoot);
    const snapshot = { folderColors: { "": "#455A64" } };
    const saved = await repository.save(missingRoot, {
        baseline: missingBaseline,
        snapshot
    });

    assert(saved.status === "saved", "missing file was not created");
    assert(missingRoot.state.createTrueCalls === 1, "create:true not used once");
    assert(missingRoot.state.writeCalls === 1, "write not called once");
    assert(missingRoot.state.closeCalls === 1, "close not called once");
    assert(missingRoot.state.content === documentText(snapshot.folderColors), "wrong bytes written");
    assert(saved.loadResult.fingerprint !== null, "saved fingerprint missing");

    const promptRoot = createMemoryRoot({
        content: documentText({ "": "#111111" }),
        permission: "prompt",
        requestResult: "granted"
    });
    const promptBaseline = await baseline(repository, promptRoot);
    const promptSaved = await repository.save(promptRoot, {
        baseline: promptBaseline,
        snapshot: { folderColors: { "": "#222222" } }
    });
    assert(promptSaved.status === "saved", "prompt permission did not save");
    assert(promptRoot.state.queryCalls === 1, "permission was not queried once");
    assert(promptRoot.state.requestCalls === 1, "permission was not requested once");

    const deniedRoot = createMemoryRoot({
        permission: "prompt",
        requestResult: "denied"
    });
    const denied = await repository.save(deniedRoot, {
        baseline: await baseline(repository, deniedRoot),
        snapshot
    });
    assert(denied.errorCode === "write-permission-denied", "denied category");
    assert(deniedRoot.state.createTrueCalls === 0, "denied created file");

    const queryFailureRoot = createMemoryRoot({ queryError: new Error("query") });
    const queryFailure = await repository.save(queryFailureRoot, {
        baseline: await baseline(repository, queryFailureRoot),
        snapshot
    });
    assert(queryFailure.errorCode === "write-permission-failed", "query failure category");

    const requestFailureRoot = createMemoryRoot({
        permission: "prompt",
        requestError: new Error("request")
    });
    const requestFailure = await repository.save(requestFailureRoot, {
        baseline: await baseline(repository, requestFailureRoot),
        snapshot
    });
    assert(requestFailure.errorCode === "write-permission-failed", "request failure category");
}

async function testFailures() {

    const repository = createRepository();
    const snapshot = { folderColors: { car: "#123456" } };
    const cases = [
        ["create-file-failed", { createFileError: new Error("create") }],
        ["create-writable-failed", { createWritableError: new Error("writable") }],
        ["write-failed", { writeError: new Error("write") }],
        ["close-failed", { closeError: new Error("close") }],
        ["verification-failed", {
            tamperAfterClose: documentText({ car: "#654321" })
        }]
    ];

    for (const [errorCode, options] of cases) {
        const root = createMemoryRoot(options);
        const result = await repository.save(root, {
            baseline: await baseline(repository, root),
            snapshot
        });

        assert(result.errorCode === errorCode, `wrong ${errorCode} result`);
        assert(result.status !== "saved", `${errorCode} reported success`);
    }
}

async function testConflicts() {

    const repository = createRepository();
    const firstText = documentText({ "": "#111111" });
    const secondText = documentText({ "": "#222222" });
    const snapshot = { folderColors: { "": "#333333" } };

    const appeared = createMemoryRoot();
    const appearedBaseline = await baseline(repository, appeared);
    appeared.state.content = firstText;
    const appearedResult = await repository.save(appeared, {
        baseline: appearedBaseline,
        snapshot
    });
    assert(appearedResult.errorCode === "conflict", "missing-to-existing conflict missed");
    assert(appeared.state.writeCalls === 0, "conflict wrote file");

    const removed = createMemoryRoot({ content: firstText });
    const removedBaseline = await baseline(repository, removed);
    removed.state.content = null;
    const removedResult = await repository.save(removed, {
        baseline: removedBaseline,
        snapshot
    });
    assert(removedResult.errorCode === "conflict", "existing-to-missing conflict missed");

    const changed = createMemoryRoot({ content: firstText });
    const changedBaseline = await baseline(repository, changed);
    changed.state.content = secondText;
    changed.state.lastModified += 1;
    const changedResult = await repository.save(changed, {
        baseline: changedBaseline,
        snapshot
    });
    assert(changedResult.errorCode === "conflict", "fingerprint conflict missed");
    assert(changed.state.content === secondText, "external file overwritten");

    const sizeChanged = createMemoryRoot({ content: firstText });
    const sizeChangedBaseline = await baseline(repository, sizeChanged);
    sizeChanged.state.content = documentText({
        "": "#222222",
        "nested/folder": "#333333"
    });
    const sizeChangedResult = await repository.save(sizeChanged, {
        baseline: sizeChangedBaseline,
        snapshot
    });
    assert(sizeChangedResult.errorCode === "conflict", "size change conflict missed");
    assert(sizeChanged.state.writeCalls === 0, "size change conflict wrote file");

    const timestampOnly = createMemoryRoot({ content: firstText });
    const timestampBaseline = await baseline(repository, timestampOnly);
    timestampOnly.state.lastModified += 1;
    const timestampResult = await repository.save(timestampOnly, {
        baseline: timestampBaseline,
        snapshot
    });
    assert(timestampResult.status === "saved", "same fingerprint was rejected");

    const invalid = createMemoryRoot({ content: firstText });
    const invalidBaseline = await baseline(repository, invalid);
    invalid.state.content = "{";
    const invalidResult = await repository.save(invalid, {
        baseline: invalidBaseline,
        snapshot
    });
    assert(invalidResult.errorCode === "invalid-current-file", "invalid current file allowed");

    const unknown = createMemoryRoot({ content: firstText });
    const unknownBaseline = await baseline(repository, unknown);
    unknown.state.content = '{"schemaVersion":2,"settings":{"folderColors":{}}}';
    const unknownResult = await repository.save(unknown, {
        baseline: unknownBaseline,
        snapshot
    });
    assert(unknownResult.errorCode === "invalid-current-file", "unknown current schema allowed");

    const noCryptoRepository = createRepository({ cryptoProvider: null });
    const noCrypto = createMemoryRoot({ content: firstText });
    const noCryptoResult = await noCryptoRepository.save(noCrypto, {
        baseline: await baseline(noCryptoRepository, noCrypto),
        snapshot
    });
    assert(noCryptoResult.errorCode === "conflict-check-unavailable", "missing fingerprint allowed save");

    const stale = createMemoryRoot();
    const staleResult = await repository.save(stale, {
        baseline: await baseline(repository, stale),
        snapshot,
        shouldContinue: () => false
    });
    assert(staleResult.errorCode === "stale-library", "stale save continued");
    assert(stale.state.queryCalls === 0, "stale save requested permission");
}

function loadResult(folderColors = {}) {

    return {
        status: "loaded",
        fileExists: true,
        snapshot: { schemaVersion: 1, folderColors },
        fingerprint: "fingerprint",
        lastModified: 100,
        size: 50,
        errorCode: null,
        fallbackAllowed: false
    };
}

function testState() {

    const state = new LibrarySettingsState({ schemaVersion: 1 });
    let request = state.beginLoad();
    state.applyLoad(request, loadResult({
        orphan: "#999999",
        car: "#111111"
    }));
    state.markDirty({ car: "#222222" }, ["", "car"]);
    assert(state.getStatus().dirty, "markDirty did not set dirty");
    assert(state.getStatus().saveStatus === "unsaved", "unsaved status missing");
    assert(state.getSnapshot().folderColors.orphan === "#999999", "orphan lost");
    assert(state.getSnapshot().folderColors.car === "#222222", "explicit change missing");

    let saveRequest = state.beginSave();
    assert(state.getStatus().saving, "beginSave did not set saving");
    state.applySaveFailure(saveRequest, "write-failed");
    assert(state.getStatus().dirty, "failure cleared dirty");
    assert(state.getStatus().saveStatus === "failed", "failure status missing");

    saveRequest = state.beginSave();
    state.markConflict(saveRequest);
    assert(state.getStatus().saveStatus === "conflict", "conflict status missing");
    assert(state.getStatus().dirty, "conflict cleared dirty");

    saveRequest = state.beginSave();
    state.applySaveSuccess(saveRequest, loadResult({ car: "#222222" }));
    assert(!state.getStatus().dirty, "success kept dirty");
    assert(state.getStatus().source === "shared-json", "success source");
    assert(state.getStatus().saveStatus === "saved", "saved status missing");

    state.markDirty({}, ["", "car"]);
    const staleSave = state.beginSave();
    request = state.beginLoad();
    assert(!state.applySaveFailure(staleSave, "write-failed"), "stale save applied");
    assert(state.isCurrentRequest(request), "load request lost after stale save");
    state.reset();
    assert(!state.getStatus().dirty && !state.getStatus().saving, "reset kept save state");
}

async function testCoordinator() {

    const panelStates = [];
    const panel = {
        setAvailable() {},
        render(state) { panelStates.push(state); }
    };
    const folderColorState = {
        setActiveLibrary() {},
        getExplicitColors() { return { car: "#222222" }; },
        getFolderPaths() { return ["", "car"]; }
    };
    const repository = {
        async load() { return loadResult({ car: "#111111" }); },
        async save() {
            saveCalls += 1;
            return { status: "saved", errorCode: null, loadResult: loadResult({ car: "#222222" }) };
        }
    };
    const saveInteractions = [];
    let saveCalls = 0;
    let confirmResult = false;
    const coordinator = new LibrarySettingsCoordinator({
        config: Config.sharedLibrarySettings,
        displaySettingsStore: { getFolderColors() { return {}; } },
        folderColorState,
        repository,
        confirmDiscard: () => confirmResult,
        setSaveInteraction: busy => saveInteractions.push(busy)
    });
    coordinator.setPanel(panel);
    const context = await coordinator.load({}, {
        generation: 1,
        isCurrent: () => true
    });
    coordinator.applyLoad(context, {
        libraryId: "root-name:test",
        folderPaths: ["", "car"]
    });
    const ignored = await coordinator.save();
    assert(ignored.status === "ignored", "clean Coordinator save was not ignored");
    assert(saveCalls === 0, "clean Coordinator called Repository save");
    coordinator.markDirty();
    assert(coordinator.state.getStatus().dirty, "Coordinator did not mark dirty");
    assert(!coordinator.canSwitchLibrary(), "dirty switch ignored confirmation");
    confirmResult = true;
    assert(coordinator.canSwitchLibrary(), "confirmed switch blocked");

    const saved = await coordinator.save();
    assert(saved.status === "saved", "Coordinator save failed");
    assert(saveCalls === 1, "explicit dirty save did not call Repository once");
    assert(
        saveInteractions.join(",") === "true,false",
        "save interaction guard did not wrap Repository save"
    );
    assert(!coordinator.state.getStatus().dirty, "Coordinator success kept dirty");
    assert(panelStates.some(state => state.saving), "saving UI state missing");
    assert(panelStates.at(-1).saveStatus === "saved", "saved UI state missing");

    coordinator.markDirty();
    repository.save = async () => ({
        status: "permission-denied",
        errorCode: "write-permission-denied",
        loadResult: null
    });
    await coordinator.save();
    assert(coordinator.state.getStatus().dirty, "denial cleared dirty");
    assert(coordinator.state.getStatus().saveStatus === "permission-denied", "denial UI state");

    repository.save = async () => ({
        status: "conflict",
        errorCode: "conflict",
        loadResult: null
    });
    await coordinator.save();
    assert(coordinator.state.getStatus().saveStatus === "conflict", "Coordinator conflict state");
}

export async function runSharedLibrarySettingsSaveTests() {

    await testSerialization();
    await testPermissionAndWrite();
    await testFailures();
    await testConflicts();
    testState();
    await testCoordinator();

    return { assertions };
}

if (output) {
    runSharedLibrarySettingsSaveTests()
        .then(result => {
            output.textContent = `PASS: ${result.assertions} assertions`;
            document.documentElement.dataset.testStatus = "pass";
        })
        .catch(error => {
            output.textContent = `FAIL: ${error.message}`;
            document.documentElement.dataset.testStatus = "fail";
        });
}
