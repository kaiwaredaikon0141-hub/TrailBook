const TRAILBOOK_CACHE_PREFIX = "trailbook-app-shell-";
const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalDevelopmentLocation(
    locationObject = globalThis.location
) {

    return LOCAL_DEVELOPMENT_HOSTS.has(locationObject?.hostname);
}

export function isServiceWorkerLocationAllowed(
    locationObject = globalThis.location,
    secureContext = globalThis.isSecureContext
) {

    return !isLocalDevelopmentLocation(locationObject) && Boolean(secureContext);
}

export async function cleanupLocalTrailBookServiceWorker({
    navigatorObject = globalThis.navigator,
    locationObject = globalThis.location,
    cacheStorage = globalThis.caches
} = {}) {

    if (!isLocalDevelopmentLocation(locationObject)) return false;

    let changed = false;
    const scope = locationObject?.href
        ? new URL("./", locationObject.href).href
        : null;

    try {
        const registrations = await navigatorObject?.serviceWorker
            ?.getRegistrations?.() || [];

        for (const registration of registrations) {
            if (!scope || registration.scope !== scope) continue;
            changed = Boolean(await registration.unregister()) || changed;
        }
    } catch {
        // Development cleanup must never block Viewer startup.
    }

    try {
        const cacheNames = await cacheStorage?.keys?.() || [];

        for (const cacheName of cacheNames) {
            if (!cacheName.startsWith(TRAILBOOK_CACHE_PREFIX)) continue;
            changed = Boolean(await cacheStorage.delete(cacheName)) || changed;
        }
    } catch {
        // CacheStorage can be unavailable in privacy-restricted environments.
    }

    return changed;
}

export async function registerTrailBookServiceWorker({
    navigatorObject = globalThis.navigator,
    locationObject = globalThis.location,
    secureContext = globalThis.isSecureContext,
    consoleObject = globalThis.console,
    cacheStorage = globalThis.caches
} = {}) {

    if (isLocalDevelopmentLocation(locationObject)) {
        await cleanupLocalTrailBookServiceWorker({
            navigatorObject,
            locationObject,
            cacheStorage
        });
        return null;
    }

    if (
        !navigatorObject?.serviceWorker ||
        !isServiceWorkerLocationAllowed(locationObject, secureContext)
    ) {
        return null;
    }

    try {
        return await navigatorObject.serviceWorker.register(
            "./service-worker.js",
            { scope: "./" }
        );
    } catch (error) {
        consoleObject?.warn?.(
            "TrailBook app shell could not be enabled.",
            error?.message || error
        );
        return null;
    }
}
