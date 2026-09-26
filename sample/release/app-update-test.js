import AppUpdateCoordinator from "../../src/js/core/AppUpdateCoordinator.js";
import LibraryMaintenancePanel from "../../src/js/ui/LibraryMaintenancePanel.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    removeEventListener(type, listener) {
        this.listeners.set(type, (this.listeners.get(type) || [])
            .filter(candidate => candidate !== listener));
    }
    dispatch(type) {
        (this.listeners.get(type) || []).slice().forEach(listener => listener());
    }
}

class Worker extends Target {
    constructor(state, onMessage) {
        super();
        this.state = state;
        this.messages = [];
        this.onMessage = onMessage;
    }
    postMessage(message) {
        this.messages.push(message);
        this.onMessage?.(message);
    }
    setState(state) {
        this.state = state;
        this.dispatch("statechange");
    }
}

function fixture({
    worker = null,
    update = async () => {},
    networkBuild = "11111111",
    runtimeBuild = "11111111",
    fetchError = null,
    networkBody = null,
    cacheNames = [],
    scope = "https://example.test/TrailBook/",
    timeoutMs = 1000,
    installTimeoutMs = 1000
} = {}) {
    const panel = new LibraryMaintenancePanel({ emit() {} });
    const serviceWorker = new Target();
    const deleted = [];
    const reloads = [];
    const warnings = [];
    let unregisters = 0;
    const registration = new Target();

    registration.scope = scope;
    registration.waiting = worker?.state === "installed" ? worker : null;
    registration.installing = worker?.state === "installing" ? worker : null;
    registration.updateCalls = 0;
    registration.update = async () => {
        registration.updateCalls += 1;
        await update({ registration, worker });
    };
    registration.unregister = async () => { unregisters += 1; return true; };
    const coordinator = new AppUpdateCoordinator({
        panel,
        serviceWorkerRegistration: registration,
        registerServiceWorker: async () => registration,
        navigatorObject: { serviceWorker },
        locationObject: {
            href: scope,
            hostname: new URL(scope).hostname,
            reload() {}
        },
        secureContext: true,
        cacheStorage: {
            async keys() { return cacheNames; },
            async delete(name) { deleted.push(name); return true; }
        },
        fetchFunction: async () => {
            if (fetchError) throw fetchError;
            return {
                ok: true,
                text: async () => networkBody ??
                    `window.TRAILBOOK_BUILD = Object.freeze({"commit":"${networkBuild}"});`
            };
        },
        runtimeBuildIdentifier: runtimeBuild,
        reload: () => reloads.push(true),
        consoleObject: { warn(...values) { warnings.push(values); } },
        timeoutMs,
        installTimeoutMs
    });

    return {
        panel, serviceWorker, registration, coordinator, deleted, reloads,
        warnings, getUnregisters: () => unregisters
    };
}

async function testLatestAndNoAutostart() {
    const test = fixture();

    test.coordinator.attach();
    assert(!test.panel.appUpdateButton.disabled,
        "current deployed build update action was disabled");
    assert(test.registration.updateCalls === 0,
        "attach automatically checked for an update");
    assert(await test.coordinator.update() === false,
        "same build was not reported as latest");
    assert(test.registration.updateCalls === 1,
        "button path did not call registration.update once");
    assert(test.panel.appUpdateStatus.textContent === "最新版です。",
        "latest status missing");
    assert(!test.panel.appUpdateButton.disabled,
        "latest result left the update action disabled");
    assert(test.deleted.length === 0 && test.reloads.length === 0,
        "latest check changed the app shell");
}

async function testDeployedStaleBuildAvailability() {
    const test = fixture({
        runtimeBuild: "11111111",
        networkBuild: "22222222"
    });

    assert(test.coordinator.attach(),
        "stale deployed build update action was not attached");
    assert(!test.panel.appUpdateButton.disabled,
        "stale deployed build update action was disabled");
}

