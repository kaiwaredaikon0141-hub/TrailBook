import Config from "../../src/js/core/Config.js";
import LibrarySettingsCoordinator from
    "../../src/js/core/LibrarySettingsCoordinator.js";
import LibrarySettingsRepository from
    "../../src/js/services/LibrarySettingsRepository.js";
import LibrarySettingsState from
    "../../src/js/state/LibrarySettingsState.js";
import LibrarySettingsPanel from
    "../../src/js/ui/LibrarySettingsPanel.js";
import { serializeSharedSettings } from
    "../../src/js/utils/SharedSettingsSchema.js";

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

function serialized(folderColors = {}) {

    return serializeSharedSettings({ folderColors }, 1).serializedText;
}

function loadResult(status, folderColors = {}, overrides = {}) {

    const loaded = status === "loaded";

    return {
        status,
        fileExists: status === "missing" ? false : true,
        snapshot: loaded ? { schemaVersion: 1, folderColors } : null,
        fingerprint: loaded ? `fingerprint-${JSON.stringify(folderColors)}` : null,
        lastModified: loaded ? 100 : null,
        size: loaded ? 50 : null,
        errorCode: status === "invalid" ? "malformed-json" : null,
        fallbackAllowed: status === "missing" || status === "read-failed",
        ...overrides
    };
}

function createFolderColorState() {

    return {
        libraryId: null,
        folderPaths: ["", "car", "bike"],
        colors: Object.create(null),
        setActiveLibrary(libraryId, folderPaths, colors = {}) {
            this.libraryId = libraryId;
            this.folderPaths = [...folderPaths];
            this.colors = Object.assign(Object.create(null), colors);
        },
        getExplicitColors() {
            return Object.assign(Object.create(null), this.colors);
        },
        getFolderPaths() { return [...this.folderPaths]; },
        hasFolderPath(path) { return this.folderPaths.includes(path); }
    };
}

function createCoordinatorHarness({
    firstResult,
    legacyColors = {},
    confirmResult = true
}) {

    const repository = {
        loadCalls: 0,
        saveCalls: [],
        nextLoad: firstResult,
        nextSave: null,
        async load() {
            this.loadCalls += 1;
            return typeof this.nextLoad === "function"
                ? this.nextLoad()
                : this.nextLoad;
        },
        async save(rootHandle, options) {
            this.saveCalls.push({ rootHandle, options });
            return this.nextSave || {
                status: "saved",
                errorCode: null,
                loadResult: loadResult(
                    "loaded",
                    options.snapshot.folderColors
                )
            };
        }
    };
    const panel = {
        states: [],
        conflictOpens: [],
        conflictOpen: false,
        setAvailable() {},
        render(state) { this.states.push(state); },
        openConflict(options) {
            this.conflictOpens.push(options);
            this.conflictOpen = true;
        },
        isConflictOpen() { return this.conflictOpen; }
    };
    const folderColorState = createFolderColorState();
    const appliedPaths = [];
    const interaction = [];
    const store = {
        colors: Object.assign(Object.create(null), legacyColors),
        getFolderColors() {
            return Object.assign(Object.create(null), this.colors);
        }
    };
    const coordinator = new LibrarySettingsCoordinator({
        config: Config.sharedLibrarySettings,
        displaySettingsStore: store,
        folderColorState,
        confirmDiscard: () => confirmResult,
        setSaveInteraction: busy => interaction.push(busy),
        applyFolderColorChange: path => appliedPaths.push(path),
        repository
    });
    const current = { value: true };

    coordinator.setPanel(panel);

    return {
        coordinator,
        repository,
        panel,
        folderColorState,
        appliedPaths,
        interaction,
        store,
        current
    };
}

async function openHarness(harness) {

    const context = await harness.coordinator.load({}, {
        generation: 1,
        isCurrent: () => harness.current.value
    });

    return harness.coordinator.applyLoad(context, {
        libraryId: "root-name:test",
        folderPaths: ["", "car", "bike"]
    });
}

