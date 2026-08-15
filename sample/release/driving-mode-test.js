import DrivingModeController from "../../src/js/core/DrivingModeController.js";
import EventBus from "../../src/js/core/EventBus.js";
import ScreenWakeLockService from
    "../../src/js/services/ScreenWakeLockService.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class VisibilityDocument {
    constructor() {
        this.visibilityState = "visible";
        this.listeners = new Set();
    }
    addEventListener(name, listener) {
        if (name === "visibilitychange") this.listeners.add(listener);
    }
    removeEventListener(name, listener) {
        if (name === "visibilitychange") this.listeners.delete(listener);
    }
    change(state) {
        this.visibilityState = state;
        this.listeners.forEach(listener => listener());
    }
}

function createSentinel() {
    const listeners = new Set();
    return {
        released: false,
        addEventListener(name, listener) {
            if (name === "release") listeners.add(listener);
        },
        async release() {
            this.released = true;
            listeners.forEach(listener => listener());
        }
    };
}

async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

async function testWakeLock() {
    const visibility = new VisibilityDocument();
    const sentinels = [];
    const wakeLock = {
        async request(type) {
            assert(type === "screen", "Wake Lock type changed");
            const sentinel = createSentinel();
            sentinels.push(sentinel);
            return sentinel;
        }
    };
    const service = new ScreenWakeLockService({
        wakeLock,
        documentObject: visibility
    });

    assert(await service.request() && sentinels.length === 1 &&
        service.isActive(), "Wake Lock request failed");
    assert(await service.request() && sentinels.length === 1,
        "duplicate Wake Lock requested");
    visibility.change("hidden");
    await sentinels[0].release();
    visibility.change("visible");
    await flush();
    assert(sentinels.length === 2 && service.isActive(),
        "visible restoration did not reacquire Wake Lock");
    assert(await service.release() && !service.isActive(),
        "Wake Lock release failed");
    visibility.change("visible");
    await flush();
    assert(sentinels.length === 2,
        "inactive driving state reacquired Wake Lock");

    const unsupported = new ScreenWakeLockService({
        wakeLock: null,
        documentObject: new VisibilityDocument()
    });
    assert(!await unsupported.request() &&
        unsupported.getStatus() === "unsupported",
    "unsupported Wake Lock handling failed");
    const rejected = new ScreenWakeLockService({
        wakeLock: { request: async () => { throw new Error("denied"); } },
        documentObject: new VisibilityDocument()
    });
    assert(!await rejected.request() && rejected.getStatus() === "error",
        "Wake Lock rejection handling failed");
}

class FakeMedia {
    constructor(matches) { this.matches = matches; this.listeners = []; }
    addEventListener(name, listener) {
        if (name === "change") this.listeners.push(listener);
    }
    set(matches) {
        this.matches = matches;
        this.listeners.forEach(listener => listener({ matches }));
    }
}

async function testDrivingMode() {
    const eventBus = new EventBus();
    const mobileMedia = new FakeMedia(true);
    const workspace = document.createElement("main");
    const trackInfo = document.createElement("section");
    const gpsButton = document.createElement("button");
    const currentPosition = {
        following: false,
        starts: 0,
        stops: 0,
        button: gpsButton,
        startFollowing() {
            this.starts += 1;
            this.following = true;
            return true;
        },
        stopFollowing() {
            this.stops += 1;
            this.following = false;
            return true;
        },
        isFollowing() { return this.following; }
    };
    const wakeLock = {
        requests: 0, releases: 0, active: false,
        async request() { this.requests += 1; this.active = true; return true; },
        async release() { this.releases += 1; this.active = false; return true; },
        isActive() { return this.active; }
    };
    const controls = {
        closes: 0,
        setSidebarOpen(open) { if (!open) this.closes += 1; }
    };
    const controller = new DrivingModeController({
        currentPosition,
        eventBus,
        viewStateControls: controls,
        workspace,
        trackInfoElement: trackInfo,
        wakeLock,
        mobileMedia
    });

    controller.attach(document.body);
    assert(await controller.enable() && controller.isActive(),
        "Mobile driving mode did not start");
    assert(currentPosition.starts === 1 && currentPosition.isFollowing(),
        "driving mode did not enable GPS Follow");
    assert(wakeLock.requests === 1 && controls.closes === 1,
        "driving mode did not request Wake Lock or close Sidebar");
    assert(trackInfo.classList.contains("is-mobile-dismissed") &&
        workspace.classList.contains("is-driving-mode"),
    "driving mode presentation was not applied");

    currentPosition.following = false;
    eventBus.emit("map:user-drag-started");
    assert(controller.isActive() &&
        controller.status.textContent.includes("GPS追従OFF"),
    "Map drag disabled driving mode or did not show Follow OFF");
    gpsButton.click();

    assert(await controller.disable() && !controller.isActive(),
        "driving mode did not stop");
    assert(currentPosition.stops === 1 && wakeLock.releases === 1 &&
        !workspace.classList.contains("is-driving-mode"),
    "driving mode cleanup failed");

    mobileMedia.set(false);
    assert(controller.element.hidden && !await controller.enable(),
        "Desktop exposed an active driving-mode entry");

    const rejectedGps = { ...currentPosition, following: false, starts: 0 };
    const rejectedController = new DrivingModeController({
        currentPosition: rejectedGps,
        eventBus: new EventBus(),
        viewStateControls: controls,
        workspace: document.createElement("main"),
        wakeLock: {
            request: async () => false,
            release: async () => false,
            isActive: () => false
        },
        mobileMedia: new FakeMedia(true)
    });
    assert(await rejectedController.enable() && rejectedGps.starts === 1 &&
        rejectedController.status.textContent.includes("画面保持不可"),
    "Wake Lock rejection stopped GPS driving mode");
    await rejectedController.disable();
    assert(!new DrivingModeController({
        currentPosition,
        eventBus: new EventBus(),
        viewStateControls: controls,
        workspace: document.createElement("main"),
        wakeLock,
        mobileMedia: new FakeMedia(true)
    }).isActive(), "new page session did not start with driving mode OFF");
    assert(!/localStorage|indexedDB|trailbook\.viewState|trailbook\.json/.test(
        await fetch("../../src/js/core/DrivingModeController.js")
            .then(response => response.text())
    ), "driving mode state is persisted");
}

try {
    await testWakeLock();
    await testDrivingMode();
    output.textContent = `PASS: ${assertions} assertions`;
    document.title = "PASS";
} catch (error) {
    output.textContent = `FAIL: ${error.stack || error}`;
    document.title = "FAIL";
    throw error;
}
