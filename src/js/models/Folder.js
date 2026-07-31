/**
 * A directory represented in the TrailBook library.
 */
export default class Folder {

    /**
     * @param {string} name
     * @param {FileSystemDirectoryHandle} handle
     */
    constructor(name, handle) {

        this.name = name;

        this.handle = handle;

        this.folders = [];

        this.gpxFiles = [];
    }

}