async function testMigration() {

    const migration = createCoordinatorHarness({
        firstResult: loadResult("missing"),
        legacyColors: {
            "": "#111111",
            car: "#222222",
            orphan: "#999999"
        }
    });
    await openHarness(migration);
    assert(migration.coordinator.state.getStatus().migrationAvailable, "migration not offered");
    assert(!migration.coordinator.state.getStatus().dirty, "migration offer dirtied state");
    assert(migration.repository.saveCalls.length === 0, "migration created file automatically");
    await migration.coordinator.migrate();
    assert(migration.repository.saveCalls.length === 1, "migration did not save explicitly");
    assert(migration.repository.saveCalls[0].options.conflictPolicy === "require-match", "migration bypassed conflict check");
    assert(migration.repository.saveCalls[0].options.snapshot.folderColors.orphan === "#999999", "migration lost orphan");
    assert(migration.coordinator.state.getStatus().source === "shared-json", "migration source not shared");
    assert(!migration.coordinator.state.getStatus().dirty, "migration success kept dirty");
    assert(migration.store.colors.car === "#222222", "migration deleted legacy color");

    const noLegacy = createCoordinatorHarness({
        firstResult: loadResult("missing")
    });
    await openHarness(noLegacy);
    assert(!noLegacy.coordinator.state.getStatus().migrationAvailable, "empty legacy offered migration");
    assert((await noLegacy.coordinator.migrate()).status === "ignored", "empty migration ran");

    const existing = createCoordinatorHarness({
        firstResult: loadResult("loaded", { "": "#333333" }),
        legacyColors: { "": "#111111" }
    });
    await openHarness(existing);
    assert(!existing.coordinator.state.getStatus().migrationAvailable, "valid JSON offered migration");

    const invalid = createCoordinatorHarness({
        firstResult: loadResult("invalid"),
        legacyColors: { "": "#111111" }
    });
    await openHarness(invalid);
    assert(!invalid.coordinator.state.getStatus().migrationAvailable, "invalid JSON offered migration");

    const appeared = createCoordinatorHarness({
        firstResult: loadResult("missing"),
        legacyColors: { "": "#111111" }
    });
    await openHarness(appeared);
    appeared.repository.nextSave = {
        status: "conflict",
        errorCode: "conflict",
        loadResult: null
    };
    await appeared.coordinator.migrate();
    assert(appeared.coordinator.state.getStatus().saveStatus === "conflict", "migration conflict not retained");
    assert(appeared.panel.conflictOpens.length === 1, "migration conflict dialog not opened");
    assert(appeared.repository.saveCalls[0].options.snapshot.folderColors[""] === "#111111", "legacy migration snapshot wrong");

    const denied = createCoordinatorHarness({
        firstResult: loadResult("missing"),
        legacyColors: { "": "#111111" }
    });
    await openHarness(denied);
    denied.repository.nextSave = {
        status: "permission-denied",
        errorCode: "write-permission-denied",
        loadResult: null
    };
    await denied.coordinator.migrate();
    assert(denied.coordinator.state.getStatus().saveStatus === "permission-denied", "migration denial status wrong");
    assert(denied.coordinator.state.getStatus().migrationAvailable, "migration denial blocked retry");
    assert(denied.store.colors[""] === "#111111", "migration denial removed legacy");
}

