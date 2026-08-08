/**
 * Loads GPX text from a FileSystemFileHandle without parsing it.
 */
export default class GPXLoader {

    async getFile(fileHandle) {

        return fileHandle.getFile();
    }

    /**
     * @param {FileSystemFileHandle} fileHandle
     * @returns {Promise<{text: string, sourceFileName: string}>}
     */
    async load(fileHandle) {

        const file = await this.getFile(fileHandle);

        return {
            text: await file.text(),
            sourceFileName: fileHandle.name
        };
    }

}
