import { isValidLibraryId } from "./LibraryIdentity.js";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const TOP_LEVEL_FIELDS = new Set(["version", "libraries"]);

function createDictionary() {

    return Object.create(null);
}

function isPlainObject(value) {

    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function hasOnlyFields(value, allowedFields) {

    return Object.keys(value).every(key => allowedFields.has(key));
}

export function isValidGPXPath(path) {

    if (
        typeof path !== "string" ||
        path.length === 0 ||
        path.startsWith("/") ||
        path.endsWith("/") ||
        path.includes("//") ||
        path.includes("\\") ||
        CONTROL_CHARACTER_PATTERN.test(path)
    ) {
        return false;
    }

    return path.split("/").every(segment => (
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !DANGEROUS_KEYS.has(segment)
    ));
}

export function createDefaultLibraryViewState({
    sidebarDefaultWidth = 260,
    trackInfoDefaultHeight = 220
} = {}) {

    return {
        map: null,
        visibleTracks: [],
        selectedTrack: null,
        sidebar: {
            open: true,
            width: sidebarDefaultWidth,
            trackInfoHeight: trackInfoDefaultHeight
        }
    };
}

export function createEmptyViewStateDocument(version = 1) {

    return {
        version,
        libraries: createDictionary()
    };
}

function normalizeMap(map, { minZoom, maxZoom }) {

    if (!isPlainObject(map)) {
        return null;
    }

    const { lat, lng, zoom } = map;

    if (
        !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180 ||
        !Number.isFinite(zoom) || zoom < minZoom || zoom > maxZoom
    ) {
        return null;
    }

    return { lat, lng, zoom };
}

function normalizeVisibleTracks(value, maxVisibleTracks) {

    if (!Array.isArray(value) || value.length > maxVisibleTracks) {
        return [];
    }

    if (!value.every(isValidGPXPath)) {
        return [];
    }

    return [...new Set(value)];
}

export function normalizeLibraryViewState(value, options) {

    if (!isPlainObject(value)) {
        return null;
    }

    const normalized = createDefaultLibraryViewState(options);

    normalized.map = normalizeMap(value.map, options);
    normalized.visibleTracks = normalizeVisibleTracks(
        value.visibleTracks,
        options.maxVisibleTracks
    );
    normalized.selectedTrack = isValidGPXPath(value.selectedTrack)
        ? value.selectedTrack
        : null;
    normalized.sidebar.open = isPlainObject(value.sidebar) &&
        typeof value.sidebar.open === "boolean"
        ? value.sidebar.open
        : true;
    const sidebarMinWidth = Number.isFinite(options.sidebarMinWidth)
        ? options.sidebarMinWidth
        : 220;
    const sidebarMaxWidth = Number.isFinite(options.sidebarMaxWidth)
        ? options.sidebarMaxWidth
        : 520;
    const sidebarDefaultWidth = Number.isFinite(options.sidebarDefaultWidth)
        ? options.sidebarDefaultWidth
        : 260;
    normalized.sidebar.width = isPlainObject(value.sidebar) &&
        Number.isFinite(value.sidebar.width) &&
        value.sidebar.width >= sidebarMinWidth &&
        value.sidebar.width <= sidebarMaxWidth
        ? Math.round(value.sidebar.width)
        : sidebarDefaultWidth;
    const trackInfoMinHeight = Number.isFinite(options.trackInfoMinHeight)
        ? options.trackInfoMinHeight
        : 120;
    const trackInfoMaxHeight = Number.isFinite(options.trackInfoMaxHeight)
        ? options.trackInfoMaxHeight
        : 420;
    const trackInfoDefaultHeight = Number.isFinite(options.trackInfoDefaultHeight)
        ? options.trackInfoDefaultHeight
        : 220;
    normalized.sidebar.trackInfoHeight = isPlainObject(value.sidebar) &&
        Number.isFinite(value.sidebar.trackInfoHeight) &&
        value.sidebar.trackInfoHeight >= trackInfoMinHeight &&
        value.sidebar.trackInfoHeight <= trackInfoMaxHeight
        ? Math.round(value.sidebar.trackInfoHeight)
        : trackInfoDefaultHeight;

    return normalized;
}

export function normalizeViewStateDocument(payload, options) {

    if (
        !isPlainObject(payload) ||
        !hasOnlyFields(payload, TOP_LEVEL_FIELDS) ||
        payload.version !== options.schemaVersion ||
        !isPlainObject(payload.libraries)
    ) {
        return null;
    }

    const normalized = createEmptyViewStateDocument(options.schemaVersion);

    for (const libraryId of Object.keys(payload.libraries)) {
        const libraryState = normalizeLibraryViewState(
            payload.libraries[libraryId],
            options
        );

        if (!isValidLibraryId(libraryId) || !libraryState) {
            continue;
        }

        normalized.libraries[libraryId] = libraryState;
    }

    return normalized;
}

export function cloneLibraryViewState(state) {

    return {
        map: state.map ? { ...state.map } : null,
        visibleTracks: [...state.visibleTracks],
        selectedTrack: state.selectedTrack,
        sidebar: {
            open: state.sidebar.open,
            width: state.sidebar.width,
            trackInfoHeight: state.sidebar.trackInfoHeight
        }
    };
}

export function serializeViewStateDocument(document) {

    const libraries = createDictionary();

    Object.keys(document.libraries).sort().forEach(libraryId => {
        libraries[libraryId] = cloneLibraryViewState(
            document.libraries[libraryId]
        );
    });

    return JSON.stringify({ version: document.version, libraries });
}
