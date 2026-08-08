import TrackInfoView from "../ui/TrackInfoView.js";

/**
 * Projects the selected path's shared Discovery Index entry to Track Info.
 */
export default class TrackInfoCoordinator {

    constructor({ index, view = new TrackInfoView() }) {

        this.index = index;
        this.view = view;
        this.generation = 0;
        this.isCurrent = () => false;
        this.selectedPath = null;
        this.requestId = 0;
    }

    get element() {

        return this.view.element;
    }

    setLibrary({ generation, isCurrent }) {

        this.generation = generation;
        this.isCurrent = isCurrent;
        this.selectedPath = null;
        this.requestId += 1;
        this.view.showEmpty();
    }

    clearLibrary() {

        this.generation += 1;
        this.isCurrent = () => false;
        this.selectedPath = null;
        this.requestId += 1;
        this.view.showEmpty();
    }

    async setSelectedPath(path) {

        const requestId = ++this.requestId;

        this.selectedPath = typeof path === "string" && path.length > 0
            ? path
            : null;

        if (!this.selectedPath) {
            this.view.showEmpty();
            return false;
        }

        if (!this.isCurrent()) {
            this.view.showUnavailable();
            return false;
        }

        const existing = this.index.getEntry(this.selectedPath);

        if (existing) {
            this.view.showEntry(existing);
            return true;
        }

        const generation = this.generation;

        this.view.showLoading();

        try {
            const entry = await this.index.loadEntry(this.selectedPath, {
                isCurrent: candidate => (
                    candidate === generation && this.isCurrent()
                )
            });

            if (!this.#isRequestCurrent(requestId, generation)) {
                return false;
            }

            if (entry) {
                this.view.showEntry(entry);
                return true;
            }
        } catch {
            // A missing or unreadable summary is a non-blocking UI state.
        }

        if (this.#isRequestCurrent(requestId, generation)) {
            this.view.showUnavailable();
        }

        return false;
    }

    #isRequestCurrent(requestId, generation) {

        return requestId === this.requestId &&
            generation === this.generation &&
            this.isCurrent() &&
            this.selectedPath !== null;
    }
}