async function testLocalDevelopmentAvailability() {
    const test = fixture();

    test.coordinator.locationObject = {
        href: "http://localhost:8000/src/",
        hostname: "localhost",
        reload() {}
    };
    assert(test.coordinator.attach() === false,
        "localhost update action was attached");
    assert(test.panel.appUpdateButton.disabled,
        "localhost update action remained enabled");
    assert(test.panel.appUpdateStatus.textContent.includes("ローカル版"),
        "localhost update guidance missing");
    test.panel.appUpdateButton.click();
    assert(test.registration.updateCalls === 0,
        "localhost update action called Service Worker update");
}

async function testWaitingActivation() {
    let serviceWorker;
    const worker = new Worker("installed", () => {
        serviceWorker.dispatch("controllerchange");
    });
    const test = fixture({ worker });

    serviceWorker = test.serviceWorker;
    test.coordinator.attach();
    assert(await test.coordinator.update(), "waiting update was not applied");
    assert(worker.messages.length === 1 &&
        worker.messages[0].type === "SKIP_WAITING",
    "waiting worker did not receive SKIP_WAITING");
    assert(test.reloads.length === 1, "controllerchange did not reload once");
    test.serviceWorker.dispatch("controllerchange");
    assert(test.reloads.length === 1, "controllerchange reloaded twice");
}

async function testUnsupportedAvailability() {
    const test = fixture();

    test.coordinator.navigatorObject = {};
    assert(test.coordinator.attach() === false,
        "unsupported update action was attached");
    assert(test.panel.appUpdateButton.disabled &&
        test.panel.appUpdateStatus.textContent.includes("利用できません"),
    "unsupported update action did not explain its disabled state");
}

async function testInstallingActivation() {
    let serviceWorker;
    const worker = new Worker("installing", () => {
        serviceWorker.dispatch("controllerchange");
    });
    const test = fixture({
        worker,
        update: async ({ registration }) => {
            setTimeout(() => {
                registration.installing = null;
                registration.waiting = worker;
                worker.setState("installed");
            }, 0);
        }
    });

    serviceWorker = test.serviceWorker;
    test.coordinator.attach();
    assert(await test.coordinator.update(),
        "installing update did not activate after becoming waiting");
    assert(worker.messages[0]?.type === "SKIP_WAITING" &&
        test.reloads.length === 1,
    "installing update activation sequence failed");
}

async function testSlowInstallationUsesInstallDeadline() {
    let serviceWorker;
    const worker = new Worker("installing", () => {
        serviceWorker.dispatch("controllerchange");
    });
    const test = fixture({
        worker,
        timeoutMs: 10,
        installTimeoutMs: 100,
        update: async ({ registration }) => {
            setTimeout(() => {
                registration.installing = null;
                registration.waiting = worker;
                worker.setState("installed");
            }, 25);
        }
    });

    serviceWorker = test.serviceWorker;
    test.coordinator.attach();
    assert(await test.coordinator.update(),
        "slow app-shell install used the controller-change deadline");
    assert(test.reloads.length === 1,
        "slow app-shell install did not reload exactly once");
}

async function testTimeoutsRemainRetryable() {
    const installWorker = new Worker("installing");
    const installTimeout = fixture({
        worker: installWorker,
        installTimeoutMs: 10
    });

    installTimeout.coordinator.attach();
    assert(!await installTimeout.coordinator.update(),
        "install timeout was reported successful");
    assert(!installTimeout.panel.appUpdateButton.disabled,
        "install timeout left the update action disabled");

    const installedWorker = new Worker("installed");
    const activationTimeout = fixture({
        worker: installedWorker,
        timeoutMs: 10
    });

    activationTimeout.coordinator.attach();
    assert(!await activationTimeout.coordinator.update(),
        "controller-change timeout was reported successful");
    assert(!activationTimeout.panel.appUpdateButton.disabled,
        "controller-change timeout left the update action disabled");
}

