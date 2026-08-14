const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Calculates and applies one UTC offset to existing valid GPX time values.
 */
export default class TrackDateCorrectionService {

    getTrackPointTimeRange(source, offsetMs = 0) {

        const document = source?.cloneDocument?.();
        const values = document?.documentElement
            ? this.#trackPointTimeElements(document)
                .map(element => this.#parseTime(element.textContent))
                .filter(Boolean)
                .map(value => new Date(value.getTime() + offsetMs))
            : [];

        if (values.length === 0) return null;

        return Object.freeze({
            start: new Date(Math.min(...values.map(value => value.getTime()))),
            end: new Date(Math.max(...values.map(value => value.getTime())))
        });
    }

    createDateFileName(source, offsetMs = 0) {

        const range = this.getTrackPointTimeRange(source, offsetMs);

        if (!range) return null;

        const start = this.#localParts(range.start);
        const end = this.#localParts(range.end);
        let stem = `${start.year}_${start.month}_${start.day}`;

        if (start.key !== end.key) {
            if (start.year !== end.year) {
                stem += `-${end.year}_${end.month}_${end.day}`;
            } else {
                stem += `-${end.month}_${end.day}`;
            }
        }

        return `${stem}.gpx`;
    }

    isDateFileName(fileName) {

        const match = /^(\d{4})_(\d{2})_(\d{2})(?:-(?:(\d{4})_)?(\d{2})_(\d{2}))?(?:-\d{2})?\.gpx$/i
            .exec(String(fileName || ""));

        if (!match || !this.#isCalendarDate(match[1], match[2], match[3])) {
            return false;
        }

        if (!match[5]) return true;

        const endYear = match[4] || match[1];

        return this.#isCalendarDate(endYear, match[5], match[6]) &&
            Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) <=
                Date.UTC(Number(endYear), Number(match[5]) - 1, Number(match[6]));
    }

    getFirstTrackPointTime(source) {

        const document = source?.cloneDocument?.();

        if (!document?.documentElement) return null;

        for (const timeElement of this.#trackPointTimeElements(document)) {
            const value = this.#parseTime(timeElement.textContent);
            if (value) return value;
        }

        return null;
    }

    calculateOffset(source, dateText) {

        const first = this.getFirstTrackPointTime(source);

        if (!first) {
            throw this.#error(
                "TRACK_TIME_UNAVAILABLE",
                "有効なTrack Point timeがないため日付を修正できません。"
            );
        }

        const match = ISO_DATE.exec(String(dateText || ""));

        if (!match) {
            throw this.#error("INVALID_DATE", "日付をYYYY-MM-DDで指定してください。");
        }

        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        const day = Number(match[3]);
        const target = new Date(
            year,
            monthIndex,
            day,
            first.getHours(),
            first.getMinutes(),
            first.getSeconds(),
            first.getMilliseconds()
        );

        if (
            target.getFullYear() !== year ||
            target.getMonth() !== monthIndex ||
            target.getDate() !== day
        ) {
            throw this.#error("INVALID_DATE", "存在する日付を指定してください。");
        }

        return target.getTime() - first.getTime();
    }

    apply(document, offsetMs) {

        if (!Number.isFinite(offsetMs)) {
            throw new TypeError("Track time offset must be finite");
        }

        if (offsetMs === 0) return 0;

        let changed = 0;
        const root = document?.documentElement;
        const metadata = this.#children(root, "metadata")[0];
        const metadataTime = this.#children(metadata, "time")[0];

        if (this.#shift(metadataTime, offsetMs)) changed += 1;

        this.#trackPointTimeElements(document).forEach(timeElement => {
            if (this.#shift(timeElement, offsetMs)) changed += 1;
        });

        return changed;
    }

    #trackPointTimeElements(document) {

        const values = [];

        this.#children(document?.documentElement, "trk").forEach(track => {
            this.#children(track, "trkseg").forEach(segment => {
                this.#children(segment, "trkpt").forEach(point => {
                    const time = this.#children(point, "time")[0];
                    if (time) values.push(time);
                });
            });
        });

        return values;
    }

    #shift(element, offsetMs) {

        const value = this.#parseTime(element?.textContent);

        if (!value) return false;

        element.textContent = this.#formatShifted(
            element.textContent.trim(),
            value.getTime() + offsetMs
        );
        return true;
    }

    #formatShifted(original, shiftedTimestamp) {

        const match = ISO_TIME.exec(original);
        const suffix = match[2];
        const offsetMinutes = suffix === "Z"
            ? 0
            : (match[3] === "+" ? 1 : -1) *
                (Number(match[4]) * 60 + Number(match[5]));
        const local = new Date(shiftedTimestamp + offsetMinutes * 60 * 1000);
        const date = [
            local.getUTCFullYear(),
            String(local.getUTCMonth() + 1).padStart(2, "0"),
            String(local.getUTCDate()).padStart(2, "0")
        ].join("-");
        const time = [
            String(local.getUTCHours()).padStart(2, "0"),
            String(local.getUTCMinutes()).padStart(2, "0"),
            String(local.getUTCSeconds()).padStart(2, "0")
        ].join(":");

        return `${date}T${time}${match[1] || ""}${suffix}`;
    }

    #parseTime(value) {

        const text = String(value || "").trim();

        if (!ISO_TIME.test(text)) return null;

        const date = new Date(text);
        return Number.isFinite(date.getTime()) ? date : null;
    }

    #localParts(value) {

        const year = String(value.getFullYear()).padStart(4, "0");
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");

        return { year, month, day, key: `${year}-${month}-${day}` };
    }

    #isCalendarDate(yearText, monthText, dayText) {

        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        const value = new Date(Date.UTC(year, month - 1, day));

        return value.getUTCFullYear() === year &&
            value.getUTCMonth() === month - 1 &&
            value.getUTCDate() === day;
    }

    #children(element, localName) {

        return Array.from(element?.children || []).filter(
            child => child.localName === localName
        );
    }

    #error(code, message) {

        const error = new Error(message);
        error.code = code;
        return error;
    }
}
