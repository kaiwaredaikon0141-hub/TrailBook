import EventBus from "../../src/js/core/EventBus.js";
import Folder from "../../src/js/models/Folder.js";
import Library from "../../src/js/models/Library.js";
import TreeView from "../../src/js/ui/TreeView.js";
import TrackTreeOrder from "../../src/js/services/TrackTreeOrder.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function file(name) {
    return { kind: "file", name };
}

function entry(relativePath, { startTime = null, resolvedDate = null } = {}) {
    return { relativePath, startTime, resolvedDate };
}

function renderedPaths(tree) {
    return [...tree.element.querySelectorAll(".gpx-file")]
        .map(row => row.dataset.treePath);
}

async function run() {
    const order = new TrackTreeOrder();
    order.setEntries([
        entry("older.gpx", { startTime: new Date("2024-01-01T00:00:00Z") }),
        entry("newer.gpx", { resolvedDate: 1735689600000 }),
        entry("same-b.gpx", { resolvedDate: new Date("2023-01-01T00:00:00Z") }),
        entry("same-a.gpx", { resolvedDate: new Date("2023-01-01T00:00:00Z") })
    ]);
    assert(order.compare("newer.gpx", "older.gpx") < 0,
        "newest metadata did not sort first");
    assert(order.compare("same-a.gpx", "same-b.gpx") < 0,
        "equal timestamps did not use deterministic path order");
    assert(order.compare("same-a.gpx", "missing.gpx") < 0,
        "missing timestamp did not sort after dated Track");
    assert(order.compare("missing-a.gpx", "missing-b.gpx") < 0,
        "missing timestamps did not use deterministic path order");

    const root = new Folder("Library", { name: "Library" });
    root.gpxFiles.push(
        file("missing-b.gpx"),
        file("older.gpx"),
        file("middle.gpx"),
        file("newer.gpx"),
        file("missing-a.gpx")
    );
    const tree = new TreeView(new EventBus());
    document.body.append(tree.element);
    await tree.render(new Library("Library", root, 1, 5));
    tree.setDisplayChecked("older.gpx", true);
    tree.setDisplayLoaded("older.gpx", "#123456");
    tree.setSelectedPath("older.gpx");
    const olderRow = tree.fileNodes.get("older.gpx");

    assert(tree.setTrackOrderEntries([
        entry("older.gpx", { startTime: "2024-01-01T00:00:00Z" }),
        entry("middle.gpx", { startTime: "2024-06-01T00:00:00Z" }),
        entry("newer.gpx", { startTime: "2025-01-01T00:00:00Z" })
    ]), "metadata change did not refresh Track order");
    assert(renderedPaths(tree).join(",") ===
        "newer.gpx,middle.gpx,older.gpx,missing-a.gpx,missing-b.gpx",
    "Folder Track rows are not newest-first with stable missing fallback");
    assert(tree.fileNodes.get("older.gpx") === olderRow,
        "ordering recreated the Track row");
    assert(tree.isDisplayChecked("older.gpx") &&
        tree.selectedFilePath === "older.gpx" &&
        tree.nodeMetadata.get("older.gpx").state === "loaded",
    "ordering changed checked, selected, or display state");
    assert(!tree.setTrackOrderEntries([
        entry("older.gpx", { startTime: "2024-01-01T00:00:00Z" }),
        entry("middle.gpx", { startTime: "2024-06-01T00:00:00Z" }),
        entry("newer.gpx", { startTime: "2025-01-01T00:00:00Z" })
    ]), "unchanged metadata caused a presentation mutation");

    tree.setTrackOrderEntries([
        entry("older.gpx", { startTime: "2026-01-01T00:00:00Z" }),
        entry("middle.gpx", { startTime: "2024-06-01T00:00:00Z" }),
        entry("newer.gpx", { startTime: "2025-01-01T00:00:00Z" })
    ]);
    assert(renderedPaths(tree)[0] === "older.gpx",
        "refresh metadata did not move the new newest Track");
    assert(tree.fileNodes.get("older.gpx") === olderRow &&
        tree.isDisplayChecked("older.gpx"),
    "refresh ordering lost row identity or checkbox state");

    const historical = [
        entry("2022_11_17-11_trip.gpx", {
            resolvedDate: new Date("2022-11-17T11:00:00Z")
        }),
        entry("2022_11_25-11_trip.gpx", {
            resolvedDate: new Date("2022-11-25T11:00:00Z")
        }),
        entry("2022_12_04-02_trip.gpx", {
            startTime: new Date("2022-12-02T02:00:00Z")
        }),
        entry("2022_12_04-03_trip.gpx", {
            startTime: new Date("2022-12-03T03:00:00Z")
        }),
        entry("2022_12_04-04_trip.gpx", {
            startTime: new Date("2022-12-04T04:00:00Z")
        }),
        entry("2022_12_04-05_trip.gpx", {
            startTime: new Date("2022-12-05T05:00:00Z")
        }),
        entry("2022_12_04-06_trip.gpx", {
            startTime: new Date("2022-12-06T06:00:00Z")
        }),
        entry("2026_09_05.gpx", {
            resolvedDate: new Date("2026-09-05T00:00:00Z")
        })
    ];
    order.setEntries(historical);
    const orderedHistorical = [...historical];
    orderedHistorical.sort((first, second) => order.compare(
        first.relativePath,
        second.relativePath
    ));
    assert(orderedHistorical.map(value => value.relativePath).join(",") === [
        "2026_09_05.gpx",
        "2022_12_04-06_trip.gpx",
        "2022_12_04-05_trip.gpx",
        "2022_12_04-04_trip.gpx",
        "2022_12_04-03_trip.gpx",
        "2022_12_04-02_trip.gpx",
        "2022_11_25-11_trip.gpx",
        "2022_11_17-11_trip.gpx"
    ].join(","), "historical Track timestamps are not newest-first");

    const historicalRoot = new Folder("History", { name: "History" });

    historicalRoot.gpxFiles.push(...historical.map(value =>
        file(value.relativePath)));
    const historicalTree = new TreeView(new EventBus());

    document.body.append(historicalTree.element);
    await historicalTree.render(new Library(
        "History",
        historicalRoot,
        1,
        historical.length
    ));
    historicalTree.setDisplayChecked("2022_11_17-11_trip.gpx", true);
    historicalTree.setDisplayChecked("2022_12_04-04_trip.gpx", true);
    const checkedNodes = new Map([
        "2022_11_17-11_trip.gpx",
        "2022_12_04-04_trip.gpx"
    ].map(path => [path, historicalTree.fileNodes.get(path)]));

    historicalTree.setTrackOrderEntries(historical);
    assert(renderedPaths(historicalTree).join(",") ===
        orderedHistorical.map(value => value.relativePath).join(","),
    "late historical metadata did not reorder the rendered Folder rows");
    assert([...checkedNodes].every(([path, node]) =>
        historicalTree.fileNodes.get(path) === node &&
        historicalTree.isDisplayChecked(path)),
    "late historical re-sort changed relativePath checkbox ownership");

    output.textContent = `PASS: ${assertions} assertions`;
}

try {
    await run();
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