async function testNewInstallingWorkerSupersedesOldWaitingWorker() {
    let serviceWorker;
    const oldWaiting = new Worker("installed");
    const newInstalling = new Worker("installing", () => {
        serviceWorker.dispatch("controllerchange");
    });
    const test = fixture({
        worker: oldWaiting,
        update: async ({ registration }) => {
            registration.installing = newInstalling;
            registration.dispatch("updatefound");
            setTimeout(() => {
                oldWaiting.setState("redundant");
                registration.installing = null;
                registration.waiting = newInstalling;
                newInstalling.setState("installed");
            }, 0);
        }
    });

    serviceWorker = test.serviceWorker;
    test.coordinator.attach();
    assert(await test.coordinator.update(),
        "new worker was not activated over a stale waiting worker");
    assert(oldWaiting.messages.length === 0,
        "stale waiting worker received the activation message");
    assert(newInstalling.messages[0]?.type === "SKIP_WAITING" &&
        test.reloads.length === 1,
    "newly discovered worker did not activate with one reload");
}

async function testFailureAndOfflineSafety() {
    const updateFailure = fixture({
        update: async () => { throw new Error("update failed"); },
        cacheNames: ["trailbook-app-shell-old"]
    });

    updateFailure.coordinator.attach();
    assert(!await updateFailure.coordinator.update(),
        "registration failure was reported successful");
    assert(updateFailure.deleted.length === 0 &&
        updateFailure.getUnregisters() === 0,
    "registration failure deleted the working shell");
    assert(!updateFailure.panel.appUpdateButton.disabled,
        "registration failure left the update action disabled");

    const offline = fixture({
        fetchError: new Error("offline"),
        cacheNames: ["trailbook-app-shell-old"]
    });

    offline.coordinator.attach();
    assert(!await offline.coordinator.update(), "offline check succeeded");
    assert(offline.deleted.length === 0 && offline.reloads.length === 0 &&
        offline.getUnregisters() === 0,
    "offline check removed the working app shell");
    assert(offline.panel.appUpdateStatus.textContent === "更新できませんでした。",
        "offline error feedback missing");
    assert(!offline.panel.appUpdateButton.disabled,
        "recoverable network failure left the update action disabled");

    const invalidMetadata = fixture({ networkBody: "invalid build metadata" });

    invalidMetadata.coordinator.attach();
    assert(!await invalidMetadata.coordinator.update(),
        "invalid build metadata was accepted");
    assert(invalidMetadata.warnings[0]?.[0]?.includes("network-build-check") &&
        invalidMetadata.warnings[0]?.[1] === "Latest build metadata is invalid.",
    "update failure diagnostic did not identify the failing stage");
}

async function testTransientRegistrationRetry() {
    const test = fixture();
    let lookupCalls = 0;
    let registrationCalls = 0;

    test.coordinator.serviceWorkerRegistration = Promise.reject(
        new Error("initial registration failed")
    );
    test.coordinator.navigatorObject.serviceWorker.getRegistration = async () => {
        lookupCalls += 1;
        if (lookupCalls === 1) throw new Error("lookup failed");
        return test.registration;
    };
    test.coordinator.registerServiceWorker = async () => {
        registrationCalls += 1;
        return test.registration;
    };
    test.coordinator.attach();

    assert(!await test.coordinator.update(),
        "transient registration failure was reported successful");
    assert(!test.panel.appUpdateButton.disabled,
        "transient registration failure permanently disabled retry");
    assert(await test.coordinator.update() === false,
        "registration retry did not reach the latest-build result");
    assert(lookupCalls === 2 && registrationCalls === 0,
        "registration retry did not use the exact existing TrailBook scope");
}

async function testMissingRegistrationCanRecover() {
    const test = fixture();
    let registerCalls = 0;

    test.coordinator.serviceWorkerRegistration = null;
    test.coordinator.navigatorObject.serviceWorker.getRegistration =
        async () => null;
    test.coordinator.registerServiceWorker = async () => {
        registerCalls += 1;
        return test.registration;
    };
    test.coordinator.attach();

    assert(await test.coordinator.update() === false && registerCalls === 1,
        "missing deployed registration was not recovered safely");
    assert(!test.panel.appUpdateButton.disabled,
        "recovered registration left the update action disabled");
}

