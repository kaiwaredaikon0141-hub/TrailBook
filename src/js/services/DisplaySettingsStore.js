const DEFAULT_STORAGE_KEY = "trailbook.uiSettings";
const DEFAULT_SCHEMA_VERSION = 1;
const EMPTY_ROOT_NAME = "unnamed";
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const DEFAULT_MAP_MODE = "color";
const MAP_MODES = new Set([DEFAULT_MAP_MODE, "monochrome"]);

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

function isSafeKey(value) {

    return typeof value === "string" &&
        !DANGEROUS_KEYS.has(value) &&
        !CONTROL_CHARACTER_PATTERN.test(value);
}

function isValidLibraryId(libraryId) {

    return isSafeKey(libraryId) &&
        libraryId.startsWith("root-name:") &&
        libraryId.length > "root-name:".length;
}

function isValidFolderPath(folderPath) {

    if (!isSafeKey(folderPath)) {
        return false;
    }

    if (folderPath === "") {
        return true;
    }

    if (
        folderPath.startsWith("/") ||
        folderPath.endsWith("/") ||
        folderPath.includes("//") ||
        folderPath.includes("\\")
    ) {
        return false;
    }

    return folderPath.split("/").every(segment => (
        segment.length > 0 && !DANGEROUS_KEYS.has(segment)
    ));
}

function normalizeColor(color) {

    if (typeof color !== "string") {
        return null;
    }

    const normalized = color.trim();
    const match = normalized.match(HEX_COLOR_PATTERN);

    if (!match) {
        return null;
    }

    const hex = match[1];

    return `#${(
        hex.length === 3
            ? [...hex].map(character => character.repeat(2)).join("")
            : hex
    ).toUpperCase()}`;
}

function normalizeMapMode(mode) {

    return MAP_MODES.has(mode) ? mode : DEFAULT_MAP_MODE;
}

function createDefaultSettings(schemaVersion) {

    return {
        version: schemaVersion,
        global: {
            mapMode: DEFAULT_MAP_MODE
        },
        libraries: createDictionary()
    };
}

function sanitizePayload(payload, schemaVersion) {

    if (
        !isPlainObject(payload) ||
        payload.version !== schemaVersion ||
        !isPlainObject(payload.libraries)
    ) {
        return null;
    }

    const settings = createDefaultSettings(schemaVersion);

    if (isPlainObject(payload.global)) {
        settings.global.mapMode = normalizeMapMode(payload.global.mapMode);
    }

    Object.keys(payload.libraries).forEach(libraryId => {
        const library = payload.libraries[libraryId];

        if (
            !isValidLibraryId(libraryId) ||
            !isPlainObject(library) ||
            !isPlainObject(library.folderColors)
        ) {
            return;
        }

        const folderColors = createDictionary();

        Object.keys(library.folderColors).forEach(folderPath => {
            const color = normalizeColor(library.folderColors[folderPath]);

            if (isValidFolderPath(folderPath) && color) {
                folderColors[folderPath] = color;
            }
        });

        settings.libraries[libraryId] = { folderColors };
    });

    return settings;
}

