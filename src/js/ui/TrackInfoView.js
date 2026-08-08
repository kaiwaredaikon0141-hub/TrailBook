import { DATE_SOURCES } from "../models/TrackDiscoveryEntry.js";

const EMPTY_VALUE = "—";
const DATE_SOURCE_LABELS = Object.freeze({
    [DATE_SOURCES.METADATA]: "GPX metadata",
    [DATE_SOURCES.TRACK_POINT]: "最初のTrackPoint",
    [DATE_SOURCES.FILE_MODIFIED]: "ファイル更新日時",
    [DATE_SOURCES.FILE_NAME]: "ファイル名",
    [DATE_SOURCES.UNKNOWN]: EMPTY_VALUE
});

/**
 * Read-only presentation of one selected Discovery Index entry.
 */
export default class TrackInfoView {

    constructor() {

        this.element = this.#create();
        this.state = this.element.querySelector(".track-info-state");
        this.fields = new Map(
            [...this.element.querySelectorAll("[data-track-info-field]")]
                .map(node => [node.dataset.trackInfoField, node])
        );
        this.showEmpty();
    }

    showEmpty() {

        this.state.textContent = "Trackを選択すると情報を表示します。";
        this.#setAllEmpty();
    }

    showLoading() {

        this.state.textContent = "Track情報を読み込み中…";
        this.#setAllEmpty();
    }

    showUnavailable() {

        this.state.textContent = "このTrackの情報を表示できません。";
        this.#setAllEmpty();
    }

    showEntry(entry) {

        if (!entry || typeof entry !== "object") {
            this.showUnavailable();
            return;
        }

        const complete = entry.status === "ready";

        this.state.textContent = complete
            ? "選択中のTrack情報"
            : "一部の情報を取得できませんでした。";
        this.#set("displayName", entry.displayName);
        this.#set("folderPath", entry.folderPath || "Library root");
        this.#set("resolvedDate", this.#formatDate(entry.resolvedDate));
        this.#set("dateSource", DATE_SOURCE_LABELS[entry.dateSource]);
        this.#set("distance", complete
            ? this.#formatDistance(entry.distance)
            : EMPTY_VALUE);
        this.#set("pointCount", complete
            ? this.#formatCount(entry.pointCount)
            : EMPTY_VALUE);
        this.#set("startTime", complete
            ? this.#formatDate(entry.startTime)
            : EMPTY_VALUE);
        this.#set("endTime", complete
            ? this.#formatDate(entry.endTime)
            : EMPTY_VALUE);
        this.#set("duration", complete
            ? this.#formatDuration(entry.duration)
            : EMPTY_VALUE);
        this.#set("elevationMin", complete
            ? this.#formatElevation(entry.elevationMin)
            : EMPTY_VALUE);
        this.#set("elevationMax", complete
            ? this.#formatElevation(entry.elevationMax)
            : EMPTY_VALUE);
    }

    #create() {

        const section = document.createElement("section");

        section.className = "track-info";
        section.setAttribute("aria-labelledby", "track-info-title");
        section.innerHTML = `
            <h4 id="track-info-title" class="track-info-title">Track Info</h4>
            <p class="track-info-state" aria-live="polite"></p>
            <dl class="track-info-list">
                <dt>名前</dt><dd data-track-info-field="displayName"></dd>
                <dt>Folder</dt><dd data-track-info-field="folderPath"></dd>
                <dt>記録日時</dt><dd data-track-info-field="resolvedDate"></dd>
                <dt>日付Source</dt><dd data-track-info-field="dateSource"></dd>
                <dt>距離</dt><dd data-track-info-field="distance"></dd>
                <dt>Point数</dt><dd data-track-info-field="pointCount"></dd>
                <dt>開始</dt><dd data-track-info-field="startTime"></dd>
                <dt>終了</dt><dd data-track-info-field="endTime"></dd>
                <dt>所要時間</dt><dd data-track-info-field="duration"></dd>
                <dt>最低標高</dt><dd data-track-info-field="elevationMin"></dd>
                <dt>最高標高</dt><dd data-track-info-field="elevationMax"></dd>
            </dl>
        `;

        return section;
    }

    #setAllEmpty() {

        this.fields.forEach(node => {
            node.textContent = EMPTY_VALUE;
        });
    }

    #set(field, value) {

        const node = this.fields.get(field);

        if (node) {
            node.textContent = value === null || value === undefined || value === ""
                ? EMPTY_VALUE
                : String(value);
        }
    }

    #formatDate(value) {

        if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
            return EMPTY_VALUE;
        }

        return new Intl.DateTimeFormat("ja-JP", {
            dateStyle: "medium",
            timeStyle: "medium"
        }).format(value);
    }

    #formatDistance(value) {

        if (!Number.isFinite(value) || value < 0) return EMPTY_VALUE;

        if (value < 1000) {
            return `${Math.round(value).toLocaleString("ja-JP")} m`;
        }

        return `${(value / 1000).toLocaleString("ja-JP", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2
        })} km`;
    }

    #formatCount(value) {

        return Number.isInteger(value) && value >= 0
            ? value.toLocaleString("ja-JP")
            : EMPTY_VALUE;
    }

    #formatDuration(value) {

        if (!Number.isFinite(value) || value < 0) return EMPTY_VALUE;

        const totalSeconds = Math.round(value / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];

        if (hours) parts.push(`${hours}時間`);
        if (minutes) parts.push(`${minutes}分`);
        if (seconds || parts.length === 0) parts.push(`${seconds}秒`);

        return parts.join(" ");
    }

    #formatElevation(value) {

        return Number.isFinite(value)
            ? `${value.toLocaleString("ja-JP", {
                maximumFractionDigits: 1
            })} m`
            : EMPTY_VALUE;
    }
}