async function testScopedFallback() {
    const test = fixture({
        networkBuild: "22222222",
        runtimeBuild: "11111111",
        networkBody:
            'window.TRAILBOOK_BUILD = Object.freeze({commit:"22222222"});',
        cacheNames: [
            "trailbook-app-shell-old",
            "trailbook-app-shell-current",
            "unrelated-cache"
        ]
    });

    test.coordinator.attach();
    assert(await test.coordinator.update(), "stale build fallback did not run");
    assert(test.deleted.join(",") ===
        "trailbook-app-shell-old,trailbook-app-shell-current",
    "fallback deleted outside TrailBook app-shell ownership");
    assert(!test.deleted.includes("unrelated-cache"),
        "fallback deleted unrelated Cache Storage");
    assert(test.getUnregisters() === 1 && test.reloads.length === 1,
        "fallback did not unregister and reload exactly once");
}

async function testConcurrencyAndPanelLifecycle() {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const test = fixture({ update: () => pending });

    test.coordinator.attach();
    const first = test.coordinator.update();
    await Promise.resolve();
    assert(await test.coordinator.update() === false,
    "multiple presses started duplicate update checks");
    release();
    await first;
    assert(test.registration.updateCalls === 1,
        "concurrent update guard did not run exactly one check");

    let calls = 0;
    test.panel.setAppUpdateHandler(() => { calls += 1; });
    test.panel.setAppUpdateHandler(() => { calls += 1; });
    test.panel.appUpdateButton.click();
    assert(calls === 1, "reattach duplicated update UI listeners");
    test.coordinator.detach();
    test.panel.appUpdateButton.click();
    assert(calls === 1 && test.panel.appUpdateButton.disabled,
        "detach retained an active update handler");
}

async function run() {
    await testLatestAndNoAutostart();
    await testDeployedStaleBuildAvailability();
    await testLocalDevelopmentAvailability();
    await testUnsupportedAvailability();
    await testWaitingActivation();
    await testInstallingActivation();
    await testSlowInstallationUsesInstallDeadline();
    await testTimeoutsRemainRetryable();
    await testNewInstallingWorkerSupersedesOldWaitingWorker();
    await testFailureAndOfflineSafety();
    await testTransientRegistrationRetry();
    await testMissingRegistrationCanRecover();
    await testScopedFallback();
    await testConcurrencyAndPanelLifecycle();

    const source = await fetch(
        "../../src/js/core/AppUpdateCoordinator.js"
    ).then(response => response.text());
    assert(!source.includes("indexedDB") && !source.includes("getDirectory") &&
        !source.includes("OfflineMap") && !source.includes("localStorage"),
    "app update coordinator references persistent user storage");
    assert(!source.includes("caches.clear") &&
        source.includes('startsWith(APP_SHELL_CACHE_PREFIX)'),
    "app-shell fallback cache scope is not explicit");

    const mainSource = await fetch("../../src/js/main.js")
        .then(response => response.text());
    assert(
        mainSource.indexOf("appUpdateCoordinator.attach()") <
            mainSource.indexOf("new TrackSourceResolver"),
        "manual update recovery is initialized after optional startup work"
    );

    const panel = new LibraryMaintenancePanel({ emit() {} });
    document.querySelector(".sidebar").append(panel.element);
    panel.setAppUpdateHandler(() => {});
    assert(panel.appUpdateButton.matches('button[type="button"]') &&
        panel.appUpdateButton.textContent.includes("最新版に更新"),
    "Maintenance update action missing");
    if (matchMedia(
        "(max-width:768px), (max-height:500px) and (pointer:coarse)"
    ).matches) {
        assert(panel.appUpdateButton.getBoundingClientRect().height >= 44,
            "mobile update action touch target is below 44px");
        assert(document.documentElement.scrollWidth <= innerWidth,
            "mobile update action causes horizontal clipping");
    }

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    await run();
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
