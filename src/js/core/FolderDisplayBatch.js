function clock() {

    return globalThis.performance?.now?.() ?? Date.now();
}

const pendingUnavailableRollbacks = new WeakMap();

export function queueUnavailableFolderRollback(app, path) {

    let pending = pendingUnavailableRollbacks.get(app);

    if (!pending) {
        pending = { paths: new Set(), timerId: null };
        pendingUnavailableRollbacks.set(app, pending);
    }
    pending.paths.add(path);
    if (pending.timerId !== null) return;
    pending.timerId = globalThis.setTimeout(() => {
        const paths = [...pending.paths];

        pending.paths.clear();
        pending.timerId = null;
        const batch = app.displayState.prepareDisplayBatch(paths, false);

        if (batch.paths.length === 0) return;
        app.treeView.setDisplayBatch(batch.paths.map(candidate =>
            app.displayState.getDisplay(candidate)));
        app.updateDisplayStatus();
    }, 0);
}

/** Applies one Folder checkbox request without replaying the single-Track path. */
export function applyFolderDisplayBatch(app, {
    fileEntries = [],
    checked,
    preserveMapView = false,
    preserveSelection = false,
    descendantEnumerationMs = 0
} = {}) {

    const startedAt = clock();
    const entries = new Map(fileEntries.map(entry => [entry.path, entry]));

    entries.forEach(({ path, fileHandle }) => {
        if (!app.displayState.getDisplay(path)) {
            app.displayState.registerFile(path, fileHandle, app.getColor(path));
        }
    });
    const batch = app.displayState.prepareDisplayBatch(entries.keys(), checked);

    if (batch.paths.length === 0) return Object.freeze({
        trackCount: entries.size,
        changedTrackCount: 0,
        displayNotificationCount: 0,
        treeRefreshCount: 0,
        dateSyncCount: 0,
        searchSyncCount: 0,
        snapshotScheduleCount: 0,
        mapUpdateRequestCount: 0,
        geometryLoadRequestCount: 0,
        descendantEnumerationMs,
        totalMs: clock() - startedAt
    });

    app.treeView.setDisplayBatch(batch.paths.map(path =>
        app.displayState.getDisplay(path)));
    let mapUpdateRequestCount = 0;
    let geometryLoadRequestCount = 0;

    batch.paths.forEach(path => {
        const { fileHandle } = entries.get(path);
        const display = app.displayState.getDisplay(path);

        if (checked) {
            if (display.state === "loaded") mapUpdateRequestCount += 1;
            else geometryLoadRequestCount += 1;
            app.startDisplay(path, fileHandle, {
                refocus: false,
                rollbackUnavailable: !batch.previousChecked.get(path),
                prepared: true,
                batch: true
            });
        } else {
            mapUpdateRequestCount += 1;
            app.stopDisplay(path, {
                refocus: false, preserveSelection, prepared: true, batch: true,
                requestId: batch.previousRequestIds.get(path)
            });
        }
    });
    if (!preserveMapView) app.scheduleRefocus();
    app.updateDisplayStatus();

    return Object.freeze({
        trackCount: entries.size,
        changedTrackCount: batch.paths.length,
        displayNotificationCount: 1,
        treeRefreshCount: 1,
        dateSyncCount: 1,
        searchSyncCount: 1,
        snapshotScheduleCount: 1,
        mapUpdateRequestCount,
        geometryLoadRequestCount,
        descendantEnumerationMs,
        totalMs: clock() - startedAt
    });
}
