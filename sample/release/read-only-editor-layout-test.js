import Config from "../../src/js/core/Config.js";
import EventBus from "../../src/js/core/EventBus.js";
import MapView from "../../src/js/ui/MapView.js";
import TrackEditingPanel from "../../src/js/ui/TrackEditingPanel.js";

const output = document.getElementById("result");
const fixture = document.getElementById("fixture");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return !element.hidden && style.display !== "none" &&
        style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function assertReachable(element, name) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);

    assert(isVisible(element), `${name} is not visible`);
    assert(rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth &&
        rect.bottom <= innerHeight,
    `${name} is clipped outside the viewport`);
    assert(hit === element || element.contains(hit),
        `${name} is covered by ${hit?.className || hit?.tagName || "nothing"}`);
}

try {
    assert([390, 820, 844, 1180, 1280].includes(innerWidth),
        `unexpected test viewport ${innerWidth}x${innerHeight}`);
    const eventBus = new EventBus();
    const mapView = new MapView(Config, eventBus);
    const panel = new TrackEditingPanel();
    let baseMapEvents = 0;
    let mapModeEvents = 0;

    eventBus.on("map:base-map-changed", () => { baseMapEvents += 1; });
    eventBus.on("map:display-mode-changed", () => { mapModeEvents += 1; });
    fixture.append(mapView.element);
    panel.attach(mapView.element);

    assert(panel.element.hidden,
        "Editor was visible before a writable Library was selected");
    panel.setSourceWritable(false);
    assert(panel.element.hidden && panel.element.getClientRects().length === 0,
        "read-only Editor retained a layout or pointer footprint");

    const mobileControls = mapView.element.querySelector(".mobile-map-controls");
    const mobile = getComputedStyle(mobileControls).display !== "none";
    const baseMapControl = mobile
        ? mobileControls.querySelector(".mobile-base-map-toggle")
        : mapView.element.querySelector(".base-map-select");
    const mapModeControl = mobile
        ? mobileControls.querySelector(".mobile-map-mode-toggle")
        : mapView.element.querySelector(".map-mode-select");

    assertReachable(baseMapControl, "basemap control");
    assertReachable(mapModeControl, "monochrome control");
    if (mobile) {
        assert(baseMapControl.getBoundingClientRect().height >= 44 &&
            mapModeControl.getBoundingClientRect().height >= 44,
        "mobile map controls lost their touch target size");
        baseMapControl.click();
        mapModeControl.click();
    } else {
        baseMapControl.value = "gsiStandard";
        baseMapControl.dispatchEvent(new Event("change", { bubbles: true }));
        mapModeControl.value = "monochrome";
        mapModeControl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    assert(baseMapEvents === 1 && mapModeEvents === 1,
        "map control handlers did not receive direct interaction");

    panel.setSourceWritable(true);
    assert(!panel.element.hidden,
        "writable Library did not restore the Track Editor");
    panel.setSourceWritable(false);
    assert(panel.element.hidden && panel.element.getClientRects().length === 0,
        "writable to read-only switch left a stale Editor panel");

    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
}
