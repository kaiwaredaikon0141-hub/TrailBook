const SEARCH_DEBOUNCE_MS = 150;

/**
 * Displays Discovery text/date filters and bounded Track results.
 */
export default class SearchView {

    #activeQuery = "";

    #queryTimer = null;

    /**
     * @param {import("../core/EventBus.js").default} eventBus
     */
    constructor(eventBus) {

        this.eventBus = eventBus;
        this.results = [];
        this.selectedPath = null;
        this.element = this.#create();
        this.input = this.element.querySelector(".search-input");
        this.fromInput = this.element.querySelector(".search-date-from");
        this.toInput = this.element.querySelector(".search-date-to");
        this.clearButton = this.element.querySelector(".search-filter-clear");
        this.summary = this.element.querySelector(".search-summary");
        this.resultList = this.element.querySelector(".search-results");
    }

    /**
     * Enables or disables Search for the current library.
     *
     * @param {boolean} isAvailable
     * @returns {void}
     */
    setAvailable(isAvailable) {

        this.input.disabled = !isAvailable;
        this.fromInput.disabled = !isAvailable;
        this.toInput.disabled = !isAvailable;
        this.clearButton.disabled = !isAvailable;
        this.input.placeholder = isAvailable
            ? "Track名・Folder pathを検索"
            : "ライブラリを開いてください";

        if (!isAvailable) {
            this.reset();
        }
    }

    /**
     * Returns the last query emitted after debounce.
     *
     * @returns {string}
     */
    getActiveQuery() {

        return this.#activeQuery;
    }

    getFilter() {

        return {
            query: this.#activeQuery,
            from: this.fromInput.value,
            to: this.toInput.value
        };
    }

    setFilter(filter = {}, { emit = false } = {}) {

        this.#cancelQuery();
        this.input.value = String(filter.query || "");
        this.fromInput.value = String(filter.from || "");
        this.toInput.value = String(filter.to || "");
        this.#activeQuery = this.input.value;

        if (emit) this.#emitFilterChanged();
    }

    setSelectedPath(path) {

        this.selectedPath = path;

        this.resultList.querySelectorAll(".search-result-item").forEach(item => {
            const isSelected = item.dataset.searchPath === path;
            const action = item.querySelector(".search-result-action");

            item.classList.toggle("is-selected", isSelected);

            if (isSelected) {
                action?.setAttribute("aria-current", "true");
            } else {
                action?.removeAttribute("aria-current");
            }
        });
    }

    setResultColor(path, color) {

        const entry = this.results.find(result => result.path === path);

        if (entry) {
            entry.color = color;
        }

        const item = [...this.resultList.children].find(
            candidate => candidate.dataset.searchPath === path
        );
        const indicator = item?.querySelector(".search-result-color");

        if (indicator) {
            indicator.style.backgroundColor = color || "";
        }

        return Boolean(entry || indicator);
    }

    /**
     * Clears the query, pending timer, and results.
     *
     * @returns {void}
     */
    reset() {

        this.#cancelQuery();
        this.#activeQuery = "";
        this.input.value = "";
        this.fromInput.value = "";
        this.toInput.value = "";
        this.#clearResults();
    }

    /**
     * Clears resources owned by SearchView.
     *
     * @returns {void}
     */
    destroy() {

        this.#cancelQuery();
    }

    /**
     * Displays the bounded results for the active query.
     *
     * @param {{totalCount: number, results: object[]}} searchResult
     * @param {string} query
     * @returns {void}
     */
    showResults(searchResult, query) {

        if (!query.trim()) {
            this.reset();
            return;
        }

        const focusState = this.#captureResultFocus();

        this.#activeQuery = query;
        this.results = searchResult.results;
        this.resultList.replaceChildren(
            ...this.results.map(
                (entry, index) => this.#createResult(entry, index)
            )
        );
        this.resultList.hidden = this.results.length === 0;
        this.summary.textContent = this.#createSummary(searchResult);
        this.#restoreResultFocus(focusState);
    }

