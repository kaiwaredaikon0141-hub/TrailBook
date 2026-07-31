/**
 * The collection represented by a selected root directory.
 */
export default class Library {

    /**
     * @param {string} name
     * @param {import("./Folder.js").default} rootFolder
     * @param {number} folderCount
     * @param {number} gpxFileCount
     */
    constructor(name, rootFolder, folderCount, gpxFileCount) {

        this.name = name;

        this.rootFolder = rootFolder;

        this.folderCount = folderCount;

        this.gpxFileCount = gpxFileCount;
    }

}