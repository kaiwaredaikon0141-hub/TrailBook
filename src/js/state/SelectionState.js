const VALID_SOURCES = new Set([
    "tree",
    "search",
    "map",
    "system"
]);

/**
 * Stores the single selected GPX path for the current Library session.
 */
export default class SelectionState {

    constructor() {

        this.selectedPath = null;
        this.source = null;
    }

    select(path, source = "system") {

        if (!this.isValidPath(path) || this.selectedPath === path) {
            return null;
        }

        const previousPath = this.selectedPath;
        const resolvedSource = this.resolveSource(source);

        this.selectedPath = path;
        this.source = resolvedSource;

        return {
            previousPath,
            selectedPath: path,
            source: resolvedSource
        };
    }

    clear(source = "system") {

        if (this.selectedPath === null) {
            return null;
        }

        const previousPath = this.selectedPath;
        const resolvedSource = this.resolveSource(source);

        this.selectedPath = null;
        this.source = null;

        return {
            previousPath,
            selectedPath: null,
            source: resolvedSource
        };
    }

    reset() {

        return this.clear("system");
    }

    isSelected(path) {

        return this.isValidPath(path) && this.selectedPath === path;
    }

    getSelectedPath() {

        return this.selectedPath;
    }

    getSource() {

        return this.source;
    }

    isValidPath(path) {

        return typeof path === "string" && path.trim().length > 0;
    }

    resolveSource(source) {

        return VALID_SOURCES.has(source) ? source : "system";
    }
}
