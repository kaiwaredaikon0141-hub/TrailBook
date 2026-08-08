const INVALID_NAME_PATTERN = /\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

/**
 * Normalizes a user-visible GPX name and rejects clear decode corruption.
 */
export function normalizeDiscoveryName(value) {

    if (typeof value !== "string") {
        return "";
    }

    const normalized = value.trim();

    return normalized && !INVALID_NAME_PATTERN.test(normalized)
        ? normalized
        : "";
}

export function isUsableDiscoveryName(value) {

    return normalizeDiscoveryName(value).length > 0;
}
