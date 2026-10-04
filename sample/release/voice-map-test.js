import VoiceMapController, {
    resolveVoiceMapCommand
} from "../../src/js/core/VoiceMapController.js";
import CurrentPositionController from "../../src/js/core/CurrentPositionController.js";
import MapView from "../../src/js/ui/MapView.js";
import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";

let assertions = 0;
function assert(condition, message) {
    assertions++;
    if (!condition) throw new Error(message);
}

const sessions = [];
let inClick = false;
class RecognitionMock {
    constructor() { this.starts = 0; this.aborts = 0; sessions.push(this); }
    start() {
        this.starts++;
        assert(inClick, "recognition start left the synchronous click path");
    }
    abort() { this.aborts++; this.onend?.(); }
    result(text, final = true) {
        const result = [{ transcript: text }];
        result.isFinal = final;
        this.onresult?.({ resultIndex: 0, results: [result] });
    }
}

function click(control) {
    inClick = true;
    try { control.button.click(); } finally { inClick = false; }
}

const windowObject = new EventTarget();
const options = {
    navigatorObject: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
    Recognition: RecognitionMock, secureContext: true, windowObject,
    confirmUse: () => true
};

async function run() {
    for (const [text, expected] of [
        ["ズームイン", "zoomIn"], ["ズームアウト", "zoomOut"],
        ["現在地に戻る", "returnToPosition"], ["現在地に戻って。", "returnToPosition"],
        [" 拡大して！ ", "zoomIn"], ["縮小して", "zoomOut"],
        ["保存", null], ["削除", null], ["白黒にして", null],
        ["ズームインしないで", null], ["ズームイン、ズームアウト", null],
        ["現在地に戻らない", null], ["", null]
    ]) assert(resolveVoiceMapCommand(text) === expected, `command mismatch: ${text}`);

    for (const overrides of [
        { navigatorObject: { userAgent: "iPad" } },
        { navigatorObject: { userAgent: "Windows" } },
        { Recognition: null }, { secureContext: false }
    ]) {
        const unsupported = new VoiceMapController({ ...options, ...overrides });
        assert(!unsupported.attach(document.body) && !unsupported.element.isConnected,
            "unsupported platform exposed the voice control");
    }
    assert(sessions.length === 0, "construction requested microphone access");

    const eventBus = new EventBus();
    const mapView = new MapView(Config, eventBus);
    mapView.element.style.cssText = "position:fixed;inset:0";
    document.body.append(mapView.element);
    const canvas = mapView.element.querySelector(".map-canvas");
    canvas.style.cssText = "height:100%;width:100%";
    // A real Leaflet map and GPX-like overlay, with no network tile layer.
    mapView.map = L.map(canvas, { zoomAnimation: false }).setView([34, 134], 13);
    const originalMap = mapView.map;
    const overlay = L.polyline([[34, 134], [34.1, 134.1]]).addTo(originalMap);
    const service = {
        watches: 0, tracking: false,
        isSupported: () => true,
        isTracking() { return this.tracking; },
        start(success) { this.watches++; this.tracking = true; this.success = success; },
        stop() { this.tracking = false; return true; }
    };
    const currentPosition = new CurrentPositionController({
        mapView, eventBus, service, windowObject, portraitMedia: { matches: false }
    });
    currentPosition.attach(mapView.element);
    let confirmations = 0;
    let consent = false;
    const control = new VoiceMapController({
        ...options,
        zoomIn: () => mapView.map.zoomIn(),
        zoomOut: () => mapView.map.zoomOut(),
        returnToPosition: () => currentPosition.returnToCurrentPosition(),
        confirmUse: () => { confirmations++; return consent; }
    });
    assert(control.attach(mapView.element), "Android control did not attach");
    assert(!control.attach(mapView.element), "duplicate attach added listeners");
    assert(sessions.length === 0 && service.watches === 0, "startup accessed microphone/GPS");
    const rect = control.button.getBoundingClientRect();
    const currentRect = currentPosition.button.getBoundingClientRect();
    const footprint = () => JSON.stringify([
        ...[control.button, currentPosition.button].map(element => {
            const r = element.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
        })
    ]);
    const before = footprint();
    assert(rect.width === 48 && rect.height === 48 && rect.right <= innerWidth &&
        rect.bottom <= innerHeight - 39 && rect.left >= 0,
    "voice control escaped viewport or lost its touch target");
    assert(currentRect.left >= rect.right + 7 && currentRect.top === rect.top,
        "voice control overlapped or displaced Current Location");
    assert(control.button.contains(document.elementFromPoint(
        rect.x + rect.width / 2, rect.y + rect.height / 2
    )), "voice button hit target is covered");

    click(control);
    assert(sessions.length === 0 && confirmations === 1, "declined disclosure started audio");
    consent = true;
    click(control);
    const first = sessions.at(-1);
    assert(first.starts === 1 && first.lang === "ja-JP" && !first.continuous &&
        !first.interimResults, "Japanese one-shot recognition is misconfigured");
    assert(control.button.getAttribute("aria-pressed") === "true" &&
        footprint() === before, "listening changed control geometry/state");
    first.result("ズームイン", false);
    assert(originalMap.getZoom() === 13, "interim recognition executed a command");
    first.result("ズームイン");
    assert(originalMap.getZoom() === 14 && first.aborts === 1 &&
        control.button.getAttribute("aria-pressed") === "false",
    "final zoom-in did not execute once and stop capture");
    first.result("ズームイン");
    assert(originalMap.getZoom() === 14, "duplicate result executed twice");
    click(control);
    const second = sessions.at(-1);
    first.result("ズームアウト");
    assert(control.recognition === second && originalMap.getZoom() === 14,
        "stale result altered a new listening session");
    second.result("ズームアウト");
    assert(originalMap.getZoom() === 13, "zoom-out did not use Leaflet");
    assert(confirmations === 2, "disclosure was repeated after consent");

    click(control);
    sessions.at(-1).result("現在地に戻る");
    assert(service.watches === 1 && currentPosition.isFollowing(),
        "voice Current Location did not use the existing GPS controller");
    service.success({ coords: { latitude: 35, longitude: 135, accuracy: 8 } });
    assert(Math.abs(originalMap.getCenter().lat - 35) < 0.001 &&
        originalMap.getZoom() === 13, "GPS return changed zoom or did not center");
    originalMap.setView([34, 134], 13);
    click(control);
    sessions.at(-1).result("現在地に戻る");
    assert(Math.abs(originalMap.getCenter().lat - 35) < 0.001 && service.watches === 1,
        "repeat Current Location did not recenter or duplicated GPS watch");
    eventBus.emit("map:user-drag-started");
    click(control);
    sessions.at(-1).result("現在地に戻る");
    assert(currentPosition.isFollowing() && service.watches === 1,
        "voice did not restore follow after dragging");

    for (const text of ["削除", "ズームインしないで", "白黒にして"]) {
        click(control);
        sessions.at(-1).result(text);
        assert(originalMap.getZoom() === 13 && !control.recognition,
            "unrecognized/out-of-scope command changed the map");
    }
    for (const error of ["not-allowed", "audio-capture", "network", "no-speech"]) {
        click(control);
        sessions.at(-1).onerror({ error });
        assert(!control.recognition && control.status.textContent &&
            originalMap.getZoom() === 13, `unsafe error path: ${error}`);
    }
    click(control);
    const cancelled = sessions.at(-1);
    click(control);
    cancelled.result("ズームイン");
    assert(cancelled.aborts === 1 && originalMap.getZoom() === 13 &&
        !control.status.textContent, "cancel executed late speech");
    click(control);
    windowObject.dispatchEvent(new Event("pagehide"));
    assert(!control.recognition, "pagehide left microphone active");
    click(control);
    sessions.at(-1).onend();
    assert(!control.recognition && control.status.textContent,
        "recognition end without a result left the microphone active");
    const originalTimeout = globalThis.setTimeout;
    let expiry;
    try {
        globalThis.setTimeout = (callback, delay) => {
            assert(delay === 15000, "voice session has no bounded listening timeout");
            expiry = callback;
            return 0;
        };
        click(control);
    } finally { globalThis.setTimeout = originalTimeout; }
    const timedOut = sessions.at(-1);
    expiry();
    timedOut.result("ズームイン");
    assert(!control.recognition && timedOut.aborts === 1 && originalMap.getZoom() === 13,
        "timeout allowed a late command or left microphone active");
    click(control);
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    try {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        assert(!control.recognition, "hidden page left microphone active");
    } finally {
        if (visibilityDescriptor) Object.defineProperty(document, "visibilityState", visibilityDescriptor);
        else delete document.visibilityState;
    }
    assert(footprint() === before && originalMap.hasLayer(overlay) && mapView.map === originalMap,
        "voice operation changed layout/map identity/GPX overlay");
    click(control);
    const detached = sessions.at(-1);
    control.detach();
    detached.result("ズームイン");
    const count = sessions.length;
    click(control);
    assert(sessions.length === count && !control.element.isConnected && detached.aborts === 1,
        "detach retained listening or a click listener");
    control.attach(mapView.element);
    click(control);
    assert(sessions.length === count + 1, "reattach duplicated recognition sessions");
    control.detach();
    const throwing = new VoiceMapController({
        ...options, Recognition: class { start() { throw new Error("denied"); } abort() {} }
    });
    throwing.attach(mapView.element);
    click(throwing);
    assert(!throwing.recognition && throwing.status.textContent.includes("開始できません"),
        "synchronous speech start failure was not recoverable");
    throwing.detach();
    currentPosition.stop();
    originalMap.remove();
    mapView.element.remove();
    document.getElementById("result").textContent = `PASS: ${assertions} assertions`;
}

try { await run(); } catch (error) {
    document.getElementById("result").textContent = `FAIL after ${assertions}: ${error.stack}`;
    throw error;
}
