import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import TrackFocusCoordinator from "../../src/js/core/TrackFocusCoordinator.js";
import LayerManager from "../../src/js/map/LayerManager.js";
import DisplayState from "../../src/js/state/DisplayState.js";
import SelectionState from "../../src/js/state/SelectionState.js";
import MapView from "../../src/js/ui/MapView.js";
import TrackInfoView from "../../src/js/ui/TrackInfoView.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function installLeafletFake() {
    const polylines = [];
    globalThis.L = {
        layerGroup() {
            const layers = [];
            return {
                addTo() { return this; },
                remove() {},
                eachLayer(callback) { layers.forEach(callback); },
                add(layer) { layers.push(layer); }
            };
        },
        polyline(points, options) {
            const layer = {
                points,
                options: { ...options },
                addTo(group) { group.add(this); return this; },
                on() {},
                setStyle(style) { Object.assign(this.options, style); },
                bringToFront() {}
            };
            polylines.push(layer);
            return layer;
        }
    };
    return polylines;
}

function gpx() {
    return {
        tracks: [{ segments: [{ points: [
            { latitude: 35, longitude: 135 },
            { latitude: 35.1, longitude: 135.1 }
        ] }] }],
        waypoints: []
    };
}

function run() {
    const polylines = installLeafletFake();
    const eventBus = new EventBus();
    const mapView = new MapView(Config, eventBus);
    const infoView = new TrackInfoView();
    const displayState = new DisplayState();
    const selectionState = new SelectionState();
    mapView.layerManager = new LayerManager({}, Config.map);
    document.body.append(mapView.sidebarDisplayControls, infoView.element);
    const coordinator = new TrackFocusCoordinator({
        eventBus, mapView, selectionState, displayState, view: infoView
    });
    const mobileButton = mapView.sidebarDisplayControls.querySelector(
        ".mobile-track-focus");
    const desktopButton = infoView.focusButton;
    const normal = { color: "#123456", weight: 3, opacity: 0.6 };
    const selected = { color: "#123456", weight: 6, opacity: 1 };
    const outline = { color: "#ffffff", weight: 8, opacity: 1 };
    const first = "folder/first.gpx";
    const second = "folder/second.gpx";
    let publications = 0;
    displayState.subscribe(() => publications++);

    assert(mobileButton.hidden, "mobile focus shown without selection");
    assert(getComputedStyle(mobileButton).display === "none",
        "hidden focus control occupies mobile layout space");
    assert(desktopButton.disabled, "desktop focus enabled without selection");
    for (const path of [first, second]) {
        displayState.registerFile(path, {}, normal.color);
        displayState.setChecked(path, true);
        mapView.displayGPX(path, gpx(), normal);
        displayState.setLoaded(path, gpx());
    }
    selectionState.select(first);
    mapView.setSelectedPath(first, selected, outline);
    eventBus.emit("selection:changed", { path: first });
    infoView.showEntry({ status: "ready", displayName: "first" });
    assert(!mobileButton.hidden, "mobile focus unavailable for displayed Track");
    if (matchMedia("(max-width: 768px)").matches) {
        assert(getComputedStyle(mobileButton).display !== "none",
            "mobile focus control is not visible when available");
    }
    assert(!desktopButton.disabled, "desktop focus unavailable for displayed Track");
    const beforeFocus = publications;
    const beforeLayers = polylines.length;
    const beforeState = JSON.stringify([...displayState.getDisplays()]);
    desktopButton.click();
    assert(mapView.getFocusedPath() === first, "desktop focus did not activate");
    assert(mobileButton.getAttribute("aria-pressed") === "true",
        "mobile focus state not synchronized");
    assert(desktopButton.getAttribute("aria-pressed") === "true",
        "desktop focus state not synchronized");
    assert(mapView.layerManager.layers.get(first).segments[0]
        .mainLayer.options.opacity === 1, "selected Track dimmed");
    assert(mapView.layerManager.layers.get(second).segments[0]
        .mainLayer.options.opacity === 0.1, "other Track not dimmed");
    assert(publications === beforeFocus, "focus mutated DisplayState");
    assert(JSON.stringify([...displayState.getDisplays()]) === beforeState,
        "focus changed checked/loaded state");
    assert(polylines.length === beforeLayers, "focus reloaded geometry");

    mapView.updateTrackColor(second, {
        normalStyle: { color: "#abcdef", weight: 3, opacity: 0.6 }
    });
    assert(mapView.layerManager.layers.get(second).segments[0]
        .mainLayer.options.opacity === 0.1, "color update removed dimming");
    const third = "folder/third.gpx";
    displayState.registerFile(third, {}, normal.color);
    displayState.setChecked(third, true);
    mapView.displayGPX(third, gpx(), normal);
    displayState.setLoaded(third, gpx());
    assert(mapView.layerManager.layers.get(third).segments[0]
        .mainLayer.options.opacity === 0.1, "new Track escaped focus");
    mobileButton.click();
    assert(mapView.getFocusedPath() === null, "mobile focus toggle did not end");
    assert(mapView.layerManager.layers.get(second).segments[0]
        .mainLayer.options.opacity === 0.6, "normal opacity not restored");
    assert(mobileButton.getAttribute("aria-pressed") === "false",
        "mobile focus button stayed pressed");

    desktopButton.click();
    selectionState.select(second);
    eventBus.emit("selection:changed", { path: second });
    assert(mapView.getFocusedPath() === null,
        "selection change did not clear focus");
    mapView.setSelectedPath(second, selected, outline);
    desktopButton.click();
    assert(mapView.getFocusedPath() === second,
        "new selection could not be focused");
    mapView.removeGPX(second);
    assert(mapView.getFocusedPath() === null,
        "removing focused Track did not clear focus");
    assert(mobileButton.hidden, "focus remained available after removal");

    selectionState.select(first);
    eventBus.emit("selection:changed", { path: first });
    desktopButton.click();
    assert(mapView.getFocusedPath() === first, "focus could not restart");
    eventBus.emit("library:source-changed", {});
    assert(mapView.getFocusedPath() === null, "Library change retained focus");
    assert(displayState.getDisplay(first)?.checked,
        "Library focus clear changed Track visibility");

    const many = new LayerManager({}, Config.map);
    for (let index = 0; index < 1123; index++) {
        many.displayGPX(`many/${index}.gpx`, gpx(), normal);
    }
    const manyLayerCount = polylines.length;
    assert(many.setFocusedPath("many/0.gpx"), "large fixture focus failed");
    assert(many.layers.get("many/1122.gpx").segments[0]
        .mainLayer.options.opacity === 0.1, "large fixture not dimmed");
    assert(many.setFocusedPath(null), "large fixture reset failed");
    assert(many.layers.get("many/1122.gpx").segments[0]
        .mainLayer.options.opacity === 0.6, "large fixture not restored");
    assert(polylines.length === manyLayerCount,
        "large fixture focus created geometry layers");
    assert(coordinator.refresh() === undefined, "refresh unexpectedly mutated");
}

try {
    run();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.stack || error}`;
}
