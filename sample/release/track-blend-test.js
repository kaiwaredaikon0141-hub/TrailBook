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

function readPresentation(renderer) {
    const source = renderer._container;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d");
    // Read the presented surface, including the browser's actual CSS filter.
    context.filter = getComputedStyle(source).filter;
    context.drawImage(source, 0, 0);
    return context;
}

async function testDarkRendering(map, renderer, manager) {
    // Independent reference: the original per-stroke multiply implementation.
    const ReferenceCanvas = L.Canvas.extend({
        _fillStroke(context, layer) {
            context.save();
            context.globalCompositeOperation = layer.options.trackBlend
                ? "multiply" : "source-over";
            L.Canvas.prototype._fillStroke.call(this, context, layer);
            context.restore();
        }
    });
    const reference = new ReferenceCanvas({ tolerance: 6 }).addTo(map);
    reference._container.style.visibility = "hidden";
    const referenceLayers = [];
    const styles = [
        { color: "#f30090", weight: 9, opacity: 0.55 },
        { color: "hsl(210, 60%, 50%)", weight: 6, opacity: 0.7 },
        { color: "rgba(20, 150, 60, 0.4)", weight: 4, opacity: 0.6,
            dashArray: "5, 3" },
        { color: "#abc", weight: 2, opacity: 0.2 }
    ];
    const geometry = gpx();
    const original = JSON.stringify({ geometry, styles });
    let strokes = 0;
    let multiplies = 0;
    const stroke = renderer._ctx.stroke;
    renderer._ctx.stroke = function (...args) {
        strokes += 1;
        if (this.globalCompositeOperation === "multiply") multiplies += 1;
        return stroke.apply(this, args);
    };
    try {
        renderer.setBlendMode("multiply");
        styles.forEach((style, index) => {
            manager.displayGPX(`reference-${index}.gpx`, geometry, style);
            referenceLayers.push(L.polyline([[0, -5], [0, 5]], {
                ...style, renderer: reference, trackBlend: true
            }).addTo(map));
        });
        const compare = async label => {
            await nextPaint();
            const canvas = renderer._container;
            const actual = readPresentation(renderer).getImageData(
                0, 0, canvas.width, canvas.height).data;
            const expected = readPresentation(reference).getImageData(
                0, 0, canvas.width, canvas.height).data;
            let colorDelta = 0;
            let alphaDelta = 0;
            let mismatch = "";
            for (let index = 0; index < actual.length; index += 4) {
                if (Math.abs(actual[index + 3] - expected[index + 3]) > 1 &&
                    !mismatch) mismatch = `${index / 4}: ` +
                    `${actual.slice(index, index + 4)} / ${expected.slice(index, index + 4)}`;
                alphaDelta = Math.max(alphaDelta,
                    Math.abs(actual[index + 3] - expected[index + 3]));
                for (let channel = 0; channel < 3; channel += 1) {
                    // Compare visible contribution, not undefined transparent RGB.
                    colorDelta = Math.max(colorDelta, Math.abs(
                        actual[index + channel] * actual[index + 3] / 255 -
                        expected[index + channel] * expected[index + 3] / 255));
                }
            }
            assert(colorDelta <= 3 && alphaDelta <= 1,
                `${label}: optimized dark rendering differs from multiply ` +
                `(color=${colorDelta}, alpha=${alphaDelta}, ${mismatch})`);
        };
        await compare("mixed colors/alpha/dashes");
        assert(strokes >= styles.length && multiplies === 0,
            "dark Track redraw still performs expensive per-stroke multiply");
        assert(getComputedStyle(renderer._container).filter === "invert(1)" &&
            getComputedStyle(map.getPane("tilePane")).filter === "none",
        "dark presentation filter is missing or changes the basemap");
        assert(JSON.stringify({ geometry, styles }) === original,
            "dark rendering mutated GPX geometry or model styles");

        const main = manager.layers.get("reference-1.gpx").segments[0].mainLayer;
        const coordinates = main.getLatLngs();
        main.setStyle({ color: "#00aa88", weight: 10, opacity: 0.35 });
        referenceLayers[1].setStyle({ color: "#00aa88", weight: 10, opacity: 0.35 });
        await compare("color/weight/opacity update");
        assert(main.options.color === "#00aa88" &&
            main.getLatLngs() === coordinates,
        "renderer replaced source color or coordinates during style update");

        // A non-blending selection/outline must retain its true displayed color.
        const outline = L.polyline([[0, -5], [0, 5]], {
            color: "white", weight: 12, opacity: 1, renderer,
            trackBlend: false
        }).addTo(map);
        const referenceOutline = L.polyline([[0, -5], [0, 5]], {
            color: "white", weight: 12, opacity: 1, renderer: reference,
            trackBlend: false
        }).addTo(map);
        await compare("non-blending white outline");
        outline.remove();
        referenceOutline.remove();
        map.panBy([20, 5], { animate: false });
        await compare("pan");
        map.setZoom(5, { animate: false });
        await compare("zoom");
        manager.removeGPX("reference-0.gpx");
        referenceLayers[0].remove();
        await compare("partial redraw after removal");

        renderer.setBlendMode("screen");
        await nextPaint();
        assert(getComputedStyle(renderer._container).filter === "none",
            "light mode kept dark presentation filter");
        renderer.setBlendMode("multiply");
        await compare("dark mode restored");
        assert(multiplies === 0,
            "pan/zoom/style/mode changes reintroduced per-stroke multiply");
    } finally {
        renderer._ctx.stroke = stroke;
        manager.clear();
        referenceLayers.forEach(layer => layer.remove());
        reference.remove();
    }
    await nextPaint();
    const pixel = readPresentation(renderer).getImageData(0, 0, 1, 1).data;
    assert(pixel[3] === 0, "dark surface did not remain transparent after clear");
}

