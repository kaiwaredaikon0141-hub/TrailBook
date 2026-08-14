import {
    cloneLibraryViewState,
    createEmptyViewStateDocument,
    normalizeBaseMap,
    normalizeLibraryViewState,
    normalizeViewStateDocument,
    serializeViewStateDocument
} from "../utils/ViewStateSchema.js";
import { createLibraryId, isValidLibraryId } from "../utils/LibraryIdentity.js";

function getDefaultStorage() {

    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

function byteLength(value) {

    return new TextEncoder().encode(value).byteLength;
}

/**
 * Persists regenerable, device-local Library view state.
 */
export default class ViewStateStore {

    constructor({
        storage = getDefaultStorage(),
        storageKey = "trailbook.viewState",
        schemaVersion = 1,
        maxVisibleTracks = 5000,
        maxSerializedBytes = 1048576,
        minZoom = 0,
        maxZoom = 19,
        sidebarDefaultWidth = 260,
        sidebarMinWidth = 220,
        sidebarMaxWidth = 520,
        trackInfoDefaultHeight = 220,
        trackInfoMinHeight = 120,
        trackInfoMaxHeight = 420
    } = {}) {

        this.storage = storage;
        this.storageKey = storageKey;
        this.options = {
            schemaVersion,
            maxVisibleTracks,
            minZoom,
            maxZoom,
            sidebarDefaultWidth,
            sidebarMinWidth,
            sidebarMaxWidth,
            trackInfoDefaultHeight,
            trackInfoMinHeight,
            trackInfoMaxHeight
        };
        this.maxSerializedBytes = maxSerializedBytes;
        this.document = createEmptyViewStateDocument(schemaVersion);
        this.persistenceStatus = storage ? "available" : "session-only";
        this.loadStatus = "empty";
        this.#load();
    }

    createLibraryId(rootFolderName) {

        return createLibraryId(rootFolderName);
    }

    getBaseMap() {

        return normalizeBaseMap(this.document.global?.baseMap);
    }

    setBaseMap(value) {

        const normalized = normalizeBaseMap(value);

        if (this.getBaseMap() === normalized) return false;

        this.document.global = { baseMap: normalized };
        this.#save();
        return true;
    }

    hasLibraryState(libraryId) {

        return isValidLibraryId(libraryId) &&
            Object.hasOwn(this.document.libraries, libraryId);
    }

    getLibraryState(libraryId) {

        const state = isValidLibraryId(libraryId)
            ? this.document.libraries[libraryId]
            : null;

        return state ? cloneLibraryViewState(state) : null;
    }

    setLibraryState(libraryId, state) {

        if (!isValidLibraryId(libraryId)) {
            return false;
        }

        const normalized = normalizeLibraryViewState(state, this.options);

        if (!normalized) {
            return false;
        }

        this.document.libraries[libraryId] = normalized;
        this.#save();

        return true;
    }

    removeLibraryState(libraryId) {

        if (
            !isValidLibraryId(libraryId) ||
            !Object.hasOwn(this.document.libraries, libraryId)
        ) {
            return false;
        }

        delete this.document.libraries[libraryId];
        this.#save();

        return true;
    }

    getStatus() {

        return {
            persistence: this.persistenceStatus,
            load: this.loadStatus
        };
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

            if (byteLength(serialized) > this.maxSerializedBytes) {
                this.#useSessionFallback("oversize");
                return;
            }

            const document = normalizeViewStateDocument(
                JSON.parse(serialized),
                this.options
            );

            if (!document) {
                this.#useSessionFallback("invalid");
                return;
            }

            this.document = document;
            this.loadStatus = "loaded";
        } catch {
            this.#useSessionFallback("failed");
        }
    }

    #save() {

        if (!this.storage) {
            return false;
        }

        const serialized = serializeViewStateDocument(this.document);

        if (byteLength(serialized) > this.maxSerializedBytes) {
            this.#useSessionFallback("oversize");
            return false;
        }

        try {
            this.storage.setItem(this.storageKey, serialized);
            this.persistenceStatus = "available";

            return true;
        } catch {
            this.#useSessionFallback("failed");

            return false;
        }
    }

    #useSessionFallback(loadStatus) {

        this.storage = null;
        this.persistenceStatus = "session-only";
        this.loadStatus = loadStatus;
    }
}
