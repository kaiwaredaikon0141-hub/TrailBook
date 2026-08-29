import Config from "../../src/js/core/Config.js";
import CurrentPositionController from
    "../../src/js/core/CurrentPositionController.js";
import EventBus from "../../src/js/core/EventBus.js";
import CurrentPositionService, {
    GEOLOCATION_OPTIONS
} from "../../src/js/services/CurrentPositionService.js";
import MapView from "../../src/js/ui/MapView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

class GeolocationMock {
    constructor() {
        this.watchCalls = [];
        this.clearCalls = [];
        this.nextId = 7;
    }
    watchPosition(success, error, options) {
        this.watchCalls.push({ success, error, options });
        return this.nextId++;
    }
    clearWatch(id) { this.clearCalls.push(id); }
}

function createLayer(type, layers) {
    return {
        type,
        latLng: null,
        radius: null,
        addTo(map) { this.map = map; layers.push(this); return this; },
        setLatLng(value) { this.latLng = value; return this; },
        setRadius(value) { this.radius = value; return this; },
        remove() { this.removed = true; }
    };
}

function createMapView(eventBus) {
    const layers = [];
    const setViews = [];
    const mapView = new MapView(Config, eventBus);

    globalThis.L = {
        circleMarker(latLng, options) {
            const layer = createLayer("marker", layers);
            layer.latLng = latLng;
            layer.options = options;
            return layer;
        },
        circle(latLng, options) {
            const layer = createLayer("accuracy", layers);
            layer.latLng = latLng;
            layer.radius = options.radius;
            layer.options = options;
            return layer;
        }
    };
    mapView.map = {
        getZoom: () => 13,
        setView(center, zoom, options) { setViews.push({ center, zoom, options }); },
        project: ([latitude, longitude]) => ({ x: longitude * 100, y: latitude * 100 }),
        unproject: ([x, y]) => ({ lat: y / 100, lng: x / 100 }),
        getSize: () => ({ x: 400, y: 800 })
    };
    return { mapView, layers, setViews };
}

function createController({ portrait = true } = {}) {
    const geolocation = new GeolocationMock();
    const service = new CurrentPositionService(geolocation);
    const eventBus = new EventBus();
    const map = createMapView(eventBus);
    const windowListeners = new Map();
    const controller = new CurrentPositionController({
        mapView: map.mapView,
        eventBus,
        service,
        portraitMedia: { matches: portrait },
        windowObject: {
            addEventListener(name, handler) { windowListeners.set(name, handler); }
        }
    });
    controller.attach(document.body);
    return { controller, geolocation, service, eventBus, windowListeners, ...map };
}

async function run() {
    const fixture = createController();

    assert(fixture.controller.button.querySelector("svg") &&
        fixture.controller.button.title &&
        fixture.controller.button.getAttribute("aria-label"),
    "GPS control is not a labelled platform-independent icon");
    fixture.controller.button.click();
    assert(fixture.geolocation.watchCalls.length === 1,
        "watchPosition did not start");
    assert(fixture.controller.isFollowing(), "tracking did not start with follow ON");
    assert(JSON.stringify(fixture.geolocation.watchCalls[0].options) ===
        JSON.stringify(GEOLOCATION_OPTIONS), "Geolocation options changed");
    fixture.service.start(() => {}, () => {});
    assert(fixture.geolocation.watchCalls.length === 1, "duplicate watch started");

    fixture.geolocation.watchCalls[0].success({
        coords: { latitude: 35, longitude: 135, accuracy: 8.4 }
    });
    assert(fixture.layers.length === 2 &&
        fixture.layers.filter(layer => layer.type === "marker").length === 1,
    "first position did not create one marker and accuracy circle");
    assert(fixture.setViews.length === 1 && fixture.setViews[0].zoom === 13,
        "first follow changed zoom or did not move");
    assert(fixture.controller.status.textContent.includes("±8 m"),
        "accuracy text missing");
    assert(fixture.layers.every(layer => layer.options.interactive === false),
        "GPS layers intercept Map interaction");

    const marker = fixture.mapView.currentPositionMarker;
    const circle = fixture.mapView.currentPositionAccuracy;
    fixture.geolocation.watchCalls[0].success({
        coords: { latitude: 35.1, longitude: 135.1, accuracy: 12 }
    });
    assert(fixture.mapView.currentPositionMarker === marker &&
        fixture.mapView.currentPositionAccuracy === circle &&
        fixture.layers.length === 2,
    "subsequent position recreated GPS layers");
    assert(circle.radius === 12, "accuracy radius was not updated");

    fixture.controller.button.click();
    assert(!fixture.controller.isFollowing(), "follow did not turn OFF");
    const viewCount = fixture.setViews.length;
    fixture.geolocation.watchCalls[0].success({
        coords: { latitude: 35.2, longitude: 135.2, accuracy: 6 }
    });
    assert(fixture.setViews.length === viewCount && marker.latLng[0] === 35.2,
        "follow OFF stopped marker update or moved Map");
    fixture.controller.button.click();
    assert(fixture.controller.isFollowing() &&
        fixture.setViews.length === viewCount + 1,
    "button did not restore follow immediately");

    fixture.eventBus.emit("map:user-drag-started");
    assert(!fixture.controller.isFollowing(), "manual drag did not disable follow");
    fixture.controller.button.click();
    fixture.eventBus.emit("map:zoom-ended", { zoom: 14 });
    assert(fixture.controller.isFollowing(), "zoom disabled follow");

    const baseLayer = { id: "base" };
    fixture.mapView.baseTileLayer = baseLayer;
    fixture.mapView.setCurrentPosition({
        latitude: 36,
        longitude: 136,
        accuracy: 5
    });
    assert(fixture.mapView.baseTileLayer === baseLayer,
        "GPS update replaced Base Map");

    fixture.eventBus.emit("view-state:sidebar-layout-changed");
    assert(fixture.controller.isTracking(), "Sidebar change stopped GPS watch");

    const permission = createController();
    permission.controller.button.click();
    permission.geolocation.watchCalls[0].error({ code: 1 });
    assert(permission.controller.status.textContent.includes("許可") &&
        !permission.controller.isTracking() &&
        permission.geolocation.clearCalls.length === 1,
    "permission denied handling failed");

    const unavailable = createController();
    unavailable.controller.button.click();
    unavailable.geolocation.watchCalls[0].error({ code: 2 });
    assert(unavailable.controller.status.textContent.includes("取得できません"),
        "position unavailable message missing");
    unavailable.geolocation.watchCalls[0].error({ code: 3 });
    assert(unavailable.controller.status.textContent.includes("タイムアウト"),
        "timeout message missing");

    const unsupported = new CurrentPositionController({
        mapView: fixture.mapView,
        eventBus: new EventBus(),
        service: new CurrentPositionService(null),
        windowObject: { addEventListener() {} },
        portraitMedia: { matches: false }
    });
    assert(unsupported.button.disabled &&
        unsupported.status.textContent.includes("利用できません"),
    "unsupported Geolocation stopped normal Viewer fallback");

    fixture.windowListeners.get("pagehide")();
    assert(fixture.geolocation.clearCalls.at(-1) === 7 &&
        !fixture.controller.isTracking(), "cleanup did not clear watch");

    const controllerSource = await fetch(
        "../../src/js/core/CurrentPositionController.js"
    ).then(response => response.text());
    assert(!/localStorage|indexedDB|trailbook\.json|GPXParser/.test(controllerSource),
        "GPS controller persists location or reparses Track geometry");

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    await run();
} catch (error) {
    output.textContent = `FAIL: ${error.stack || error}`;
    throw error;
}