async function testLargeDarkRedraw(renderer, manager) {
    const colors = ["#e53935", "#1e88e5", "#43a047", "#fb8c00",
        "#8e24aa", "#00897b", "#6d4c41", "#546e7a"];
    const count = 1133;
    for (let index = 0; index < count; index += 1) {
        manager.displayGPX(`load-${index}.gpx`, gpx(), {
            color: colors[index % colors.length], weight: 3, opacity: 0.55
        });
    }
    await nextPaint();
    let strokes = 0;
    let multiplies = 0;
    let colorReads = 0;
    const context = renderer._ctx;
    const originalStroke = context.stroke;
    const originalRead = CanvasRenderingContext2D.prototype.getImageData;
    context.stroke = function (...args) {
        strokes += 1;
        if (this.globalCompositeOperation === "multiply") multiplies += 1;
        return originalStroke.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        colorReads += 1;
        return originalRead.apply(this, args);
    };
    try {
        renderer._redrawBounds = null;
        renderer._redraw();
        assert(strokes === count && multiplies === 0,
            `large dark redraw: strokes=${strokes}, multiply=${multiplies}`);
        assert(colorReads === 0,
            "warm dark redraw re-read pixels instead of reusing color styles");
        assert(manager.getDisplayedPaths().length === count &&
            manager.layers.get("load-0.gpx").segments[0]
                .mainLayer.options.color === colors[0],
        "large dark redraw dropped Tracks or changed their source colors");
    } finally {
        context.stroke = originalStroke;
        CanvasRenderingContext2D.prototype.getImageData = originalRead;
        manager.clear();
    }
    await nextPaint();
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
        return [...readPresentation(trackRenderer).getImageData(x, y, 1, 1).data];
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
    await testDarkRendering(map, trackRenderer, manager);
    await testLargeDarkRedraw(trackRenderer, manager);
    map.remove();
}

try {
    await run();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.stack || error}`;
}
