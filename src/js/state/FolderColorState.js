import {
    ROOT_PATH,
    parentPath,
    isSameOrDescendant,
    folderPathFromFilePath
} from "../utils/PathUtils.js";

/**
 * Owns explicit Folder colors for the active Library without UI or map access.
 */
export default class FolderColorState {

    constructor({ store, pathColorResolver, fallbackColor } = {}) {

        this.store = store;
        this.pathColorResolver = pathColorResolver;
        this.fallbackColor = fallbackColor;
        this.activeLibraryId = null;
        this.explicitColors = new Map();
        this.folderPaths = new Set([ROOT_PATH]);
    }

    setActiveLibrary(
        libraryId,
        folderPaths = [ROOT_PATH],
        folderColors = undefined
    ) {

        this.activeLibraryId = typeof libraryId === "string"
            ? libraryId
            : null;
        this.folderPaths = new Set(
            [...folderPaths].filter(path => typeof path === "string")
        );
        this.folderPaths.add(ROOT_PATH);

        return this.loadFolderColors(folderColors);
    }

    loadFolderColors(folderColors = undefined) {

        this.explicitColors.clear();

        if (!this.activeLibraryId) {
            return 0;
        }

        const colors = folderColors === undefined
            ? this.store?.getFolderColors(this.activeLibraryId) || {}
            : folderColors || {};

        Object.entries(colors).forEach(([folderPath, color]) => {
            if (this.folderPaths.has(folderPath)) {
                this.explicitColors.set(folderPath, color);
            }
        });

        return this.explicitColors.size;
    }

    setExplicitColor(folderPath, color) {

        if (
            !this.activeLibraryId ||
            !this.folderPaths.has(folderPath) ||
            !this.store?.setFolderColor(
                this.activeLibraryId,
                folderPath,
                color
            )
        ) {
            return false;
        }

        const normalizedColor = this.store.getFolderColor(
            this.activeLibraryId,
            folderPath
        );

        if (!normalizedColor) {
            return false;
        }

        this.explicitColors.set(folderPath, normalizedColor);

        return true;
    }

    removeExplicitColor(folderPath) {

        if (
            !this.activeLibraryId ||
            !this.folderPaths.has(folderPath) ||
            !this.store?.removeFolderColor(
                this.activeLibraryId,
                folderPath
            )
        ) {
            return false;
        }

        this.explicitColors.delete(folderPath);

        return true;
    }

    getExplicitColor(folderPath) {

        return this.explicitColors.get(folderPath) || null;
    }

    getExplicitColors() {

        const colors = Object.create(null);

        this.explicitColors.forEach((color, folderPath) => {
            colors[folderPath] = color;
        });

        return colors;
    }

    getFolderPaths() {

        return [...this.folderPaths];
    }

    hasFolderPath(folderPath) {

        return this.folderPaths.has(folderPath);
    }

    getResolvedFolderColor(folderPath) {

        if (!this.folderPaths.has(folderPath)) {
            return null;
        }

        let candidate = folderPath;

        while (true) {
            const color = this.getExplicitColor(candidate);

            if (color) {
                return color;
            }

            if (candidate === ROOT_PATH) {
                return null;
            }

            candidate = parentPath(candidate);
        }
    }

    getFolderPresentation(folderPath) {

        const explicitColor = this.getExplicitColor(folderPath);

        if (explicitColor) {
            return {
                mode: "explicit",
                explicitColor,
                resolvedColor: explicitColor
            };
        }

        const inheritedColor = this.getResolvedFolderColor(folderPath);

        return inheritedColor
            ? {
                mode: "inherited",
                explicitColor: null,
                resolvedColor: inheritedColor
            }
            : {
                mode: "auto",
                explicitColor: null,
                resolvedColor: null
            };
    }

    getFolderPresentations() {

        return new Map(
            [...this.folderPaths].map(path => [
                path,
                this.getFolderPresentation(path)
            ])
        );
    }

    resolveTrackColor(gpxPath, folderPath = folderPathFromFilePath(gpxPath)) {

        return this.getResolvedFolderColor(folderPath) ||
            this.pathColorResolver?.(gpxPath) ||
            this.fallbackColor;
    }

    getAffectedFolderPaths(changedFolderPath) {

        if (!this.folderPaths.has(changedFolderPath)) {
            return [];
        }

        return [...this.folderPaths].filter(folderPath => {
            if (!isSameOrDescendant(folderPath, changedFolderPath)) {
                return false;
            }

            let candidate = folderPath;

            while (candidate !== changedFolderPath) {
                if (this.explicitColors.has(candidate)) {
                    return false;
                }

                candidate = parentPath(candidate);
            }

            return true;
        });
    }
}
