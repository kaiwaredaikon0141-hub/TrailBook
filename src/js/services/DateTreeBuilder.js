const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
});

function compareTracks(first, second) {

    const firstTime = first.resolvedDate?.getTime() ?? Number.NEGATIVE_INFINITY;
    const secondTime = second.resolvedDate?.getTime() ?? Number.NEGATIVE_INFINITY;

    return secondTime - firstTime ||
        collator.compare(first.displayName, second.displayName) ||
        collator.compare(first.relativePath, second.relativePath);
}

function groupNode(kind, key, label, children) {

    return Object.freeze({
        id: `${kind}:${key}`,
        kind,
        key,
        label,
        children: Object.freeze(children)
    });
}

/**
 * Creates a virtual year / month / day projection without copying entries.
 */
export default class DateTreeBuilder {

    build(entries = []) {

        const years = new Map();
        const unknown = [];

        entries.forEach(entry => {
            const date = entry?.resolvedDate;

            if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
                unknown.push(entry);
                return;
            }

            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();

            if (!years.has(year)) {
                years.set(year, new Map());
            }

            const months = years.get(year);

            if (!months.has(month)) {
                months.set(month, new Map());
            }

            const days = months.get(month);

            if (!days.has(day)) {
                days.set(day, []);
            }

            days.get(day).push(entry);
        });

        const nodes = [...years.entries()]
            .sort(([first], [second]) => second - first)
            .map(([year, months]) => groupNode(
                "year",
                year,
                `${year}年`,
                [...months.entries()]
                    .sort(([first], [second]) => second - first)
                    .map(([month, days]) => groupNode(
                        "month",
                        `${year}-${String(month).padStart(2, "0")}`,
                        `${month}月`,
                        [...days.entries()]
                            .sort(([first], [second]) => second - first)
                            .map(([day, tracks]) => groupNode(
                                "day",
                                [year, month, day].map(value =>
                                    String(value).padStart(2, "0")
                                ).join("-"),
                                `${day}日`,
                                [...tracks].sort(compareTracks)
                            ))
                    ))
            ));

        if (unknown.length > 0) {
            nodes.push(groupNode(
                "unknown",
                "unknown",
                "Unknown Date",
                [...unknown].sort(compareTracks)
            ));
        }

        return Object.freeze(nodes);
    }
}
