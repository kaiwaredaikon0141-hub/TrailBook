import { RUNTIME_BUILD_ID } from "../runtime/RuntimeBuild.js";
import {
    isLocalDevelopmentLocation,
    isServiceWorkerLocationAllowed,
    registerTrailBookServiceWorker
} from "../services/PWAServiceWorker.js";

const APP_SHELL_CACHE_PREFIX = "trailbook-app-shell-";
const BUILD_PATTERN = /["']?commit["']?\s*:\s*["']([0-9a-f]{7,40}|local)["']/i;

function buildId(value) {

    return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value)
        ? value.slice(0, 8).toLowerCase()
        : "local";
}

/** Explicit, app-shell-only PWA update orchestration. */
export default class AppUpdateCoordinator {

    constructor({
        panel,
        serviceWorkerRegistration = null,
        registerServiceWorker = () => registerTrailBookServiceWorker(),
        navigatorObject = globalThis.navigator,
        locationObject = globalThis.location,
        secureContext = globalThis.isSecureContext,
        cacheStorage = globalThis.caches,
        fetchFunction = globalThis.fetch?.bind(globalThis),
        runtimeBuildIdentifier = RUNTIME_BUILD_ID,
        reload = () => locationObject.reload(),
        consoleObject = globalThis.console,
        timeoutMs = 20000,
        installTimeoutMs = 120000
    }) {

        this.panel = panel;
        this.serviceWorkerRegistration = serviceWorkerRegistration;
        this.registerServiceWorker = registerServiceWorker;
        this.navigatorObject = navigatorObject;
        this.locationObject = locationObject;
        this.secureContext = secureContext;
        this.cacheStorage = cacheStorage;
        this.fetchFunction = fetchFunction;
        this.runtimeBuildIdentifier = buildId(runtimeBuildIdentifier);
        this.reload = reload;
        this.consoleObject = consoleObject;
        this.timeoutMs = timeoutMs;
        this.installTimeoutMs = installTimeoutMs;
        this.running = false;
        this.reloaded = false;
    }

    attach() {

        if (isLocalDevelopmentLocation(this.locationObject)) {
            this.panel?.setAppUpdateHandler?.(null);
            this.panel?.setAppUpdateState?.("local");
            return false;
        }
        if (
            !this.navigatorObject?.serviceWorker ||
            !isServiceWorkerLocationAllowed(
                this.locationObject,
                this.secureContext
            )
        ) {
            this.panel?.setAppUpdateHandler?.(null);
            this.panel?.setAppUpdateState?.("unsupported");
            return false;
        }

        return this.panel?.setAppUpdateHandler?.(() => this.update()) || false;
    }

    detach() {

        return this.panel?.setAppUpdateHandler?.(null) || false;
    }

    async update() {

        if (this.running) return false;

        this.running = true;
        this.panel?.setAppUpdateState?.("checking");
        let stage = "registration";

        try {
            const registration = await this.#getRegistration();

            if (!registration?.update) {
                throw new Error("Application updates are unavailable.");
            }
            this.#assertTrailBookScope(registration);

            let discoveredWorker = null;
            const onUpdateFound = () => {
                discoveredWorker = registration.installing || discoveredWorker;
            };

            stage = "registration-update";
            registration.addEventListener?.("updatefound", onUpdateFound);
            try {
                await registration.update();
            } finally {
                registration.removeEventListener?.("updatefound", onUpdateFound);
            }

            const worker = registration.installing || discoveredWorker ||
                registration.waiting;

            if (worker) {
                stage = "worker-activation";
                await this.#activateWorker(registration, worker);
                return true;
            }

            stage = "network-build-check";
            const networkBuild = await this.#fetchNetworkBuild();

            if (
                this.runtimeBuildIdentifier !== "local" &&
                networkBuild !== this.runtimeBuildIdentifier
            ) {
                stage = "app-shell-refresh";
                await this.#refreshAppShell(registration);
                return true;
            }

            this.panel?.setAppUpdateState?.("latest");
            return false;
        } catch (error) {
            this.panel?.setAppUpdateState?.("failed");
            this.consoleObject?.warn?.(
                `TrailBook update failed at ${stage} without changing user data.`,
                error?.message || error
            );
            return false;
        } finally {
            this.running = false;
        }
    }

