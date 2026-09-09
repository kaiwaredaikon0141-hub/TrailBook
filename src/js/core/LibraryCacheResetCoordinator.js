const CONFIRM_MESSAGE =
    "TrailBookが保存しているLibraryのキャッシュと復元情報を削除します。\n" +
    "GPXファイルとtrailbook.jsonは変更されません。\n" +
    "続行しますか？";

function clearTree(treeView) {

    treeView.renderRequestId += 1;
    treeView.commitPreparedLibrary({
        library: null,
        rootHandle: null,
        nodeMetadata: new Map(),
        fileHandlesByPath: new Map(),
        pathsByFileHandle: new Map()
    }, new Set([""]), "");
    treeView.element.querySelector(".tree-root")?.replaceChildren();
}

/** Clears Library-derived runtime presentation without touching Library files. */
export function clearLibraryRuntime(app) {

    app.currentLibrary = null;
    app.currentLibraryId = null;
    app.clearSelection("library-cache-reset");
    app.displayQueue.clear();
    app.displayState.clearLibrary();
    app.mapView.clear();
    app.mapView.resetView();
    app.trackDiscoveryCoordinator.clearLibrary();
    app.librarySnapshotService.reset();
    app.libraryTrackCatalogCoordinator.clear();
    app.folderColorControl.setProvisionalPresentations(new Map());
    app.gpxGeometryLoader.setLibraryNamespace(null);
    clearTree(app.treeView);
    app.searchView.setAvailable(false);
    app.librarySettingsPanel.setAvailable(false);
    app.viewStateControls.setStoredStateAvailable(false);
    app.previousLibraryCoordinator.resetPersistenceState();
}

/** Coordinates a confirmed, best-effort reset of regenerable Library caches. */
export default class LibraryCacheResetCoordinator {

    constructor({
        eventBus,
        panel,
        prepare = async () => {},
        clearers = [],
        clearRuntime = () => {},
        onFailure = () => {},
        setBusy = () => {},
        confirmReset = message => globalThis.confirm?.(message) === true,
        reportError = (message, detail) => console.error(message, detail)
    }) {

        Object.assign(this, {
            eventBus, panel, prepare, clearers, clearRuntime, onFailure, setBusy,
            confirmReset, reportError
        });
        this.running = false;
    }

    bind() {

        this.eventBus.on("library-cache:reset-requested", () => {
            void this.reset();
        });
    }

    async reset() {

        if (this.running || !this.confirmReset(CONFIRM_MESSAGE)) {
            return { status: "cancelled", failures: [] };
        }
        this.running = true;
        this.setBusy(true);
        this.panel?.setCacheResetState("running");

        try {
            await this.prepare();
            const failures = [];

            for (const { name, clear } of this.clearers) {
                try {
                    if (await clear() !== true) failures.push(name);
                } catch (error) {
                    failures.push(name);
                    this.reportError(`Library cache reset failed: ${name}`, error);
                }
            }
            if (failures.length > 0) {
                this.reportError("Library cache reset was incomplete.", {
                    failures
                });
                this.onFailure(failures);
                this.panel?.setCacheResetState("failed");
                return { status: "failed", failures };
            }

            await this.clearRuntime();
            this.panel?.setCacheResetState("success");
            return { status: "success", failures: [] };
        } catch (error) {
            this.reportError("Library cache reset failed.", error);
            this.onFailure(["runtime"]);
            this.panel?.setCacheResetState("failed");
            return { status: "failed", failures: ["runtime"] };
        } finally {
            this.running = false;
            this.setBusy(false);
        }
    }
}