    showFilterResults(searchResult, filter) {

        const active = Boolean(
            String(filter?.query || "").trim() || filter?.from || filter?.to
        );

        if (!active) {
            this.#clearResults();
            return;
        }

        const focusState = this.#captureResultFocus();

        this.#activeQuery = String(filter.query || "");
        this.results = searchResult.results;
        this.resultList.replaceChildren(
            ...this.results.map((entry, index) => this.#createResult(entry, index))
        );
        this.resultList.hidden = this.results.length === 0;
        this.summary.textContent = this.#createSummary(searchResult);
        this.#restoreResultFocus(focusState);
    }

    showFilterBuilding(filter, { completed = 0, total = 0 } = {}) {

        if (!String(filter?.query || "").trim() && !filter?.from && !filter?.to) {
            return;
        }

        this.resultList.replaceChildren();
        this.resultList.hidden = true;
        this.results = [];
        this.summary.textContent = total > 0
            ? `Discovery Indexを準備中: ${completed} / ${total}`
            : "Discovery Indexを準備中";
    }

    #create() {

        const section = document.createElement("section");

        section.className = "search-view";
        section.setAttribute("aria-label", "Library検索");
        section.innerHTML = `
            <label class="search-label" for="library-search">Search</label>
            <input
                id="library-search"
                class="search-input"
                type="search"
                aria-label="Libraryを検索"
                autocomplete="off"
                disabled
                placeholder="ライブラリを開いてください"
            >
            <div class="search-date-filter" role="group" aria-label="Date range">
                <label>
                    <span>From</span>
                    <input class="search-date-from" type="date" disabled>
                </label>
                <label>
                    <span>To</span>
                    <input class="search-date-to" type="date" disabled>
                </label>
                <button class="search-filter-clear" type="button" disabled>Clear</button>
            </div>
            <p class="search-summary" aria-live="polite"></p>
            <ul class="search-results" aria-label="検索結果" hidden></ul>
        `;

        section.querySelector(".search-input").addEventListener(
            "input",
            event => this.#handleInput(event.target.value)
        );
        section.querySelector(".search-input").addEventListener(
            "keydown",
            event => this.#handleInputKeyDown(event)
        );
        section.querySelectorAll(".search-date-from, .search-date-to").forEach(
            input => {
                input.addEventListener("input", () => this.#scheduleFilter());
                input.addEventListener(
                    "keydown",
                    event => this.#handleInputKeyDown(event)
                );
            }
        );
        section.querySelector(".search-filter-clear").addEventListener(
            "click",
            () => this.#clearFilter(true)
        );
        section.querySelector(".search-results").addEventListener(
            "click",
            event => this.#handleResultClick(event)
        );
        section.querySelector(".search-results").addEventListener(
            "change",
            event => this.#handleCheckboxChange(event)
        );
        section.querySelector(".search-results").addEventListener(
            "keydown",
            event => this.#handleResultKeyDown(event)
        );

        return section;
    }

    #createResult(entry, index) {

        const item = document.createElement("li");
        const action = document.createElement("button");

        item.className = `search-result-item is-${entry.state || "idle"}`;
        item.dataset.searchPath = entry.path;
        item.dataset.searchKind = entry.kind;

        if (entry.kind === "file") {
            item.append(this.#createCheckbox(entry, index));
        }

        action.className = "search-result-action";
        action.type = "button";
        action.dataset.searchIndex = String(index);
        action.tabIndex = index === 0 ? 0 : -1;
        action.setAttribute(
            "aria-label",
            entry.kind === "folder"
                ? `Folderを開く: ${entry.name}`
                : `GPXを選択: ${entry.name}`
        );
        action.append(
            this.#createResultHeading(entry),
            this.#createResultPath(entry)
        );
        item.append(action);

        if (entry.path === this.selectedPath || entry.selected) {
            item.classList.add("is-selected");
            action.setAttribute("aria-current", "true");
        }

        return item;
    }

    #createCheckbox(entry, index) {

        const checkbox = document.createElement("input");

        checkbox.className = "search-result-checkbox";
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(entry.checked);
        checkbox.dataset.searchIndex = String(index);
        checkbox.setAttribute("aria-label", `地図に表示: ${entry.name}`);
        checkbox.addEventListener("click", event => event.stopPropagation());

        return checkbox;
    }

    #createResultHeading(entry) {

        const heading = document.createElement("span");
        const icon = document.createElement("span");
        const label = document.createElement("span");

        heading.className = "search-result-heading";
        icon.className = "search-result-icon";
        icon.textContent = entry.kind === "folder" ? "📁" : "●";
        icon.setAttribute("aria-hidden", "true");
        label.textContent = `${entry.kind === "folder" ? "Folder" : "GPX"}: ` +
            entry.name;

        if (entry.kind === "file") {
            const color = document.createElement("span");

            color.className = "search-result-color";
            color.style.backgroundColor = entry.color || "";
            color.setAttribute("aria-hidden", "true");
            heading.append(icon, color, label);
        } else {
            heading.append(icon, label);
        }

