import DateTreeVisibilityIndex from "../services/DateTreeVisibilityIndex.js";

const ROW_SELECTOR = "[data-date-tree-row]";

/**
 * Lazy, keyboard-navigable projection of Discovery Index date groups.
 */
export default class DateTreeView {

    constructor(eventBus) {

        this.eventBus = eventBus;
        this.groups = [];
        this.fileHandles = new Map();
        this.getDisplay = () => null;
        this.selectedPath = null;
        this.revealSelected = false;
        this.expandedIds = new Set();
        this.renderedTrackRows = new Map();
        this.renderedGroupRows = new Map();
        this.visibilityIndex = new DateTreeVisibilityIndex();
        this.element = this.#create();
        this.status = this.element.querySelector(".date-tree-status");
        this.cancelButton = this.element.querySelector(".date-tree-cancel");
        this.root = this.element.querySelector(".date-tree-root");
    }

    setAvailable(available) {

        this.element.dataset.available = String(available);

        if (!available) {
            this.clear();
        }
    }

    showBuilding({ completed = 0, total = 0 } = {}) {

        this.status.textContent = total > 0
            ? `日付Indexを準備中: ${completed} / ${total}`
            : "日付Indexを準備中";
        this.cancelButton.hidden = false;
        this.root.hidden = true;
    }

    showCancelled() {

        this.status.textContent = "日付Indexの準備を中止しました。Dateを選ぶと再開します。";
        this.cancelButton.hidden = true;
        this.root.hidden = true;
    }

    showError() {

        this.status.textContent = "日付Indexを準備できませんでした。再試行できます。";
        this.cancelButton.hidden = true;
        this.root.hidden = true;
    }