async function testReload() {

    const harness = createCoordinatorHarness({
        firstResult: loadResult("loaded", {
            "": "#111111",
            orphan: "#999999"
        })
    });
    await openHarness(harness);
    harness.repository.nextLoad = loadResult("loaded", { car: "#222222", orphan: "#999999" });
    const reloaded = await harness.coordinator.reload();
    assert(reloaded.status === "reloaded", "valid reload failed");
    assert(harness.folderColorState.colors.car === "#222222", "reload did not project color");
    assert(harness.coordinator.state.getSnapshot().folderColors.orphan === "#999999", "reload lost orphan");
    assert(harness.appliedPaths.includes("") && harness.appliedPaths.includes("car"), "reload did not restyle affected paths");
    assert(!harness.coordinator.state.getStatus().dirty, "reload left dirty");
    assert(harness.interaction.at(-1) === false, "reload did not restore Library picker");

    harness.folderColorState.colors.car = "#333333";
    harness.coordinator.markDirty();
    harness.coordinator.confirmDiscard = () => false;
    const beforeCancelCalls = harness.repository.loadCalls;
    assert((await harness.coordinator.reload()).status === "cancelled", "dirty reload Cancel ignored");
    assert(harness.repository.loadCalls === beforeCancelCalls, "Cancel performed reload");
    assert(harness.coordinator.state.getStatus().dirty, "Cancel cleared dirty");

    harness.coordinator.confirmDiscard = () => true;
    harness.repository.nextLoad = loadResult("loaded", { bike: "#444444" });
    await harness.coordinator.reload();
    assert(!harness.coordinator.state.getStatus().dirty, "discard reload kept dirty");
    assert(harness.folderColorState.colors.bike === "#444444", "discard reload did not apply external file");

    harness.store.colors = { "": "#555555" };
    harness.repository.nextLoad = loadResult("missing");
    await harness.coordinator.reload();
    assert(harness.coordinator.state.getStatus().source === "legacy-local", "missing reload did not use legacy");
    assert(harness.coordinator.state.getStatus().migrationAvailable, "missing reload did not restore migration action");

    harness.store.colors = {};
    await harness.coordinator.reload();
    assert(harness.coordinator.state.getStatus().source === "auto", "missing reload did not use Auto");

    harness.repository.nextLoad = loadResult("invalid");
    await harness.coordinator.reload();
    assert(harness.coordinator.state.getStatus().status === "invalid", "invalid reload status missing");
    assert(harness.coordinator.state.getStatus().source === "auto", "invalid reload mixed legacy");

    harness.store.colors = { car: "#666666" };
    harness.repository.nextLoad = loadResult("read-failed", {}, { fileExists: null });
    await harness.coordinator.reload();
    assert(harness.coordinator.state.getStatus().source === "legacy-local", "read failure did not fallback");
}

