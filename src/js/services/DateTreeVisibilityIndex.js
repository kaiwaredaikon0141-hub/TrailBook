/**
 * Indexes Date groups to GPX paths and derives visibility from DisplayState.
 */
export default class DateTreeVisibilityIndex {

    constructor() {

        this.entriesByGroup = new Map();
        this.groupIdsByPath = new Map();
    }

    setGroups(groups) {

        this.clear();
        this.#index(groups);
    }

    clear() {

        this.entriesByGroup.clear();
        this.groupIdsByPath.clear();
    }

    getGroupIds(path) {

        return this.groupIdsByPath.get(path) || [];
    }

    getState(groupId, getDisplay) {

        const entries = this.entriesByGroup.get(groupId) || [];
        const checkedCount = entries.reduce((count, entry) => (
            count + (getDisplay(entry.relativePath)?.checked ? 1 : 0)
        ), 0);

        return {
            disabled: entries.length === 0,
            checked: entries.length > 0 && checkedCount === entries.length,
            indeterminate: checkedCount > 0 && checkedCount < entries.length
        };
    }

    getFileEntries(groupId, fileHandles) {

        return (this.entriesByGroup.get(groupId) || [])
            .map(entry => ({
                path: entry.relativePath,
                fileHandle: fileHandles.get(entry.relativePath)
            }))
            .filter(entry => entry.fileHandle);
    }

    #index(groups, ancestors = []) {

        groups.forEach(group => {
            const entries = this.#collect(group);
            const groupIds = [...ancestors, group.id];

            this.entriesByGroup.set(group.id, entries);
            entries.forEach(entry => {
                const ids = this.groupIdsByPath.get(entry.relativePath) || [];

                groupIds.forEach(id => {
                    if (!ids.includes(id)) ids.push(id);
                });
                this.groupIdsByPath.set(entry.relativePath, ids);
            });
            this.#index(
                group.children.filter(child => !child.relativePath),
                groupIds
            );
        });
    }

    #collect(group) {

        return group.children.flatMap(child => (
            child.relativePath ? [child] : this.#collect(child)
        ));
    }
}
