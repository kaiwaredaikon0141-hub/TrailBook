const UNKNOWN_DATE = "日付不明";
const EDGE_MARGIN = 8;
const STATUS_BAR_CLEARANCE = 36;
const TAP_GAP = 12;

function formatDate(value) {

    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
        return UNKNOWN_DATE;
    }

    return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(value);
}

function clamp(value, minimum, maximum) {

    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/** Presents one resolved Track date near an actual mobile Map tap. */
export default class MobileTrackDatePopover {

    constructor() {

        this.container = null;
        this.element = this.#create();
    }

    attach(container) {

        this.container = container;
        container.append(this.element);
    }

    show(entry, point, path = null) {

        if (
            !this.container ||
            !Number.isFinite(point?.x) ||
            !Number.isFinite(point?.y)
        ) {
            this.hide();
            return false;
        }

        this.element.textContent = formatDate(entry?.resolvedDate);
        this.element.dataset.trackPath = path || "";
        this.element.hidden = false;
        this.#position(point);
        return true;
    }

    hide() {

        this.element.hidden = true;
        this.element.textContent = "";
        delete this.element.dataset.trackPath;
    }

    #position(point) {

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const popoverWidth = this.element.offsetWidth;
        const popoverHeight = this.element.offsetHeight;
        const maximumLeft = width - popoverWidth - EDGE_MARGIN;
        const maximumTop = height - popoverHeight - STATUS_BAR_CLEARANCE;
        const left = clamp(
            point.x - popoverWidth / 2,
            EDGE_MARGIN,
            maximumLeft
        );
        const above = point.y - popoverHeight - TAP_GAP;
        const preferredTop = above >= EDGE_MARGIN
            ? above
            : point.y + TAP_GAP;
        const top = clamp(preferredTop, EDGE_MARGIN, maximumTop);

        this.element.style.left = `${Math.round(left)}px`;
        this.element.style.top = `${Math.round(top)}px`;
    }

    #create() {

        const element = document.createElement("output");

        element.className = "mobile-track-date-popover";
        element.setAttribute("aria-live", "polite");
        element.hidden = true;
        return element;
    }
}

export { formatDate as formatMobileTrackDate };