async function testConflictAndOverwrite() {

    const harness = createCoordinatorHarness({
        firstResult: loadResult("loaded", { "": "#111111" })
    });
    await openHarness(harness);
    harness.folderColorState.colors[""] = "#222222";
    harness.coordinator.markDirty();
    harness.repository.nextSave = {
        status: "conflict",
        errorCode: "conflict",
        loadResult: null
    };
    await harness.coordinator.save();
    assert(harness.coordinator.state.getStatus().saveStatus === "conflict", "save conflict missing");
    assert(harness.panel.conflictOpens.length === 1, "conflict dialog missing");
    harness.folderColorState.colors.car = "#333333";
    harness.coordinator.markDirty();
    assert(harness.coordinator.state.getStatus().saveStatus === "conflict", "edit cleared conflict");
    const saveCalls = harness.repository.saveCalls.length;
    assert((await harness.coordinator.save()).status === "recovery-required", "conflict normal save retried");
    assert(harness.repository.saveCalls.length === saveCalls, "conflict normal save wrote again");

    harness.repository.nextLoad = loadResult("loaded", { bike: "#777777" });
    await harness.coordinator.reload({ discardDirty: true });
    assert(!harness.coordinator.state.getStatus().dirty, "conflict Reload kept dirty");
    assert(harness.coordinator.state.getStatus().saveStatus === "idle", "conflict Reload did not clear conflict");
    assert(harness.folderColorState.colors.bike === "#777777", "conflict Reload did not adopt external file");

    harness.folderColorState.colors.car = "#333333";
    harness.coordinator.markDirty();
    harness.repository.nextSave = {
        status: "conflict",
        errorCode: "conflict",
        loadResult: null
    };
    await harness.coordinator.save();

    harness.repository.nextSave = null;
    await harness.coordinator.overwrite();
    const overwriteCall = harness.repository.saveCalls.at(-1);
    assert(overwriteCall.options.conflictPolicy === "explicit-overwrite", "overwrite policy missing");
    assert(!harness.coordinator.state.getStatus().dirty, "overwrite success kept dirty");
    assert(harness.coordinator.state.getStatus().source === "shared-json", "overwrite source wrong");

    const invalid = createCoordinatorHarness({
        firstResult: loadResult("invalid")
    });
    await openHarness(invalid);
    invalid.folderColorState.colors.car = "#444444";
    invalid.coordinator.markDirty();
    assert((await invalid.coordinator.save()).status === "recovery-required", "invalid save did not require recovery");
    assert(invalid.repository.saveCalls.length === 0, "invalid normal save wrote file");
    assert(invalid.panel.conflictOpens.at(-1).invalid, "invalid recovery dialog not identified");
    await invalid.coordinator.overwrite();
    assert(invalid.repository.saveCalls[0].options.conflictPolicy === "explicit-overwrite", "invalid overwrite not explicit");

    invalid.coordinator.markDirty();
    invalid.coordinator.state.markConflict(
        invalid.coordinator.state.beginSave(),
        "conflict"
    );
    invalid.repository.nextSave = {
        status: "permission-denied",
        errorCode: "write-permission-denied",
        loadResult: null
    };
    await invalid.coordinator.overwrite();
    assert(invalid.coordinator.state.getStatus().dirty, "overwrite denial cleared dirty");
    assert(invalid.coordinator.state.getStatus().saveStatus === "conflict", "overwrite denial cleared conflict");
    assert(invalid.coordinator.state.getStatus().saveErrorCode === "write-permission-denied", "overwrite denial error missing");
}

function createMemoryRoot({
    content = null,
    permission = "granted",
    tamper = null,
    closeError = null,
    readError = null
} = {}) {

    const state = { content, writes: 0, closes: 0 };
    const fileHandle = {
        kind: "file",
        name: "trailbook.json",
        async getFile() {
            const bytes = encoder.encode(state.content ?? "");
            return {
                size: bytes.byteLength,
                lastModified: 100,
                async arrayBuffer() { return bytes.buffer.slice(0); }
            };
        },
        async createWritable() {
            let pending;
            return {
                async write(bytes) {
                    state.writes += 1;
                    pending = new Uint8Array(bytes).slice();
                },
                async close() {
                    state.closes += 1;
                    if (closeError) throw closeError;
                    state.content = tamper ?? decoder.decode(pending);
                },
                async abort() {}
            };
        }
    };
    const root = {
        state,
        async queryPermission() { return permission; },
        async requestPermission() { return permission; },
        async getFileHandle(name, options) {
            assert(name === "trailbook.json", "Repository used wrong file");
            if (options.create) {
                if (state.content === null) {
                    state.content = "";
                }
                return fileHandle;
            }
            if (state.content === null) {
                throw namedError("NotFoundError");
            }
            if (readError) throw readError;
            return fileHandle;
        }
    };

    return root;
}