    showTree(groups, { fileHandles, getDisplay }) {

        this.groups = groups;
        this.fileHandles = fileHandles;
        this.getDisplay = getDisplay;
        this.renderedTrackRows.clear();
        this.renderedGroupRows.clear();
        this.visibilityIndex.setGroups(groups);
        const trackCount = groups.reduce(
            (count, group) => count + this.#countTracks(group),
            0
        );
        const failureCount = this.#collectTracks(groups)
            .filter(entry => entry.status === "error").length;
        this.status.textContent = groups.length === 0
            ? "GPXがありません。"
            : `日付Index: ${trackCount}件準備完了${
                failureCount ? `、解析失敗 ${failureCount}件` : ""
            }`;
        this.cancelButton.hidden = true;
        this.root.replaceChildren(...groups.map(group => this.#createGroup(group)));
        this.root.hidden = groups.length === 0;
        if (this.revealSelected) this.#revealSelectedPath();
        this.#setInitialTabStop();
    }

    clear() {

        this.groups = [];
        this.fileHandles = new Map();
        this.renderedTrackRows.clear();
        this.renderedGroupRows.clear();
        this.visibilityIndex.clear();
        this.expandedIds.clear();
        this.revealSelected = false;
        this.status.textContent = "";
        this.cancelButton.hidden = true;
        this.root.replaceChildren();
        this.root.hidden = true;
    }

    setSelectedPath(path, { reveal = false } = {}) {

        this.selectedPath = path;
        this.revealSelected = Boolean(path) && Boolean(reveal);
        if (this.revealSelected) this.#revealSelectedPath();
        this.#applySelection();
    }

    revealSelectedPath() {

        if (!this.selectedPath) return false;

        this.revealSelected = true;
        return this.#revealSelectedPath();
    }

    #applySelection() {

        this.renderedTrackRows.forEach((row, candidate) => {
            const selected = candidate === this.selectedPath;
            row.classList.toggle("is-selected", selected);

            if (selected) {
                row.setAttribute("aria-current", "true");
                row.setAttribute("aria-selected", "true");
            } else {
                row.removeAttribute("aria-current");
                row.setAttribute("aria-selected", "false");
            }
        });
    }

    syncDisplay(path = null) {

        if (path === null) {
            this.renderedTrackRows.forEach((row, candidate) =>
                this.#applyDisplay(row, candidate)
            );
            this.renderedGroupRows.forEach((row, id) =>
                this.#applyGroupDisplay(row, id)
            );
            return;
        }

        const row = this.renderedTrackRows.get(path);

        if (row) {
            this.#applyDisplay(row, path);
        }

        this.visibilityIndex.getGroupIds(path).forEach(id => {
            const groupRow = this.renderedGroupRows.get(id);

            if (groupRow) {
                this.#applyGroupDisplay(groupRow, id);
            }
        });
    }

    #create() {

        const section = document.createElement("section");

        section.className = "date-tree-view";
        section.hidden = true;
        section.setAttribute("aria-label", "日付別GPX");
        section.innerHTML = `
            <p class="date-tree-status" aria-live="polite"></p>
            <button class="date-tree-cancel" type="button" hidden>中止</button>
            <ul class="date-tree-root" role="tree" aria-label="日付別GPX" hidden></ul>
        `;

        const root = section.querySelector(".date-tree-root");

        section.querySelector(".date-tree-cancel").addEventListener(
            "click",
            () => this.eventBus.emit("discovery:index-cancel-requested")
        );
        root.addEventListener("click", event => this.#handleClick(event));
        root.addEventListener("change", event => this.#handleChange(event));
        root.addEventListener("keydown", event => this.#handleKeyDown(event));
        root.addEventListener("focusin", event => this.#handleFocus(event));

        return section;
    }

    #createGroup(group) {

        const item = document.createElement("li");
        const row = document.createElement("div");

        row.className = "date-tree-row date-tree-group-row";
        row.dataset.dateTreeRow = "group";
        row.dataset.dateNodeId = group.id;
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-expanded", "false");
        row.tabIndex = -1;
        row.innerHTML = `
            <input class="date-tree-group-checkbox" type="checkbox">
            <span class="date-tree-icon" aria-hidden="true"></span>
            <span class="date-tree-label"></span>
            <span class="date-tree-count"></span>
        `;
        row.querySelector(".date-tree-label").textContent = group.label;
        row.querySelector(".date-tree-group-checkbox").setAttribute(
            "aria-label",
            `配下のGPXを地図に表示: ${group.label}`
        );
        row.querySelector(".date-tree-count").textContent = String(
            this.#countTracks(group)
        );
        item.append(row);
        this.renderedGroupRows.set(group.id, row);
        this.#applyGroupDisplay(row, group.id);

        if (this.expandedIds.has(group.id)) {
            this.#expandGroup(row, group);
        }

        return item;
    }

    #createTrack(entry) {

        const item = document.createElement("li");
        const row = document.createElement("div");

        row.className = "date-tree-row date-tree-track-row";
        row.dataset.dateTreeRow = "track";
        row.dataset.dateTreePath = entry.relativePath;
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-selected", "false");
        row.tabIndex = -1;
        row.title = entry.relativePath;
        row.innerHTML = `
            <input class="date-tree-checkbox" type="checkbox">
            <span class="date-tree-color-indicator" aria-hidden="true"></span>
            <span class="date-tree-track-label"></span>
        `;
        row.querySelector(".date-tree-track-label").textContent = entry.displayName;
        row.querySelector(".date-tree-checkbox").setAttribute(
            "aria-label",
            `地図表示: ${entry.displayName}`
        );
        item.append(row);
        this.renderedTrackRows.set(entry.relativePath, row);
        this.#applyDisplay(row, entry.relativePath);

        if (entry.relativePath === this.selectedPath) {
            row.classList.add("is-selected");
            row.setAttribute("aria-current", "true");
            row.setAttribute("aria-selected", "true");
        }

        return item;
    }

    #expandGroup(row, group) {

        if (row.nextElementSibling) {
            row.nextElementSibling.hidden = false;
        } else {
            const list = document.createElement("ul");

            list.className = "date-tree-group";
            list.setAttribute("role", "group");
            list.append(...group.children.map(child => (
                child.relativePath
                    ? this.#createTrack(child)
                    : this.#createGroup(child)
            )));
            row.after(list);
        }

        this.expandedIds.add(group.id);
        row.setAttribute("aria-expanded", "true");
        row.classList.add("is-expanded");
    }

    #collapseGroup(row) {

        const list = row.nextElementSibling;

        if (list?.matches(".date-tree-group")) {
            list.hidden = true;
        }

        this.expandedIds.delete(row.dataset.dateNodeId);
        row.setAttribute("aria-expanded", "false");
        row.classList.remove("is-expanded");
    }

