import GSIElevationProvider from "../../src/js/services/GSIElevationProvider.js";
import CurrentElevationController from "../../src/js/core/CurrentElevationController.js";
import CurrentPositionController from "../../src/js/core/CurrentPositionController.js";
import EventBus from "../../src/js/core/EventBus.js";
import StatusBar from "../../src/js/ui/StatusBar.js";

let assertions = 0;
function assert(condition, message) {
    assertions++;
    if (!condition) throw new Error(message);
}
async function rejects(work, message) {
    let failed = false;
    try { await work(); } catch { failed = true; }
    assert(failed, message);
}
const position = (latitude = 35, accuracy = 8) => ({ latitude, longitude: 135, accuracy });
const result = meters => ({ meters, source: "国土地理院", dataset: "10m" });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function harness({ interval = 0, now = () => Date.now() } = {}) {
    const documentObject = new EventTarget();
    documentObject.visibilityState = "visible";
    const windowObject = new EventTarget();
    const requests = [];
    const view = new StatusBar();
    const controller = new CurrentElevationController({
        provider: { lookup(point, options) {
            return new Promise((resolve, reject) => requests.push({ point, ...options, resolve, reject }));
        } },
        view, documentObject, windowObject, minIntervalMs: interval, now
    });
    return { controller, requests, view, documentObject, windowObject };
}

async function testProvider() {
    const originalFetch = globalThis.fetch;
    let defaultReceiver;
    try {
        globalThis.fetch = function () {
            defaultReceiver = this;
            return Promise.resolve({ ok: true, json: async () => ({ elevation: 25.2, hsrc: "10m" }) });
        };
        const value = await new GSIElevationProvider().lookup(position());
        assert(value.meters === 25.2 && defaultReceiver === globalThis,
            "default fetch lost its browser receiver");
    } finally {
        globalThis.fetch = originalFetch;
    }
    const requests = [];
    const provider = new GSIElevationProvider({ fetchFunction: async (url, options) => {
        requests.push({ url: new URL(url), options });
        return { ok: true, json: async () => ({ elevation: 245.4, hsrc: "10m" }) };
    } });
    assert(requests.length === 0, "elevation provider fetches at construction");
    const value = await provider.lookup(position());
    assert(value.meters === 245.4 && value.source === "国土地理院" && value.dataset === "10m",
        "ground elevation/source metadata changed");
    const request = requests[0];
    assert(request.url.protocol === "https:" && request.url.hostname === "cyberjapandata2.gsi.go.jp" &&
        request.url.searchParams.get("lat") === "35" && request.url.searchParams.get("lon") === "135" &&
        request.url.searchParams.get("outtype") === "JSON", "incorrect documented GSI API request");
    assert(request.options.credentials === "omit" && request.options.referrerPolicy === "no-referrer",
        "elevation requests send credentials/referrer");
    for (const point of [{ latitude: null, longitude: 135 }, { latitude: 91, longitude: 135 },
        { latitude: 35, longitude: Infinity }, { latitude: 35, longitude: -181 }]) {
        await rejects(() => provider.lookup(point), "invalid coordinates reached provider");
    }
    assert(requests.length === 1, "invalid position issued a request");
    for (const elevation of [null, "-----", "245", NaN, Infinity]) {
        const invalid = new GSIElevationProvider({ fetchFunction: async () => ({
            ok: true, json: async () => ({ elevation, hsrc: "10m" })
        }) });
        await rejects(() => invalid.lookup(position()), "no-data/invalid elevation became zero");
    }
    for (const meters of [0, -12]) {
        const valid = new GSIElevationProvider({ fetchFunction: async () => ({
            ok: true, json: async () => ({ elevation: meters, hsrc: "10m" })
        }) });
        assert((await valid.lookup(position())).meters === meters, "zero/negative ground elevation rejected");
    }
    await rejects(() => new GSIElevationProvider({ fetchFunction: async () => ({ ok: false, status: 503 }) })
        .lookup(position()), "HTTP failure returned an elevation");
    await rejects(() => new GSIElevationProvider({ fetchFunction: async () => {
        throw new Error("offline");
    } }).lookup(position()), "offline failure returned an elevation");
    await rejects(() => new GSIElevationProvider({ fetchFunction: async () => ({
        ok: true, json: async () => { throw new Error("invalid JSON"); }
    }) }).lookup(position()), "invalid JSON returned an elevation");
    const abortable = new GSIElevationProvider({ timeoutMs: 5, fetchFunction: (_, { signal }) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))))
    });
    await rejects(() => abortable.lookup(position()), "network lookup has no bounded timeout");
    const abort = new AbortController();
    const pending = abortable.lookup(position(), { signal: abort.signal });
    abort.abort();
    await rejects(() => pending, "caller abort did not cancel the network lookup");
}