async function testRepositoryOverwrite() {

    const repository = new LibrarySettingsRepository(
        Config.sharedLibrarySettings
    );
    const invalidRoot = createMemoryRoot({ content: "{" });
    const invalidBaseline = await repository.load(invalidRoot);
    const normal = await repository.save(invalidRoot, {
        baseline: invalidBaseline,
        snapshot: { folderColors: { car: "#111111" } }
    });
    assert(normal.errorCode === "invalid-current-file", "normal save replaced invalid JSON");
    assert(invalidRoot.state.writes === 0, "normal invalid save wrote");
    const overwritten = await repository.save(invalidRoot, {
        baseline: invalidBaseline,
        snapshot: { folderColors: { car: "#111111" } },
        conflictPolicy: "explicit-overwrite"
    });
    assert(overwritten.status === "saved", "explicit invalid overwrite failed");
    assert(invalidRoot.state.content === serialized({ car: "#111111" }), "overwrite bytes wrong");

    const missingRoot = createMemoryRoot();
    const missingOverwrite = await repository.save(missingRoot, {
        baseline: await repository.load(missingRoot),
        snapshot: { folderColors: { "": "#222222" } },
        conflictPolicy: "explicit-overwrite"
    });
    assert(missingOverwrite.status === "saved", "explicit overwrite could not create missing file");

    const validRoot = createMemoryRoot({ content: serialized({ "": "#111111" }) });
    const validOverwrite = await repository.save(validRoot, {
        baseline: await repository.load(validRoot),
        snapshot: { folderColors: { "": "#222222" } },
        conflictPolicy: "explicit-overwrite"
    });
    assert(validOverwrite.status === "saved", "explicit valid overwrite failed");
    assert(validRoot.state.content === serialized({ "": "#222222" }), "valid overwrite content wrong");

    const deniedRoot = createMemoryRoot({ content: serialized({}), permission: "denied" });
    const denied = await repository.save(deniedRoot, {
        baseline: await repository.load(deniedRoot),
        snapshot: { folderColors: {} },
        conflictPolicy: "explicit-overwrite"
    });
    assert(denied.errorCode === "write-permission-denied", "overwrite permission denial ignored");
    assert(deniedRoot.state.writes === 0, "denied overwrite wrote");

    const tamperedRoot = createMemoryRoot({
        content: serialized({}),
        tamper: serialized({ car: "#999999" })
    });
    const verification = await repository.save(tamperedRoot, {
        baseline: await repository.load(tamperedRoot),
        snapshot: { folderColors: { car: "#333333" } },
        conflictPolicy: "explicit-overwrite"
    });
    assert(verification.errorCode === "verification-failed", "overwrite verification mismatch passed");

    const closeRoot = createMemoryRoot({
        content: serialized({}),
        closeError: new Error("close")
    });
    const closeFailure = await repository.save(closeRoot, {
        baseline: await repository.load(closeRoot),
        snapshot: { folderColors: { car: "#444444" } },
        conflictPolicy: "explicit-overwrite"
    });
    assert(closeFailure.errorCode === "close-failed", "overwrite close failure passed");

    const readFailureRoot = createMemoryRoot({
        content: serialized({}),
        readError: new Error("read")
    });
    const readFailure = await repository.save(readFailureRoot, {
        baseline: { fileExists: true, fingerprint: "old" },
        snapshot: { folderColors: {} },
        conflictPolicy: "explicit-overwrite"
    });
    assert(readFailure.errorCode === "conflict-check-unavailable", "overwrite ignored unreadable current file");
    assert(readFailureRoot.state.writes === 0, "unreadable overwrite wrote file");

    const invalidPolicy = await repository.save(missingRoot, {
        baseline: await repository.load(missingRoot),
        snapshot: { folderColors: {} },
        conflictPolicy: "unsafe"
    });
    assert(invalidPolicy.errorCode === "invalid-conflict-policy", "unsafe conflict policy accepted");
}

class FakeElement {

    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.listeners = new Map();
        this.attributes = new Map();
        this.hidden = false;
        this.disabled = false;
        this.open = false;
        this.isConnected = true;
        this.className = "";
        this.textContent = "";
        this.dataset = {};
    }

    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === "open") this.open = true; }
    removeAttribute(name) { this.attributes.delete(name); if (name === "open") this.open = false; }
    hasAttribute(name) { return this.attributes.has(name); }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }
    dispatch(type) {
        const event = { preventDefault() { this.defaultPrevented = true; } };
        (this.listeners.get(type) || []).forEach(listener => listener(event));
        return event;
    }
    click() { this.dispatch("click"); }
    focus() { globalThis.document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch("close"); }
    querySelector(selector) {
        const className = selector.startsWith(".") ? selector.slice(1) : null;
        for (const child of this.children) {
            if (className && child.className.split(" ").includes(className)) return child;
            const nested = child.querySelector?.(selector);
            if (nested) return nested;
        }
        return null;
    }
}

