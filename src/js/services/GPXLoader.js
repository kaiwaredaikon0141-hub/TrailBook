/**
 * Loads GPX text from a FileSystemFileHandle without parsing it.
 */
export default class GPXLoader {

    /**
     * @param {FileSystemFileHandle} fileHandle
     * @returns {Promise<{text: string, sourceFileName: string}>}
     */
    async load(fileHandle) {

        const file = await fileHandle.getFile();

        return {
            text: await file.text(),
            sourceFileName: fileHandle.name
        };
    }

}