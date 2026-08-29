import {
    getFolderPickerSupport,
    pickFolder
} from "../services/FolderScanner.js";

const READ_PERMISSION = { mode: "read" };

function isPermanentMissingError(error) {

    return error?.name === "NotFoundError";
}

/**
 * Coordinates manual and previous Library opening without owning Viewer state.
 */
export default class PreviousLibraryCoordinator {

    constructor({
        store,
        scanner,
        toolbar,
        accessPanel,
        statusBar,
        canSwitchLibrary,
        flushViewState,
        beforeLoad,
        applyLibrary,
        getCurrentLibrary,
        hasUsableLibrary = () => Boolean(getCurrentLibrary()),
        getSupport = getFolderPickerSupport,
        pickDirectory = pickFolder,
        reportError = (message, error) => console.error(message, error)
    }) {

        this.store = store;
        this.scanner = scanner;
        this.toolbar = toolbar;
        this.accessPanel = accessPanel;
        this.statusBar = statusBar;
        this.canSwitchLibrary = canSwitchLibrary;
        this.flushViewState = flushViewState;
        this.beforeLoad = beforeLoad;
        this.applyLibrary = applyLibrary;
        this.getCurrentLibrary = getCurrentLibrary;
        this.hasUsableLibrary = hasUsableLibrary;
        this.getSupport = getSupport;
        this.pickDirectory = pickDirectory;
        this.reportError = reportError;
        this.generation = 0;
        this.previousHandle = null;
        this.previousPermission = "prompt";
        this.persistenceStatus = "no persistent handle";
        this.persistenceStatusListener = null;
        this.loading = false;

        this.accessPanel.setPreviousLibraryAction(
            () => void this.openPrevious()
        );
        this.accessPanel.setManualLibraryAction?.(
            () => void this.openManual()
        );
    }

    async initialize() {

        const support = this.#configureAccess();

        if (!support.available) {
            this.#setPersistenceStatus("unsupported");
            return false;
        }

        const handle = await this.store.load();

        if (!handle) {
            const storeStatus = this.store.getStatus?.();
            this.#setPersistenceStatus(
                storeStatus === "invalid"
                    ? "invalid"
                    : storeStatus === "unavailable"
                        ? "unsupported"
                        : "no persistent handle"
            );
            return false;
        }

        this.previousHandle = handle;
        const permission = await this.#queryReadPermission(handle);
        this.previousPermission = permission;
        this.#setPersistenceStatus(`saved / ${permission}`);

        if (permission === "granted") {
            this.accessPanel.showPreviousLibrary(handle.name, permission);
            const opened = await this.#openHandle(handle, { remember: false });

            if (!opened && !this.getCurrentLibrary() && this.previousHandle) {
                this.accessPanel.showPreviousLibrary(
                    handle.name,
                    this.previousPermission
                );
            }
            return opened;
        }

        if (permission === "prompt") {
            this.accessPanel.showPreviousLibrary(handle.name, permission);
            return false;
        }