function testPanelAndDialog() {

    const originalDocument = globalThis.document;
    const usesBrowserDocument = Boolean(originalDocument?.body);
    const events = [];
    if (!usesBrowserDocument) {
        globalThis.document = {
            activeElement: null,
            createElement: tagName => new FakeElement(tagName)
        };
    }

    try {
        const panel = new LibrarySettingsPanel({
            emit(type) { events.push(type); }
        });
        if (usesBrowserDocument) {
            originalDocument.body.append(panel.element);
        }
        panel.setAvailable(true);
        panel.render({
            dirty: false,
            saving: false,
            reloading: false,
            migrationAvailable: true,
            saveStatus: "idle",
            status: "missing",
            source: "legacy-local"
        });
        assert(!panel.migrationButton.hidden, "migration button not shown");
        assert(panel.saveButton.hidden, "duplicate save button shown during migration");
        panel.migrationButton.click();
        panel.reloadButton.click();
        assert(events.includes("library-settings:migrate-requested"), "migration event missing");
        assert(events.includes("library-settings:reload-requested"), "reload event missing");

        panel.render({
            dirty: false,
            saving: false,
            reloading: false,
            migrationAvailable: false,
            saveStatus: "conflict",
            saveErrorCode: "conflict",
            status: "missing",
            source: "legacy-local"
        });
        assert(!panel.saveButton.disabled, "migration conflict could not reopen recovery dialog");

        panel.render({
            dirty: true,
            saving: false,
            reloading: false,
            migrationAvailable: false,
            saveStatus: "conflict",
            status: "loaded",
            source: "shared-json"
        });
        panel.openConflict();
        assert(panel.isConflictOpen(), "conflict dialog did not open");
        assert(globalThis.document.activeElement === panel.conflictDialog.cancelButton, "Cancel was not default focus");
        const cancelEvent = usesBrowserDocument
            ? new Event("cancel", { cancelable: true })
            : panel.conflictDialog.element.dispatch("cancel");
        if (usesBrowserDocument) {
            panel.conflictDialog.element.dispatchEvent(cancelEvent);
        }
        assert(cancelEvent.defaultPrevented, "Escape did not use safe Cancel");
        assert(!panel.isConflictOpen(), "Escape did not close dialog");
        assert(globalThis.document.activeElement === panel.saveButton, "focus did not return to origin");

        panel.openConflict({ invalid: true });
        panel.conflictDialog.element.querySelector(
            ".settings-conflict-reload"
        ).click();
        assert(events.includes("library-settings:conflict-reload-requested"), "conflict Reload event missing");
        panel.openConflict();
        panel.conflictDialog.element.querySelector(
            ".settings-conflict-overwrite"
        ).click();
        assert(events.includes("library-settings:overwrite-requested"), "Overwrite event missing");
    } finally {
        if (usesBrowserDocument) {
            originalDocument.querySelector(".library-settings-panel")?.remove();
        } else {
            globalThis.document = originalDocument;
        }
    }
}

export async function runSharedLibrarySettingsRecoveryTests() {

    await testMigration();
    await testReload();
    await testConflictAndOverwrite();
    await testRepositoryOverwrite();
    testPanelAndDialog();

    return { assertions };
}

if (output) {
    runSharedLibrarySettingsRecoveryTests()
        .then(result => {
            output.textContent = `PASS: ${result.assertions} assertions`;
            document.documentElement.dataset.testStatus = "pass";
        })
        .catch(error => {
            output.textContent = `FAIL: ${error.message}`;
            document.documentElement.dataset.testStatus = "fail";
        });
}
