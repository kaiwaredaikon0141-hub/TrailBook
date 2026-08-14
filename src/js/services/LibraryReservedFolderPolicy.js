export const TRAILBOOK_BACKUP_FOLDER_NAME = "TrailBook_Backup";

/**
 * Keeps TrailBook-owned folders outside every Library projection.
 */
export function isReservedLibraryFolderName(name) {

    return String(name || "").toLowerCase() ===
        TRAILBOOK_BACKUP_FOLDER_NAME.toLowerCase();
}
