/** Projects a DisplayState batch onto rendered Tree rows and aggregates once. */
export function applyTreeDisplayBatch(tree, displays = []) {

    const ancestors = new Set();
    let updated = 0;

    for (const display of displays) {
        const metadata = tree.nodeMetadata.get(display?.path);

        if (!metadata || metadata.kind !== "file") continue;
        metadata.checked = Boolean(display.checked);
        metadata.state = display.state || "idle";
        metadata.error = display.error || null;
        if (display.color) metadata.color = display.color;
        tree.refreshFileRow(display.path, false);
        let folderPath = metadata.parentPath;

        while (folderPath !== undefined) {
            ancestors.add(folderPath);
            if (!folderPath) break;
            folderPath = tree.parentPath(folderPath);
        }
        updated += 1;
    }
    ancestors.forEach(path => tree.refreshFolderRow(path));
    return updated;
}
