function timestamp(value) {

    if (value === null || value === undefined) return null;

    const candidate = value instanceof Date
        ? value.getTime()
        : typeof value === "string"
            ? new Date(value).getTime()
            : Number(value);

    return Number.isFinite(candidate) ? candidate : null;
}

function compareText(first, second) {

    const base = first.localeCompare(second, undefined, {
        sensitivity: "base"
    });

    return base || first.localeCompare(second);
}

/**
 * Presentation-only ordering derived from canonical Discovery metadata.
 */
export default class TrackTreeOrder {

    constructor() {
        this.timestamps = new Map();
        this.signature = "";
    }

    setEntries(entries = []) {

        const timestamps = new Map();

        entries.forEach(entry => {
            if (!entry?.relativePath) return;

            timestamps.set(
                entry.relativePath,
                timestamp(entry.startTime) ?? timestamp(entry.resolvedDate)
            );
        });

        const signature = [...timestamps.entries()]
            .sort(([first], [second]) => compareText(first, second))
            .map(([path, time]) => `${path}\u0000${time ?? ""}`)
            .join("\u0001");

        if (signature === this.signature) return false;

        this.timestamps = timestamps;
        this.signature = signature;
        return true;
    }

    clear() {

        return this.setEntries([]);
    }

    compare(firstPath, secondPath) {

        const firstTime = this.timestamps.get(firstPath);
        const secondTime = this.timestamps.get(secondPath);
        const firstDated = Number.isFinite(firstTime);
        const secondDated = Number.isFinite(secondTime);

        if (firstDated && secondDated && firstTime !== secondTime) {
            return secondTime - firstTime;
        }
        if (firstDated !== secondDated) return firstDated ? -1 : 1;

        return compareText(firstPath, secondPath);
    }
}
