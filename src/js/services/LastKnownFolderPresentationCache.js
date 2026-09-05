import { normalizeLibraryRelativePath } from "../core/LibraryPath.js";
import { isValidLibraryId } from "../utils/LibraryIdentity.js";

const DEFAULT_STORAGE_KEY = "trailbook.folderPresentationCache";
const DEFAULT_SCHEMA_VERSION = 1;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DANGEROUS_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

function createState(schemaVersion) {

    return { version: schemaVersion, libraries: Object.create(null) };
}

function normalizeFolderPath(path) {

    if (path === "") return "";
    const normalized = normalizeLibraryRelativePath(path);

    return normalized && !normalized.split("/").some(
        segment => DANGEROUS_SEGMENTS.has(segment)
    ) ? normalized : null;
}

function normalizeColor(color) {

    return typeof color === "string" && HEX_COLOR_PATTERN.test(color.trim())
        ? color.trim().toUpperCase()
        : null;
}

function normalizePresentations(presentations) {

    const normalized = new Map();

    for (const [rawPath, value] of presentations || []) {
        const path = normalizeFolderPath(rawPath);
        const color = normalizeColor(
            typeof value === "string" ? value : value?.resolvedColor
        );

        if (path !== null && color) normalized.set(path, color);
    }
    return normalized;
}

function getDefaultStorage() {

    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/** Persists last-known resolved Folder colors for provisional UI only. */
export default class LastKnownFolderPresentationCache {

    constructor({
        storage = getDefaultStorage(),
        storageKey = DEFAULT_STORAGE_KEY,
        schemaVersion = DEFAULT_SCHEMA_VERSION
    } = {}) {

        this.storage = storage;
        this.storageKey = storageKey;
        this.schemaVersion = schemaVersion;
        this.state = createState(schemaVersion);
        this.#load();
    }

    get(libraryIdentity) {

        if (!isValidLibraryId(libraryIdentity)) return new Map();
        const folders = this.state.libraries[libraryIdentity]?.folders;

        return new Map(Object.entries(folders || {}));
    }

    merge(libraryIdentity, presentations) {

        return this.#update(libraryIdentity, presentations, false);
    }

    replace(libraryIdentity, presentations) {

        return this.#update(libraryIdentity, presentations, true);
    }

    #update(libraryIdentity, presentations, replace) {

        if (!isValidLibraryId(libraryIdentity)) return 0;
        const incoming = normalizePresentations(presentations);
        const previous = this.get(libraryIdentity);
        const next = replace ? incoming : new Map([...previous, ...incoming]);
        const changedPaths = new Set([...previous.keys(), ...next.keys()]);
        let mutations = 0;

        changedPaths.forEach(path => {
            if (previous.get(path) !== next.get(path)) mutations += 1;
        });
        if (mutations === 0) return 0;
        this.state.libraries[libraryIdentity] = {
            folders: Object.fromEntries(next)
        };
        this.#save();
        return mutations;
    }

    #load() {

        if (!this.storage) return;
        try {
            const raw = this.storage.getItem(this.storageKey);
            const parsed = raw ? JSON.parse(raw) : null;

            if (
                !parsed || parsed.version !== this.schemaVersion ||
                !parsed.libraries || typeof parsed.libraries !== "object"
            ) return;
            Object.entries(parsed.libraries).forEach(([identity, value]) => {
                if (!isValidLibraryId(identity)) return;
                const folders = normalizePresentations(
                    Object.entries(value?.folders || {})
                );

                this.state.libraries[identity] = {
                    folders: Object.fromEntries(folders)
                };
            });
        } catch {
            this.storage = null;
        }
    }

    #save() {

        if (!this.storage) return false;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
            return true;
        } catch {
            this.storage = null;
            return false;
        }
    }
}
