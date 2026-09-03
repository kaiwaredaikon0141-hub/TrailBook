import LibraryTrackCatalog from "./LibraryTrackCatalog.js";

function diagnostic(operation, libraryIdentity, result, error = null) {

    return Object.freeze({
        operation,
        libraryIdentity: libraryIdentity || null,
        result,
        errorName: error?.name || null,
        errorMessage: error?.message || null
    });
}

/** Isolates non-authoritative Catalog synchronization from Viewer behavior. */
export default class LibraryTrackCatalogCoordinator {

    constructor({ catalog = new LibraryTrackCatalog(), reportError } = {}) {
        this.catalog = catalog;
        this.reportError = reportError || ((state, error) => {
            console.error("Library Track Catalog synchronization failed.", {
                diagnostic: state,
                error
            });
        });
        this.lastDiagnostic = diagnostic("none", null, "idle");
    }

    replaceProvisional(libraryIdentity, entries) {
        return this.#synchronize("replace-provisional", libraryIdentity, () =>
            this.catalog.replaceProvisional(libraryIdentity, entries));
    }

    replaceFromCompleteScan(libraryIdentity, entries, options) {
        return this.#synchronize("replace-complete", libraryIdentity, () =>
            this.catalog.replaceFromCompleteScan(
                libraryIdentity,
                entries,
                options
            ));
    }

    mergeActual(libraryIdentity, entries, options) {
        return this.#synchronize("merge-actual", libraryIdentity, () =>
            this.catalog.mergeActual(libraryIdentity, entries, options));
    }

    remove(libraryIdentity, path) {
        return this.#synchronize("remove", libraryIdentity, () =>
            this.catalog.remove(libraryIdentity, path));
    }

    replaceActualPath(
        libraryIdentity,
        { sourcePath, targetPath = sourcePath, fileHandle }
    ) {
        return this.#synchronize("replace-actual-path", libraryIdentity, () => {
            this.catalog.mergeActual(libraryIdentity, [{
                path: targetPath,
                fileHandle
            }]);
            if (sourcePath !== targetPath) {
                this.catalog.remove(libraryIdentity, sourcePath);
            }
            return true;
        });
    }

    async applyCompleteLibrary({ libraryIdentity, apply, getEntries }) {

        const applied = await apply();

        if (applied) {
            this.#synchronize("replace-complete", libraryIdentity, () =>
                this.catalog.replaceFromCompleteScan(
                    libraryIdentity,
                    getEntries()
                ));
        }
        return applied;
    }

    getDiagnostic() {
        return this.lastDiagnostic;
    }

    #synchronize(operation, libraryIdentity, synchronize) {

        try {
            const value = synchronize();

            this.lastDiagnostic = diagnostic(
                operation,
                libraryIdentity,
                "success"
            );
            return value;
        } catch (error) {
            this.lastDiagnostic = diagnostic(
                operation,
                libraryIdentity,
                "failure",
                error
            );
            this.reportError(this.lastDiagnostic, error);
            return false;
        }
    }
}