        return heading;
    }

    #createResultPath(entry) {

        const detail = document.createElement("span");
        const path = document.createElement("span");

        detail.className = "search-result-detail";
        path.className = "search-result-path";
        path.textContent = entry.path || "Library root";
        detail.append(path);

        if (entry.kind === "file" && entry.state !== "idle") {
            const state = document.createElement("span");

            state.className = "search-result-state";
            state.textContent = this.#stateLabel(entry.state);
            detail.append(state);
        }

        return detail;
    }

    #handleInput(query) {

        this.#cancelQuery();
        this.#activeQuery = query;
        this.#scheduleFilter();
    }

    #handleInputKeyDown(event) {

        if (event.key === "Escape") {
            event.preventDefault();
            this.#clearFilter(true);
            return;
        }

        if (event.key === "ArrowDown") {
            const firstResult = this.#resultActions()[0];

            if (firstResult) {
                event.preventDefault();
                this.#focusResult(firstResult);
            }
        }
    }

    #handleResultClick(event) {

        const action = event.target.closest(".search-result-action");

        if (!action) {
            return;
        }

        const entry = this.results[Number(action.dataset.searchIndex)];

        if (entry) {
            this.eventBus.emit("search:result-activated", {
                path: entry.path,
                kind: entry.kind
            });
        }
    }

    #handleCheckboxChange(event) {

        const checkbox = event.target.closest(".search-result-checkbox");

        if (!checkbox) {
            return;
        }

        const entry = this.results[Number(checkbox.dataset.searchIndex)];

        if (entry?.kind === "file") {
            this.#emitDisplayToggle(entry, checkbox.checked);
        }
    }

    #handleResultKeyDown(event) {

        if (event.target.matches(".search-result-checkbox")) {
            return;
        }

        const action = event.target.closest(".search-result-action");

        if (!action) {
            return;
        }

        const actions = this.#resultActions();
        const index = actions.indexOf(action);

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = Math.max(
                0,
                Math.min(actions.length - 1, index + direction)
            );
            this.#focusResult(actions[nextIndex]);
            return;
        }

        if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            this.#focusResult(
                event.key === "Home" ? actions[0] : actions[actions.length - 1]
            );
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            this.#clearFilter(true);
            this.input.focus();
            return;
        }

        if (event.key === " ") {
            event.preventDefault();
            const entry = this.results[Number(action.dataset.searchIndex)];

            if (entry?.kind === "file") {
                const checkbox = action.parentElement.querySelector(
                    ".search-result-checkbox"
                );

                checkbox.checked = !checkbox.checked;
                this.#emitDisplayToggle(entry, checkbox.checked);
            }
        }
    }

    #emitDisplayToggle(entry, checked) {

        this.eventBus.emit("search:gpx-display-toggled", {
            path: entry.path,
            checked
        });
    }

    #createSummary({ totalCount, results }) {

        if (totalCount === 0) {
            return "一致する項目はありません";
        }

        if (totalCount === results.length) {
            return `検索結果: ${totalCount}件`;
        }

        return `検索結果: ${totalCount}件。先頭${results.length}件を表示しています。` +
            `ほか${totalCount - results.length}件`;
    }

    #stateLabel(state) {

        switch (state) {
        case "loading":
            return "読み込み中";
        case "loaded":
            return "表示中";
        case "error":
            return "エラー";
        default:
            return "";
        }
    }

    #focusResult(action) {

        this.#resultActions().forEach(candidate => {
            candidate.tabIndex = candidate === action ? 0 : -1;
        });
        action.focus();
    }

    #resultActions() {

        return [...this.resultList.querySelectorAll(".search-result-action")];
    }

    #captureResultFocus() {

        const activeElement = document.activeElement;
        const item = activeElement?.closest?.(".search-result-item");

        if (!item || !this.resultList.contains(item)) {
            return null;
        }

        return {
            path: item.dataset.searchPath,
            control: activeElement.matches(".search-result-checkbox")
                ? "checkbox"
                : "action"
        };
    }

    #restoreResultFocus(focusState) {

        if (!focusState) {
            return;
        }

        const item = [...this.resultList.children].find(candidate => {
            return candidate.dataset.searchPath === focusState.path;
        });

        const target = focusState.control === "checkbox"
            ? item?.querySelector(".search-result-checkbox")
            : item?.querySelector(".search-result-action");

        if (target) {
            const action = item.querySelector(".search-result-action");
            this.#resultActions().forEach(candidate => {
                candidate.tabIndex = candidate === action ? 0 : -1;
            });
            target.focus();
        }
    }

    #clearResults() {

        this.results = [];
        this.summary.textContent = "";
        this.resultList.replaceChildren();
        this.resultList.hidden = true;
    }

    #cancelQuery() {

        clearTimeout(this.#queryTimer);
        this.#queryTimer = null;
    }

    #scheduleFilter() {

        this.#cancelQuery();
        this.#queryTimer = setTimeout(() => {
            this.#queryTimer = null;
            this.#activeQuery = this.input.value;
            this.#emitFilterChanged();
        }, SEARCH_DEBOUNCE_MS);
    }

    #clearFilter(emit) {

        this.reset();
        if (emit) this.#emitFilterChanged();
    }

    #emitFilterChanged() {

        const filter = this.getFilter();

        this.eventBus.emit("search:filter-changed", { filter });
        this.eventBus.emit("search:query-changed", { query: filter.query });
    }
}

export { SEARCH_DEBOUNCE_MS };
