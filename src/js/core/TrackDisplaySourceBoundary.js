import { isTrackSourceUnavailable } from "./TrackSourceResolver.js";
import { queueUnavailableFolderRollback } from "./FolderDisplayBatch.js";

/** Settles a Viewer request that has no actual Catalog source without an error. */
export function settleUnavailableTrackDisplay(
    app,
    path,
    result,
    { rollbackRequested = false, batchRequested = false } = {}
) {

    if (!isTrackSourceUnavailable(result)) return false;
    if (!rollbackRequested) return true;
    if (batchRequested) {
        queueUnavailableFolderRollback(app, path);
        return true;
    }
    app.displayState.setChecked(path, false);
    app.displayState.setIdle(path);
    app.treeView.setDisplayIdle(path);
    app.treeView.setDisplayChecked(path, false);
    app.updateDisplayStatus();
    app.scheduleSearchRefresh();
    return true;
}