async function testController() {
    const fixture = harness();
    const { controller, requests, view } = fixture;
    assert(view.elevation.hidden && requests.length === 0, "startup exposed elevation or fetched GPS");
    controller.update(position());
    assert(requests.length === 1 && view.elevation.textContent === "標高 —",
        "first GPS fix did not initiate one lookup");
    for (let i = 0; i < 10; i++) controller.update(position(35 + i * 0.000001));
    assert(requests.length === 1, "GPS updates amplified an in-flight request");
    requests[0].resolve(result(245.4));
    await tick();
    assert(view.elevation.textContent === "標高 約245 m" && view.elevation.title.includes("国土地理院"),
        "ground elevation did not use approximate/source presentation");
    controller.update(position(35.00001));
    assert(requests.length === 1, "nearby position discarded the session cache");
    controller.update(position(36));
    assert(requests.length === 2 && view.elevation.textContent === "標高 —",
        "old elevation was displayed at a distant position");
    controller.update(position(37));
    requests[1].resolve(result(99));
    await tick();
    assert(requests.length === 3 && view.elevation.textContent === "標高 —",
        "stale completion overwrote the latest GPS position");
    requests[2].reject(new Error("offline"));
    await tick();
    assert(view.elevation.textContent === "標高 —" && requests.length === 3,
        "network error showed a fabricated elevation or retried automatically");
    controller.update(position(37));
    requests[3].resolve(result(-5));
    await tick();
    assert(view.elevation.textContent === "標高 約-5 m", "negative elevation display failed");
    controller.update(position(38, 100));
    assert(requests.length === 4 && view.elevation.textContent === "標高 —" &&
        view.elevation.title.includes("位置精度"), "low GPS accuracy triggered elevation lookup");
    for (const point of [position(91), position(35, NaN), null]) controller.update(point);
    assert(requests.length === 4, "invalid GPS data triggered a request");
    controller.update(position(38));
    const stopped = requests[4];
    controller.clear();
    stopped.resolve(result(888));
    await tick();
    assert(stopped.signal.aborted && view.elevation.hidden,
        "GPS stop failed to cancel/hide or accepted stale result");
    controller.update(position(39));
    fixture.documentObject.visibilityState = "hidden";
    fixture.documentObject.dispatchEvent(new Event("visibilitychange"));
    const hidden = requests[5];
    hidden.resolve(result(777));
    controller.update(position(40));
    await tick();
    assert(hidden.signal.aborted && requests.length === 6 && view.elevation.textContent === "標高 —",
        "hidden page fetched elevation or accepted stale results");
    fixture.documentObject.visibilityState = "visible";
    fixture.documentObject.dispatchEvent(new Event("visibilitychange"));
    assert(requests.length === 7 && requests[6].point.latitude === 40,
        "visible page did not resume from latest valid GPS state");
    fixture.windowObject.dispatchEvent(new Event("pagehide"));
    assert(requests[6].signal.aborted && view.elevation.hidden, "pagehide left elevation active");
    controller.detach();
    controller.update(position());
    assert(requests.length === 7, "detached controller fetched again");

    let clock = 100;
    const throttled = harness({ interval: 30000, now: () => clock });
    throttled.controller.update(position());
    throttled.requests[0].resolve(result(10));
    await tick();
    for (let i = 0; i < 100; i++) throttled.controller.update(position(36));
    assert(throttled.requests.length === 1, "100 rapid GPS fixes bypassed the 30s rate limit");
    clock += 30000;
    throttled.controller.update(position(37));
    assert(throttled.requests.length === 2 && throttled.requests[1].point.latitude === 37,
        "rate-limited lookup used an old queued location");
    throttled.controller.detach();

    const offline = harness();
    offline.controller.provider = { lookup: async () => result(100) };
    offline.controller.update(position());
    await tick();
    assert(offline.view.elevation.textContent === "標高 約100 m" && offline.requests.length === 0,
        "provider boundary cannot accept future offline lookup without HTTP");
    offline.controller.detach();
}

