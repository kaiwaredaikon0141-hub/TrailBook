const DANGEROUS_KEYS = new Set([
    "__proto__",
    "constructor",
    "prototype"
]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const TOP_LEVEL_FIELDS = new Set(["schemaVersion", "settings"]);
const SETTINGS_FIELDS = new Set(["folderColors"]);

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

function isValidFolderPath(folderPath) {

    if (
        typeof folderPath !== "string" ||
        CONTROL_CHARACTER_PATTERN.test(folderPath) ||
        DANGEROUS_KEYS.has(folderPath)
    ) {
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
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !DANGEROUS_KEYS.has(segment)
    ));
}

function normalizeColor(color) {

    if (typeof color !== "string") {
        return null;
    }

    const match = color.trim().match(HEX_COLOR_PATTERN);

    if (!match) {
        return null;
    }

    const hex = match[1];
    const expanded = hex.length === 3
        ? [...hex].map(character => character.repeat(2)).join("")
        : hex;

    return `#${expanded.toUpperCase()}`;
}

export function createEmptySharedSettingsSnapshot(schemaVersion) {

    return {
        schemaVersion,
        folderColors: createDictionary()
    };
}

/**
 * Validates and normalizes the complete shared settings document.
 * Mixed valid and invalid entries fail closed.
 */
export function normalizeSharedSettings(payload, schemaVersion) {

    if (!isPlainObject(payload) || !hasOnlyFields(payload, TOP_LEVEL_FIELDS)) {
        return { snapshot: null, errorCode: "invalid-structure" };
    }

    if (payload.schemaVersion !== schemaVersion) {
        return { snapshot: null, errorCode: "unsupported-schema" };
    }

    if (
        !isPlainObject(payload.settings) ||
        !hasOnlyFields(payload.settings, SETTINGS_FIELDS) ||
        !isPlainObject(payload.settings.folderColors)
    ) {
        return { snapshot: null, errorCode: "invalid-structure" };
    }

    const folderColors = createDictionary();
    const folderPaths = Object.keys(payload.settings.folderColors).sort();

    for (const folderPath of folderPaths) {
        const color = normalizeColor(
            payload.settings.folderColors[folderPath]
        );

        if (!isValidFolderPath(folderPath) || !color) {
            return { snapshot: null, errorCode: "invalid-structure" };
        }

        folderColors[folderPath] = color;
    }

    return {
        snapshot: {
            schemaVersion,
            folderColors
        },
        errorCode: null
    };
}

/**
 * Serializes only a validated normalized snapshot using the shared format.
 */
export function serializeSharedSettings(snapshot, schemaVersion) {

    const normalized = normalizeSharedSettings({
        schemaVersion,
        settings: {
            folderColors: snapshot?.folderColors
        }
    }, schemaVersion);

    if (!normalized.snapshot) {
        return {
            snapshot: null,
            serializedText: null,
            errorCode: normalized.errorCode
        };
    }

    const folderColors = {};

    Object.entries(normalized.snapshot.folderColors)
        .forEach(([folderPath, color]) => {
            folderColors[folderPath] = color;
        });

    const document = {
        schemaVersion,
        settings: { folderColors }
    };

    return {
        snapshot: normalized.snapshot,
        serializedText: `${JSON.stringify(document, null, 2)}\n`,
        errorCode: null
    };
}

export { isValidFolderPath, normalizeColor };
