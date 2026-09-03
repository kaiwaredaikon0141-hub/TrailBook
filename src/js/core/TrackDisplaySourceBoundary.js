import { isTrackSourceUnavailable } from "./TrackSourceResolver.js";

/** Settles a Viewer request that has no actual Catalog source without an error. */
export function settleUnavailableTrackDisplay(
    app,
    path,
    result,
    { rollbackRequested = false } = {}
) {

    if (!isTrackSourceUnavailable(result)) return false;
    if (!rollbackRequested) return true;
    app.displayState.setChecked(path, false);
    app.displayState.setIdle(path);
    app.treeView.setDisplayIdle(path);
    app.treeView.setDisplayChecked(path, false);
    app.updateDisplayStatus();
    app.scheduleSearchRefresh();
    return true;
}