        this.previousHandle = null;
        this.#configureAccess();
        this.#setPersistenceStatus("saved / denied");
        return false;
    }

    async openManual() {

        if (!this.canSwitchLibrary()) {
            return false;
        }

        const support = this.getSupport();

        if (!support.available) {
            this.#configureAccess();
            return false;
        }

        try {
            const handle = await this.pickDirectory();

            if (!handle) {
                return false;
            }

            return this.#openHandle(handle, { remember: true });
        } catch (error) {
            if (error?.name === "AbortError") {
                this.#restoreAccessState();
                return false;
            }

            this.#showLoadFailure(error);
            return false;
        }
    }

    async openPrevious() {

        const handle = this.previousHandle ?? await this.store.load();

        if (!handle || !this.canSwitchLibrary()) {
            return false;
        }

        let permission = await this.#queryReadPermission(handle);

        if (permission !== "granted") {
            permission = await this.#requestReadPermission(handle);
        }
        this.previousPermission = permission;
        this.#setPersistenceStatus(`saved / ${permission}`);

        if (permission !== "granted") {
            this.accessPanel.showPreviousLibrary(handle.name, "denied");
            this.statusBar.showError();
            return false;
        }

        return this.#openHandle(handle, { remember: false });
    }

    isLoading() {
        return this.loading;
    }

    getRefreshHandle() {
        return this.getCurrentLibrary()?.rootFolder?.handle || this.previousHandle;
    }

    getRefreshContext() {

        const handle = this.getRefreshHandle();
        const prefix = "saved / ";
        const permission = this.persistenceStatus.startsWith(prefix)
            ? this.persistenceStatus.slice(prefix.length)
            : handle
                ? this.previousPermission
                : "unknown";

        return Object.freeze({
            handle,
            hasHandle: Boolean(handle),
            permission
        });
    }

    setPersistenceStatusListener(listener) {

        this.persistenceStatusListener = listener;
        this.#notifyPersistenceStatus();
    }

    async queryRefreshPermission(handle = this.getRefreshHandle()) {
        return handle ? this.#queryReadPermission(handle) : "denied";
    }

    async refreshPreviousIfGranted() {

        const handle = this.getRefreshHandle();

        if (!handle || this.loading ||
            await this.#queryReadPermission(handle) !== "granted") return false;
        return this.#openHandle(handle, { remember: false });
    }

    #configureAccess() {

        const support = this.getSupport();
        let disabledReason = "";
        const showEnvironmentStatus = !this.hasUsableLibrary();

        if (support.reason === "insecure-context") {
            disabledReason = "安全な接続で開いてください";
            this.accessPanel.showInsecureContext();
            if (showEnvironmentStatus) this.statusBar.showUnsupportedEnvironment();
        } else if (support.reason === "missing-api") {
            disabledReason = "このbrowserではFolder選択を利用できません";
            this.accessPanel.showUnsupportedBrowser();
            if (showEnvironmentStatus) this.statusBar.showUnsupportedEnvironment();
        } else if (support.isMobile) {
            this.accessPanel.showUnverifiedMobile();
            if (showEnvironmentStatus) this.statusBar.showInitial();
        } else {
            this.accessPanel.showInitial();
            if (showEnvironmentStatus) this.statusBar.showInitial();
        }

        this.toolbar.setFolderPickerState({
            disabled: !support.available,
            descriptionId: this.accessPanel.descriptionId,
            disabledReason
        });
        this.accessPanel.setFolderPickerState?.({
            disabled: !support.available,
            descriptionId: this.accessPanel.descriptionId,
            disabledReason
        });

        return support;
    }

    async #openHandle(handle, { remember }) {

        if (!this.canSwitchLibrary()) {
            return false;
        }

        this.flushViewState();

        const generation = ++this.generation;
        const isCurrent = () => generation === this.generation;
        const cacheNamespace = await this.#resolveCacheNamespace(handle);

        this.loading = true;
        this.beforeLoad();
        this.accessPanel.showLoading(handle.name);
        this.statusBar.showLibraryLoading(handle.name);

        try {
            const library = await this.scanner.scan(handle);

            if (!isCurrent()) {
                return false;
            }

            const applied = await this.applyLibrary(library, {
                generation,
                isCurrent,
                cacheNamespace
            });

            if (!applied || !isCurrent()) {
                if (isCurrent()) this.#restoreAccessState();
                return false;
            }

            this.previousHandle = handle;
            if (remember) {
                const saved = await this.store.save(handle, { cacheNamespace });

                if (!saved) {
                    this.#setPersistenceStatus(
                        this.store.getStatus?.() === "unavailable"
                            ? "unsupported"
                            : "no persistent handle"
                    );
                    return true;
                }
                const permission = await this.#queryReadPermission(handle);

                this.previousPermission = permission;
                this.#setPersistenceStatus(`saved / ${permission}`);
            }
            return true;
        } catch (error) {
            if (!remember && isPermanentMissingError(error)) {
                this.previousHandle = null;
                this.previousPermission = "prompt";
                await this.store.clear();
                this.#setPersistenceStatus("invalid");
            }
            this.#showLoadFailure(error);
            if (isCurrent() && !this.getCurrentLibrary()) {
                if (this.previousHandle) {
                    this.accessPanel.showPreviousLibrary(
                        this.previousHandle.name,
                        this.previousPermission
                    );
                } else {
                    this.#configureAccess();
                    this.statusBar.showError();
                }
            }
            return false;
        } finally {
            if (isCurrent()) this.loading = false;
        }
    }

    async #queryReadPermission(handle) {

        try {
            return await handle.queryPermission(READ_PERMISSION);
        } catch {
            return "denied";
        }
    }

    async #requestReadPermission(handle) {

        try {
            return await handle.requestPermission(READ_PERMISSION);
        } catch {
            return "denied";
        }
    }

    async #resolveCacheNamespace(handle) {

        if (typeof this.store.resolveCacheNamespace !== "function") {
            return null;
        }

        try {
            return await this.store.resolveCacheNamespace(handle);
        } catch {
            return null;
        }
    }

    #setPersistenceStatus(status) {

        this.persistenceStatus = status;
        this.accessPanel.setPreviousLibraryStatus?.(status);
        this.#notifyPersistenceStatus();
    }

    #notifyPersistenceStatus() {

        const prefix = "saved / ";

        this.persistenceStatusListener?.({
            status: this.persistenceStatus,
            permission: this.persistenceStatus.startsWith(prefix)
                ? this.persistenceStatus.slice(prefix.length)
                : "unknown",
            hasHandle: Boolean(this.getRefreshHandle())
        });
    }

    #showLoadFailure(error) {

        this.reportError("Failed to load library.", error);
        if (
            error?.name === "NotAllowedError" ||
            error?.name === "SecurityError"
        ) {
            this.accessPanel.showPermissionFailure();
        } else {
            this.accessPanel.showLoadFailure();
        }
        this.statusBar.showError();
    }

    #restoreAccessState() {

        const library = this.getCurrentLibrary();

        if (!library) {
            if (this.previousHandle) {
                this.accessPanel.showPreviousLibrary(
                    this.previousHandle.name,
                    this.previousPermission
                );
                this.statusBar.showInitial();
                return;
            }
            this.#configureAccess();
            return;
        }

        if (library.gpxFileCount === 0) {
            this.accessPanel.showEmpty(library.name);
        } else {
            this.accessPanel.hide();
        }
        this.statusBar.showLibraryLoaded(library);
    }
}