async function testGPSWiring() {
    const updates = [];
    let unavailable = 0;
    const service = {
        tracking: false, watches: 0,
        isSupported: () => true,
        isTracking() { return this.tracking; },
        start(success, error) { this.tracking = true; this.watches++; this.success = success; this.error = error; },
        stop() { this.tracking = false; }
    };
    const controller = new CurrentPositionController({
        mapView: { setCurrentPosition() {}, followCurrentPosition() {} },
        eventBus: new EventBus(), service, windowObject: new EventTarget(),
        onPosition: point => updates.push(point), onUnavailable: () => unavailable++
    });
    assert(updates.length === 0 && service.watches === 0, "construction started GPS/elevation");
    controller.button.click();
    service.success({ coords: { latitude: 35, longitude: 135, accuracy: 8, altitude: 9999 } });
    assert(updates.length === 1 && updates[0].latitude === 35 && updates[0].accuracy === 8 &&
        !("altitude" in updates[0]), "GPS callback confused ellipsoid altitude with ground elevation");
    controller.button.click();
    service.success({ coords: { latitude: 36, longitude: 135, accuracy: 8 } });
    assert(!controller.isFollowing() && updates.length === 2 && service.watches === 1,
        "follow OFF stopped elevation or duplicated GPS watch");
    service.error({ code: 2 });
    assert(unavailable === 1, "GPS error did not clear stale elevation");
    controller.stop();
    assert(unavailable === 2, "GPS stop did not clear elevation");
}

function testLayout() {
    const view = new StatusBar();
    const build = document.createElement("span");
    build.className = "map-build-indicator";
    build.textContent = "v1.11.0 · 12345678";
    const mapContainer = document.createElement("div");
    view.attachBuildInfo(build);
    const detachElevation = view.attachElevationPanel(mapContainer);
    view.showLibraryLoaded({ name: "GPX", gpxFileCount: 1133, folderCount: 10 });
    document.body.append(view.element, mapContainer);
    const message = view.message.textContent;
    const mobile = matchMedia("(max-width: 768px), (max-height: 500px) and (pointer: coarse)").matches;
    const before = view.element.getBoundingClientRect();
    for (const meters of [0, 245, -12, 8849]) {
        view.showCurrentElevation(result(meters));
        assert(view.message.textContent === message && build.isConnected &&
            view.buildSlot.contains(build),
            "elevation replaced GPX summary/build indicator");
        if (mobile) {
            const after = view.element.getBoundingClientRect();
            assert(after.height === before.height && after.top === before.top &&
                build.getBoundingClientRect().right <= innerWidth &&
                view.elevation.getBoundingClientRect().right <= innerWidth &&
                view.elevation.getBoundingClientRect().bottom < after.top &&
                !view.element.contains(view.elevation) &&
                getComputedStyle(view.element).backgroundColor === "rgba(248, 250, 252, 0.72)",
            "mobile elevation changed footer footprint, overflowed, or lost translucency");
        }
    }
    view.showDisplaySummary(20, 0);
    assert(view.elevation.textContent === "標高 約8849 m", "Track display refresh cleared GPS elevation");
    view.showCurrentElevation(null);
    assert(view.elevation.textContent === "標高 —", "unavailable elevation crashed the view");
    view.hideCurrentElevation();
    assert(view.elevation.hidden && view.elevation.textContent === "", "hidden elevation retained a gap/value");
    view.element.remove();
    detachElevation();
    mapContainer.remove();
}

try {
    await testProvider();
    await testController();
    await testGPSWiring();
    testLayout();
    document.getElementById("result").textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    document.getElementById("result").textContent = `FAIL after ${assertions}: ${error.stack}`;
    throw error;
}
