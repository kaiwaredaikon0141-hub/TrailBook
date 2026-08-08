import Config from "../../src/js/core/Config.js";
import TrackStyleService from "../../src/js/services/TrackStyleService.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function run() {
    const service = new TrackStyleService(Config.map.trackStyle);
    const color = "#3366CC";

    for (const [zoomLevel, weight] of [[8, 1.5], [9, 2], [12, 3], [15, 4]]) {
        const style = service.getNormalStyle({ color, zoomLevel });
        assert(style.color === color, `normal color changed at zoom ${zoomLevel}`);
        assert(style.weight === weight, `normal weight changed at zoom ${zoomLevel}`);
        assert(style.opacity === 0.55, `normal opacity changed at zoom ${zoomLevel}`);
    }

    const selected = service.getSelectedMainStyle({ color, zoomLevel: 12 });
    assert(selected.color === color, "selected color changed");
    assert(selected.weight === 6, "selected weight changed");
    assert(selected.opacity === 1, "selected opacity is not opaque");

    const outline = service.getSelectedOutlineStyle({ color, zoomLevel: 12 });
    assert(outline.weight === 8, "outline weight changed");
    assert(outline.opacity === 0.95, "outline opacity changed");
    assert(outline.interactive === false, "outline became interactive");

    const fallback = new TrackStyleService({}).getNormalStyle({
        color,
        zoomLevel: 8
    });
    assert(fallback.opacity === 0.55, "normal fallback opacity is inconsistent");

    output.textContent = `Pass: ${assertions} assertions`;
}

try {
    run();
} catch (error) {
    output.textContent = `Fail after ${assertions} assertions: ${error.message}`;
    throw error;
}