    #toggleGroup(row) {

        const group = this.#findGroup(row.dataset.dateNodeId);

        if (!group) {
            return;
        }

        if (row.getAttribute("aria-expanded") === "true") {
            this.#collapseGroup(row);
        } else {
            this.#expandGroup(row, group);
        }
    }

    #handleClick(event) {

        if (event.target.closest(
            ".date-tree-checkbox, .date-tree-group-checkbox"
        )) {
            return;
        }

        const row = event.target.closest(ROW_SELECTOR);

        if (!row) {
            return;
        }

        if (row.dataset.dateTreeRow === "group") {
            this.#toggleGroup(row);
            return;
        }

        this.eventBus.emit("gpx:selection-requested", {
            path: row.dataset.dateTreePath,
            source: "tree",
            refocus: true
        });
    }

    #handleChange(event) {

        const checkbox = event.target.closest(".date-tree-checkbox");
        const groupCheckbox = event.target.closest(".date-tree-group-checkbox");
        const row = (checkbox || groupCheckbox)?.closest(ROW_SELECTOR);

        if (groupCheckbox) {
            this.#emitGroupDisplayToggle(row, groupCheckbox);
        } else {
            this.#emitDisplayToggle(row, checkbox);
        }
    }

    #emitDisplayToggle(row, checkbox) {

        const path = row?.dataset.dateTreePath;
        const fileHandle = this.fileHandles.get(path);

        if (!path || !fileHandle) {
            return;
        }

        this.eventBus.emit("gpx:display-toggled", {
            path,
            fileHandle,
            checked: checkbox.checked
        });
    }

    #emitGroupDisplayToggle(row, checkbox) {

        const fileEntries = this.visibilityIndex.getFileEntries(
            row?.dataset.dateNodeId,
            this.fileHandles
        );

        if (fileEntries.length === 0) {
            return;
        }

        this.eventBus.emit("folder:display-toggled", {
            path: row.dataset.dateNodeId,
            fileEntries,
            checked: checkbox.checked,
            source: "date-tree",
            preserveMapView: true,
            preserveSelection: true
        });
    }

    #handleKeyDown(event) {

        const row = event.target.closest(ROW_SELECTOR);

        if (!row || event.target.matches("input")) {
            return;
        }

        const rows = this.#visibleRows();
        const index = rows.indexOf(row);
        let target = null;

        if (event.key === "ArrowDown") target = rows[index + 1];
        if (event.key === "ArrowUp") target = rows[index - 1];
        if (event.key === "Home") target = rows[0];
        if (event.key === "End") target = rows.at(-1);

        if (event.key === "ArrowRight" && row.dataset.dateTreeRow === "group") {
            if (row.getAttribute("aria-expanded") !== "true") {
                this.#toggleGroup(row);
            } else {
                target = this.#visibleRows()[index + 1];
            }
        }

        if (event.key === "ArrowLeft") {
            if (
                row.dataset.dateTreeRow === "group" &&
                row.getAttribute("aria-expanded") === "true"
            ) {
                this.#toggleGroup(row);
            } else {
                target = row.parentElement.parentElement?.previousElementSibling;
            }
        }

        if (event.key === " " || event.key === "Spacebar" || event.code === "Space") {
            event.preventDefault();
            const checkbox = row.querySelector(
                ".date-tree-checkbox, .date-tree-group-checkbox"
            );

            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                if (checkbox.matches(".date-tree-group-checkbox")) {
                    this.#emitGroupDisplayToggle(row, checkbox);
                } else {
                    this.#emitDisplayToggle(row, checkbox);
                }
            } else {
                row.click();
            }
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            row.click();
            return;
        }

        if (target?.matches(ROW_SELECTOR)) {
            event.preventDefault();
            this.#focus(target);
        }
    }

    #handleFocus(event) {

        const row = event.target.closest(ROW_SELECTOR);

        if (row) {
            this.#visibleRows().forEach(candidate => {
                candidate.tabIndex = candidate === row ? 0 : -1;
            });
        }
    }

    #applyDisplay(row, path) {

        const display = this.getDisplay(path);
        const checkbox = row.querySelector(".date-tree-checkbox");
        const colorIndicator = row.querySelector(".date-tree-color-indicator");

        checkbox.checked = Boolean(display?.checked);
        if (display?.color) {
            colorIndicator.style.backgroundColor = display.color;
            colorIndicator.removeAttribute("aria-hidden");
            colorIndicator.setAttribute("role", "img");
            colorIndicator.setAttribute("aria-label", `表示色: ${display.color}`);
        } else {
            colorIndicator.style.removeProperty("background-color");
            colorIndicator.setAttribute("aria-hidden", "true");
            colorIndicator.removeAttribute("role");
            colorIndicator.removeAttribute("aria-label");
        }
        row.classList.toggle("is-loading", display?.state === "loading");
        row.classList.toggle("is-error", display?.state === "error");
    }

    #applyGroupDisplay(row, id) {

        const state = this.visibilityIndex.getState(id, this.getDisplay);
        const checkbox = row.querySelector(".date-tree-group-checkbox");

        checkbox.disabled = state.disabled;
        checkbox.checked = state.checked;
        checkbox.indeterminate = state.indeterminate;
    }

    #findGroup(id, groups = this.groups) {

        for (const group of groups) {
            if (group.id === id) return group;
            const child = this.#findGroup(
                id,
                group.children.filter(candidate => !candidate.relativePath)
            );
            if (child) return child;
        }

        return null;
    }

    #revealSelectedPath() {

        const chain = this.#findGroupChain(this.selectedPath);

        if (!chain) return false;

        chain.forEach(group => {
            const row = this.renderedGroupRows.get(group.id);

            if (row?.getAttribute("aria-expanded") !== "true") {
                this.#expandGroup(row, group);
            }
        });
        this.#applySelection();
        return this.renderedTrackRows.has(this.selectedPath);
    }

    #findGroupChain(path, groups = this.groups) {

        for (const group of groups) {
            if (group.children.some(child => child.relativePath === path)) {
                return [group];
            }

            const nested = this.#findGroupChain(
                path,
                group.children.filter(child => !child.relativePath)
            );

            if (nested) return [group, ...nested];
        }

        return null;
    }

    #countTracks(group) {

        return group.children.reduce((count, child) => (
            count + (child.relativePath ? 1 : this.#countTracks(child))
        ), 0);
    }

    #collectTracks(groups) {

        return groups.flatMap(group => group.children.flatMap(child => (
            child.relativePath
                ? [child]
                : this.#collectTracks([child])
        )));
    }

    #visibleRows() {

        return [...this.root.querySelectorAll(ROW_SELECTOR)].filter(row =>
            !row.closest("[hidden]")
        );
    }

    #setInitialTabStop() {

        const first = this.#visibleRows()[0];

        if (first) first.tabIndex = 0;
    }

    #focus(row) {

        this.#visibleRows().forEach(candidate => {
            candidate.tabIndex = candidate === row ? 0 : -1;
        });
        row.focus();
    }
}