    async #getRegistration() {

        const supplied = await Promise.resolve(this.serviceWorkerRegistration)
            .catch(() => null);

        if (supplied) return supplied;

        const scope = new URL("./", this.locationObject.href).href;
        const existing = await this.navigatorObject?.serviceWorker
            ?.getRegistration?.(scope);

        if (existing) return existing;

        return this.registerServiceWorker?.() || null;
    }

    #assertTrailBookScope(registration) {

        const expectedScope = new URL("./", this.locationObject.href).href;

        if (registration.scope !== expectedScope) {
            throw new Error("Service Worker scope does not match TrailBook.");
        }
    }

    async #activateWorker(registration, worker) {

        if (worker.state === "installing") {
            await this.#waitForInstalled(worker);
        }

        const waiting = registration.waiting || worker;

        if (waiting.state === "redundant") {
            throw new Error("The application update was superseded.");
        }
        if (waiting.state !== "installed" && registration.waiting !== waiting) {
            throw new Error("The application update did not become ready.");
        }

        this.panel?.setAppUpdateState?.("updating");
        const controllerChanged = this.#waitForControllerChange();

        waiting.postMessage({ type: "SKIP_WAITING" });
        await controllerChanged;
        this.panel?.setAppUpdateState?.("reloading");
        this.#reloadOnce();
    }

    #waitForInstalled(worker) {

        return new Promise((resolve, reject) => {
            let timeout;
            const cleanup = () => {
                clearTimeout(timeout);
                worker.removeEventListener?.("statechange", onStateChange);
            };
            const onStateChange = () => {
                if (worker.state === "installed") {
                    cleanup();
                    resolve();
                } else if (worker.state === "redundant") {
                    cleanup();
                    reject(new Error("The application update became redundant."));
                }
            };

            worker.addEventListener?.("statechange", onStateChange);
            timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Application update installation timed out."));
            }, this.installTimeoutMs);
            onStateChange();
        });
    }

    #waitForControllerChange() {

        const serviceWorker = this.navigatorObject?.serviceWorker;

        if (!serviceWorker?.addEventListener) {
            return Promise.reject(new Error("Controller change is unavailable."));
        }

        return new Promise((resolve, reject) => {
            let timeout;
            const cleanup = () => {
                clearTimeout(timeout);
                serviceWorker.removeEventListener?.("controllerchange", onChange);
            };
            const onChange = () => {
                cleanup();
                resolve();
            };

            serviceWorker.addEventListener("controllerchange", onChange);
            timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Application update activation timed out."));
            }, this.timeoutMs);
        });
    }

    async #fetchNetworkBuild() {

        if (!this.fetchFunction) throw new Error("Network check is unavailable.");

        const url = new URL("./trailbook.build.js", this.locationObject.href);
        url.searchParams.set("trailbook-update-check", String(Date.now()));
        const response = await this.fetchFunction(url.href, {
            cache: "no-store"
        });

        if (!response?.ok) throw new Error("Latest build is unreachable.");

        const match = BUILD_PATTERN.exec(await response.text());

        if (!match) throw new Error("Latest build metadata is invalid.");
        return buildId(match[1]);
    }

    async #refreshAppShell(registration) {

        this.#assertTrailBookScope(registration);

        this.panel?.setAppUpdateState?.("reloading");
        const cacheNames = await this.cacheStorage?.keys?.() || [];

        await Promise.all(cacheNames
            .filter(name => name.startsWith(APP_SHELL_CACHE_PREFIX))
            .map(name => this.cacheStorage.delete(name)));
        await registration.unregister();
        this.#reloadOnce();
    }

    #reloadOnce() {

        if (this.reloaded) return false;

        this.reloaded = true;
        this.reload();
        return true;
    }
}
