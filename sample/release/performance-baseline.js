const environmentFields = [
    ["測定日", new Date().toISOString().slice(0, 10)], ["PC識別名", ""],
    ["OS", "Windows"], ["OS build", ""], ["CPU", ""], ["memory", ""],
    ["browser", ""], ["browser version", ""], ["origin", "http://localhost"],
    ["Production baseline commit", "7076fdd", true],
    ["Measurement working commit", "9455be8", true],
    ["TrailBook version", "0.9.0", true], ["Library識別名", ""],
    ["GPX件数", "806"], ["Folder件数", ""], ["Library容量", ""],
    ["Waypoint設定", "OFF"], ["DevTools状態", ""], ["Network状態", "online"]
];

const measurements = [
    ["Library scan", "Folder選択確定直前 → scan完了後、初期Treeが操作可能", "Initial Treeを分離できない場合は含む"],
    ["Initial Tree", "scan完了 → 初期Treeと件数表示が操作可能", "分離不能ならIncluded in Library scan"],
    ["Search", "同一queryの最後の入力 → 結果DOMと総一致件数の更新完了", "150ms debounceを含む"],
    ["All ON cold", "reload後、root checkbox ON → Queue完了と全表示状態確定", "cache空、Waypoint OFF"],
    ["All OFF", "全表示後、root checkbox OFF → Layer削除と状態反映完了", "cold全表示直後"],
    ["Re-display", "同一sessionでroot checkbox再ON → Queue完了と全表示状態確定", "cache上限100件。cache済み件数と再解析件数を記録"],
    ["Library switch", "新Folder選択確定直前 → 旧状態破棄後、新Libraryが操作可能", "旧Queue、cache、Layer、Search結果の破棄を確認"]
].map(([label, boundary, note], index) => ({ id: `m${index}`, label, boundary, note, runs: [] }));

const memoryCheckpoints = ["起動直後", "Library scan後", "全表示後", "全解除後", "Library切り替え後"];
const status = document.getElementById("status");
const output = document.getElementById("output");
let active = null;

const median = values => {
    if (values.length < 3) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};
const format = value => value === null || value === undefined ? "" : value.toFixed(1);
const escapeMarkdown = value => String(value || "").replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");

environmentFields.forEach(([name, value, readOnly], index) => {
    const label = document.createElement("label");
    const text = document.createElement("span");
    const input = document.createElement("input");
    text.textContent = name;
    input.id = `environment-${index}`;
    input.value = value;
    input.readOnly = Boolean(readOnly);
    label.append(text, input);
    document.getElementById("environment").append(label);
});

const refresh = () => {
    measurements.forEach(measurement => {
        const row = document.querySelector(`[data-id="${measurement.id}"]`);
        measurement.runs.forEach((value, index) => row.querySelector(`[data-run="${index}"]`).textContent = format(value));
        for (let index = measurement.runs.length; index < 3; index += 1) row.querySelector(`[data-run="${index}"]`).textContent = "";
        row.querySelector("[data-median]").textContent = format(median(measurement.runs));
        row.querySelector("[data-start]").disabled = active !== null || measurement.runs.length >= 3;
        row.querySelector("[data-stop]").disabled = active?.id !== measurement.id;
    });
};

measurements.forEach(measurement => {
    const row = document.createElement("tr");
    row.dataset.id = measurement.id;
    const description = document.createElement("td");
    description.append(Object.assign(document.createElement("strong"), { textContent: measurement.label }), document.createElement("br"), Object.assign(document.createElement("small"), { textContent: measurement.boundary }));
    const controls = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions";
    [["Start", "start"], ["Stop", "stop"], ["Reset", "reset"]].forEach(([label, action]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset[action] = "";
        button.addEventListener("click", () => {
            if (action === "start" && !active && measurement.runs.length < 3) {
                active = { id: measurement.id, startedAt: performance.now() };
                status.textContent = `${measurement.label}: running`;
            } else if (action === "stop" && active?.id === measurement.id) {
                const elapsed = performance.now() - active.startedAt;
                measurement.runs.push(elapsed);
                active = null;
                status.textContent = `${measurement.label}: ${elapsed.toFixed(1)} ms recorded`;
            } else if (action === "reset") {
                if (active?.id === measurement.id) active = null;
                measurement.runs = [];
                status.textContent = `${measurement.label}: reset`;
            }
            refresh();
        });
        actions.append(button);
    });
    controls.append(actions);
    row.append(description, controls);
    for (let index = 0; index < 3; index += 1) {
        const cell = document.createElement("td"); cell.className = "number"; cell.dataset.run = index; row.append(cell);
    }
    const middle = document.createElement("td"); middle.className = "number"; middle.dataset.median = ""; row.append(middle);
    const notes = document.createElement("textarea"); notes.rows = 2; notes.value = measurement.note;
    notes.addEventListener("input", () => measurement.note = notes.value);
    const noteCell = document.createElement("td"); noteCell.append(notes); row.append(noteCell);
    document.getElementById("timing").append(row);
});