function getDefaultStorage() {

    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/**
 * Creates the Release 1.1 Library identity without filesystem access.
 */
export function createLibraryId(rootFolderName) {

    const trimmedName = typeof rootFolderName === "string"
        ? rootFolderName.trim()
        : "";
    const normalizedName = trimmedName || EMPTY_ROOT_NAME;

    return `root-name:${encodeURIComponent(normalizedName)}`;
}

/**
 * Persists regenerable UI settings while retaining an in-memory fallback.
 */
export default class DisplaySettingsStore {

    constructor({
        storage = getDefaultStorage(),
        storageKey = DEFAULT_STORAGE_KEY,
        schemaVersion = DEFAULT_SCHEMA_VERSION
    } = {}) {

        this.storage = storage;
        this.storageKey = storageKey;
        this.schemaVersion = schemaVersion;
        this.activeLibraryId = null;
        this.settings = createDefaultSettings(schemaVersion);
        this.persistenceStatus = storage ? "available" : "session-only";
        this.loadStatus = "empty";
        this.#load();
    }

    setActiveLibrary(rootFolderName) {

        this.activeLibraryId = createLibraryId(rootFolderName);

        return this.activeLibraryId;
    }

    getActiveLibraryId() {

        return this.activeLibraryId;
    }

    getMapMode() {

        return normalizeMapMode(this.settings.global?.mapMode);
    }

    setMapMode(mode) {

        const normalizedMode = normalizeMapMode(mode);

        if (this.getMapMode() === normalizedMode) {
            return false;
        }

        this.settings.global.mapMode = normalizedMode;
        this.#save();

        return true;
    }

    getFolderColors(libraryId) {

        if (!isValidLibraryId(libraryId)) {
            return createDictionary();
        }

        const folderColors = this.settings.libraries[libraryId]?.folderColors;

        return folderColors
            ? Object.assign(createDictionary(), folderColors)
            : createDictionary();
    }

    getFolderColor(libraryId, folderPath) {

        if (!isValidLibraryId(libraryId) || !isValidFolderPath(folderPath)) {
            return null;
        }

        const folderColors = this.settings.libraries[libraryId]?.folderColors;

        return folderColors && Object.hasOwn(folderColors, folderPath)
            ? folderColors[folderPath]
            : null;
    }

    setFolderColor(libraryId, folderPath, color) {

        const normalizedColor = normalizeColor(color);

        if (
            !isValidLibraryId(libraryId) ||
            !isValidFolderPath(folderPath) ||
            !normalizedColor
        ) {
            return false;
        }

        const folderColors = this.#getOrCreateFolderColors(libraryId);

        if (folderColors[folderPath] === normalizedColor) {
            return false;
        }

        folderColors[folderPath] = normalizedColor;
        this.#save();

        return true;
    }

    removeFolderColor(libraryId, folderPath) {

        if (!isValidLibraryId(libraryId) || !isValidFolderPath(folderPath)) {
            return false;
        }

        const folderColors = this.settings.libraries[libraryId]?.folderColors;

        if (!folderColors || !Object.hasOwn(folderColors, folderPath)) {
            return false;
        }

        delete folderColors[folderPath];
        this.#save();

        return true;
    }

    clearLibraryFolderColors(libraryId) {

        if (!isValidLibraryId(libraryId)) {
            return false;
        }

        const library = this.settings.libraries[libraryId];

        if (!library || Object.keys(library.folderColors).length === 0) {
            return false;
        }

        library.folderColors = createDictionary();
        this.#save();

        return true;
    }

    getStatus() {

        return {
            persistence: this.persistenceStatus,
            load: this.loadStatus
        };
    }

    #getOrCreateFolderColors(libraryId) {

        if (!Object.hasOwn(this.settings.libraries, libraryId)) {
            this.settings.libraries[libraryId] = {
                folderColors: createDictionary()
            };
        }

        return this.settings.libraries[libraryId].folderColors;
    }

    #load() {

        if (!this.storage) {
            return;
        }

        try {
            const serialized = this.storage.getItem(this.storageKey);

            if (typeof serialized !== "string" || serialized.trim() === "") {
                return;
            }

            const settings = sanitizePayload(
                JSON.parse(serialized),
                this.schemaVersion
            );

            if (!settings) {
                this.persistenceStatus = "session-only";
                this.loadStatus = "invalid";
                this.storage = null;
                return;
            }

            this.settings = settings;
            this.loadStatus = "loaded";
        } catch {
            this.persistenceStatus = "session-only";
            this.loadStatus = "failed";
            this.storage = null;
        }
    }

    #save() {

        if (!this.storage) {
            return false;
        }

        try {
            this.storage.setItem(
                this.storageKey,
                JSON.stringify(this.settings)
            );
            this.persistenceStatus = "available";

            return true;
        } catch {
            this.persistenceStatus = "session-only";
            this.storage = null;

            return false;
        }
    }
}
