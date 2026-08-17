export function isServiceWorkerLocationAllowed(
    locationObject = globalThis.location,
    secureContext = globalThis.isSecureContext
) {

    if (secureContext) return true;

    return ["localhost", "127.0.0.1", "[::1]"].includes(
        locationObject?.hostname
    );
}

export async function registerTrailBookServiceWorker({
    navigatorObject = globalThis.navigator,
    locationObject = globalThis.location,
    secureContext = globalThis.isSecureContext,
    consoleObject = globalThis.console
} = {}) {

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
