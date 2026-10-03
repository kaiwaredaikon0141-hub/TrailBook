import createTrackBlendRenderer from "../../src/js/map/TrackBlendRenderer.js";
import LayerManager from "../../src/js/map/LayerManager.js";
import DisplaySettingsStore from "../../src/js/services/DisplaySettingsStore.js";
import TrackBlendModeControl from "../../src/js/ui/TrackBlendModeControl.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(resolve)));
}

function gpx() {
    return {
        tracks: [{ segments: [{ points: [
            { latitude: 0, longitude: -5 },
            { latitude: 0, longitude: 5 }
        ] }] }],
        waypoints: []
    };
}

async function run() {
    const map = L.map("map", { zoomControl: false, attributionControl: false })
        .setView([0, 0], 4);
    const trackRenderer = createTrackBlendRenderer(L, 6);
    const manager = new LayerManager(map, { trackStyle: {} }, {
        trackRenderer
    });
    const red = { color: "#ff0000", weight: 8, opacity: 0.55 };
    const blue = { color: "#0000ff", weight: 8, opacity: 0.55 };
    const pixel = () => {
        const canvas = trackRenderer._container;
        const x = Math.floor(canvas.width / 2);
        const y = Math.floor(canvas.height / 2);
        return [...canvas.getContext("2d").getImageData(x, y, 1, 1).data];
    };

    manager.displayGPX("red.gpx", gpx(), red);
    manager.displayGPX("blue.gpx", gpx(), blue);
    await nextPaint();
    const redThenBlue = pixel();
    assert(manager.layers.get("red.gpx").segments[0]
        .mainLayer.options.trackBlend === true,
    "Track main stroke does not opt into color blending");
    assert(redThenBlue[0] > 150 && redThenBlue[2] > 150 &&
        redThenBlue[1] < 40, `red/blue did not blend to purple: ${redThenBlue}`);

    manager.removeGPX("red.gpx");
    manager.removeGPX("blue.gpx");
    manager.displayGPX("blue.gpx", gpx(), blue);
    manager.displayGPX("red.gpx", gpx(), red);
    await nextPaint();
    const blueThenRed = pixel();
    assert(Math.abs(redThenBlue[0] - blueThenRed[0]) <= 2 &&
        Math.abs(redThenBlue[2] - blueThenRed[2]) <= 2,
    `Track color depends on display order: ${redThenBlue} / ${blueThenRed}`);

    const values = new Map();
    let writes = 0;
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem(key, value) { values.set(key, value); writes += 1; }
    };
    const settingsStore = new DisplaySettingsStore({ storage });
    const controls = new TrackBlendModeControl({
        element: document.getElementById("blend-controls"),
        sidebarDisplayControls: document.getElementById("sidebar-controls"),
        trackRenderer
    }, settingsStore);
    controls.attach();
    const [desktopSelect, mobileSelect] = controls.selects;
    assert(desktopSelect.value === "screen" && mobileSelect.value === "screen",
        "light blending is not the default on both layouts");
    const center = map.getCenter();
    const zoom = map.getZoom();
    const redLayer = manager.layers.get("red.gpx").segments[0].mainLayer;
    desktopSelect.value = "multiply";
    desktopSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextPaint();
    const darkPixel = pixel();
    assert(trackRenderer.getBlendMode() === "multiply" &&
        mobileSelect.value === "multiply",
    "dark blend choice did not sync desktop and mobile controls");
    assert(new DisplaySettingsStore({ storage }).getTrackBlendMode() ===
        "multiply" && writes === 1,
    "dark blend preference was not saved device-locally");
    assert(darkPixel[0] < blueThenRed[0] &&
        darkPixel[2] < blueThenRed[2] && darkPixel[3] > 0,
    `multiply did not darken overlapping Tracks: ${darkPixel}`);
    assert(map.getCenter().equals(center) && map.getZoom() === zoom &&
        manager.layers.get("red.gpx").segments[0].mainLayer === redLayer,
    "blend mode changed map view or reloaded Track geometry");
    manager.removeGPX("red.gpx");
    manager.removeGPX("blue.gpx");
    manager.displayGPX("red.gpx", gpx(), red);
    manager.displayGPX("blue.gpx", gpx(), blue);
    await nextPaint();
    const darkReversePixel = pixel();
    assert(Math.abs(darkPixel[0] - darkReversePixel[0]) <= 2 &&
        Math.abs(darkPixel[2] - darkReversePixel[2]) <= 2,
    `dark Track blend depends on display order: ${darkReversePixel}`);
    manager.setSelectedPath("red.gpx", { ...red, weight: 10, opacity: 1 },
        { color: "#ffffff", weight: 12, opacity: 1 });
    await nextPaint();
    assert(pixel()[0] > 200 && pixel()[2] < 50,
        "dark mode obscured the selected Track over its outline");
    manager.clearSelectionHighlight();
    mobileSelect.value = "screen";
    mobileSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextPaint();
    assert(desktopSelect.value === "screen" &&
        Math.abs(pixel()[0] - blueThenRed[0]) <= 2,
    "mobile choice did not restore light blending");
    assert(new DisplaySettingsStore({ storage }).getTrackBlendMode() ===
        "screen" && writes === 2,
    "mobile blend preference was not saved");
    if (matchMedia("(max-width: 768px), (max-height: 500px) and " +
        "(pointer: coarse)").matches) {
        assert(mobileSelect.getBoundingClientRect().height >= 44,
            "mobile blend option is too small to tap");
    }

    manager.setSelectedPath("red.gpx", { ...red, weight: 10, opacity: 1 },
        { color: "#ffffff", weight: 12, opacity: 1 });
    assert(manager.layers.get("red.gpx").segments[0]
        .mainLayer.options.trackBlend === false,
    "selected Track still blends over its white outline");
    const outline = manager.layers.get("red.gpx").outlineLayerGroup
        .getLayers()[0];
    assert(!outline.options.trackBlend,
        "selection outline unexpectedly blends with Track colors");
    await nextPaint();
    const selectedPixel = pixel();
    assert(selectedPixel[0] > 200 && selectedPixel[2] < 50,
        `selected Track color disappeared over outline: ${selectedPixel}`);
    manager.clearSelectionHighlight();
    assert(manager.layers.get("red.gpx").segments[0]
        .mainLayer.options.trackBlend === true,
    "normal Track blending not restored after deselection");
    await nextPaint();
    const restoredPixel = pixel();
    assert(Math.abs(restoredPixel[0] - blueThenRed[0]) <= 2 &&
        Math.abs(restoredPixel[2] - blueThenRed[2]) <= 2,
    `deselection did not restore blended colors: ${restoredPixel}`);
    manager.removeGPX("blue.gpx");
    await nextPaint();
    const singleLightPixel = pixel();
    trackRenderer.setBlendMode("multiply");
    await nextPaint();
    const singleDarkPixel = pixel();
    assert(Math.abs(singleLightPixel[0] - singleDarkPixel[0]) <= 2 &&
        Math.abs(singleLightPixel[3] - singleDarkPixel[3]) <= 2,
    "dark blend changed a single Track color");

    manager.clear();
    await nextPaint();
    assert(pixel()[3] === 0, "cleared Track canvas is not transparent");
    map.remove();
}

try {
    await run();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.stack || error}`;
}