["全806 GPX表示時", "少数GPX表示時"].forEach((name, index) => {
    const row = document.createElement("tr");
    const select = document.createElement("select"); select.id = `pan-rating-${index}`;
    ["Not measured", "Good", "Acceptable", "Poor"].forEach(value => select.append(new Option(value, value)));
    const notes = document.createElement("textarea"); notes.id = `pan-notes-${index}`; notes.rows = 2;
    [name, select, notes].forEach(value => { const cell = document.createElement("td"); typeof value === "string" ? cell.textContent = value : cell.append(value); row.append(cell); });
    document.getElementById("pan-zoom").append(row);
});

memoryCheckpoints.forEach((name, index) => {
    const row = document.createElement("tr");
    const value = document.createElement("input"); value.id = `memory-value-${index}`; value.placeholder = "Not available";
    const notes = document.createElement("input"); notes.id = `memory-notes-${index}`;
    [name, value, notes].forEach(item => { const cell = document.createElement("td"); typeof item === "string" ? cell.textContent = item : cell.append(item); row.append(cell); });
    document.getElementById("memory").append(row);
});
document.getElementById("memory-api").textContent = `memory API in helper context: ${performance.memory ? "Available (App valuesはTrailBook tabで取得)" : "Not available"}`;

const createMarkdown = () => {
    const lines = [
        "Production baseline: v0.9.0 code at commit 7076fdd", "",
        "Measurement working commit: 9455be8", "",
        "Difference: Release 1.0 planning documentation only. No production JavaScript, CSS, or HTML differences.", "", "### Measurement Environment", ""
    ];
    environmentFields.forEach(([name], index) => lines.push(`- ${name}: ${escapeMarkdown(document.getElementById(`environment-${index}`).value || "Not recorded")}`));
    lines.push("", "### Timing Results", "", "| Measurement | Run 1 | Run 2 | Run 3 | Median | Notes |", "|---|---:|---:|---:|---:|---|");
    measurements.forEach(item => lines.push(`| ${item.label} | ${format(item.runs[0])} | ${format(item.runs[1])} | ${format(item.runs[2])} | ${format(median(item.runs))} | ${escapeMarkdown(item.note)} |`));
    lines.push("", "### Pan / Zoom", "", "| Display state | Rating | Observations |", "|---|---|---|");
    ["全806 GPX表示時", "少数GPX表示時"].forEach((name, index) => lines.push(`| ${name} | ${document.getElementById(`pan-rating-${index}`).value} | ${escapeMarkdown(document.getElementById(`pan-notes-${index}`).value)} |`));
    lines.push("", "### Memory Trend", "", "| Checkpoint | Used JS heap (MB) / Not available | Notes |", "|---|---:|---|");
    memoryCheckpoints.forEach((name, index) => lines.push(`| ${name} | ${escapeMarkdown(document.getElementById(`memory-value-${index}`).value || "Not available")} | ${escapeMarkdown(document.getElementById(`memory-notes-${index}`).value)} |`));
    lines.push("", "- Search includes the 150 ms debounce.", "- Re-display cache limit is 100; do not describe all 806 GPX as warm.", "- Mobile acceptance remains a separate pending test.");
    return lines.join("\n");
};

function installConsoleHelper() {
    const names = ["Library scan", "Initial Tree", "Search", "All ON cold", "All OFF", "Re-display", "Library switch"];
    const results = Object.fromEntries(names.map(name => [name, []]));
    const memories = {};
    let active = null;
    const median = values => values.length < 3 ? null : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    window.trailBookBaseline = {
        start(name) { if (!names.includes(name)) throw new Error(`Unknown: ${name}`); if (active) throw new Error("Already running"); if (results[name].length >= 3) throw new Error(`${name} already has 3 runs; reset it first`); active = { name, at: performance.now() }; console.log(`${name} started`); },
        stop() { if (!active) throw new Error("Not running"); const elapsed = performance.now() - active.at; results[active.name].push(elapsed); console.log(`${active.name}: ${elapsed.toFixed(1)} ms`); active = null; return elapsed; },
        captureMemory(checkpoint) { const value = performance.memory ? Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)) : "Not available"; memories[checkpoint] = value; console.log(checkpoint, value); return value; },
        reset(name) { results[name] = []; if (active?.name === name) active = null; },
        report() { const lines = ["| Measurement | Run 1 | Run 2 | Run 3 | Median | Notes |", "|---|---:|---:|---:|---:|---|"]; names.forEach(name => { const value = results[name]; const run = index => value[index] === undefined ? "" : value[index].toFixed(1); const middle = median(value); lines.push(`| ${name} | ${run(0)} | ${run(1)} | ${run(2)} | ${middle === null ? "" : middle.toFixed(1)} | |`); }); const text = `${lines.join("\n")}\n\nMemory:\n${JSON.stringify(memories, null, 2)}`; console.log(text); return text; },
        results, memories
    };
    console.log("Installed: trailBookBaseline.start(name), stop(), captureMemory(checkpoint), report()");
}
const consoleSnippet = `(${installConsoleHelper.toString()})();`;

document.getElementById("generate").addEventListener("click", () => output.value = createMarkdown());
document.getElementById("copy").addEventListener("click", async () => { output.value = createMarkdown(); await navigator.clipboard.writeText(output.value); });
document.getElementById("copy-snippet").addEventListener("click", async () => { await navigator.clipboard.writeText(consoleSnippet); status.textContent = "Console snippet copied"; });
refresh();
output.value = createMarkdown();
