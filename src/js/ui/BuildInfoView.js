import Config from "../core/Config.js";
import { RUNTIME_BUILD_ID } from "../runtime/RuntimeBuild.js";
import { isLocalDevelopmentLocation } from "../services/PWAServiceWorker.js";

const MODULE_SPECIFIER_PATTERNS = Object.freeze([
    /\b(?:import|export)\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g
]);
const DEVELOPMENT_SOURCE_URLS = Object.freeze([
    new URL("../../index.html", import.meta.url).href,
    new URL("../../manifest.webmanifest", import.meta.url).href,
    new URL("../../trailbook.build.js", import.meta.url).href,
    new URL("../../service-worker.js", import.meta.url).href,
    new URL("../../css/base.css", import.meta.url).href,
    new URL("../../css/layout.css", import.meta.url).href,
    new URL("../../css/theme.css", import.meta.url).href,
    new URL("../../vendor/leaflet/leaflet.css", import.meta.url).href,
    new URL("../../vendor/leaflet/leaflet.js", import.meta.url).href
]);

function moduleSpecifiers(source) {

    return MODULE_SPECIFIER_PATTERNS.flatMap(pattern => {
        pattern.lastIndex = 0;
        return Array.from(source.matchAll(pattern), match => match[1]);
    });
}

async function fetchCurrentSource(url, fetchFunction) {

    const response = await fetchFunction(url, { cache: "no-store" });

    if (!response.ok) throw new Error("Development source unavailable");
    return response.text();
}

async function collectDevelopmentSources({
    fetchFunction,
    moduleEntryUrl,
    sourceUrls
}) {

    const pending = [moduleEntryUrl];
    const visited = new Set();
    const sources = [];

    while (pending.length > 0) {
        const moduleUrl = pending.shift();

        if (visited.has(moduleUrl)) continue;
        visited.add(moduleUrl);

        const source = await fetchCurrentSource(moduleUrl, fetchFunction);

        sources.push([moduleUrl, source]);
        moduleSpecifiers(source).forEach(specifier => {
            if (!specifier.startsWith(".")) return;

            const dependencyUrl = new URL(specifier, moduleUrl);

            if (
                dependencyUrl.origin === new URL(moduleEntryUrl).origin &&
                dependencyUrl.pathname.endsWith(".js") &&
                !visited.has(dependencyUrl.href)
            ) {
                pending.push(dependencyUrl.href);
            }
        });
    }

    for (const sourceUrl of sourceUrls) {
        if (visited.has(sourceUrl)) continue;
        sources.push([
            sourceUrl,
            await fetchCurrentSource(sourceUrl, fetchFunction)
        ]);
    }

    return sources;
}

async function fingerprintSources(sources, cryptoObject) {

    const content = sources
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([url, source]) => `${new URL(url).pathname}\n${source}`)
        .join("\n\0\n");
    const digest = await cryptoObject.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(content)
    );
    const hex = Array.from(new Uint8Array(digest), byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");

    return `dev-${hex.slice(0, 8)}`;
}

export function getBuildIdentifier(
    runtimeBuild = globalThis.TRAILBOOK_BUILD
) {

    const commit = runtimeBuild?.commit;

    if (typeof commit !== "string" || !/^[0-9a-f]{7,40}$/i.test(commit)) {
        return "local";
    }

    return commit.slice(0, 8).toLowerCase();
}

export async function getDevelopmentBuildIdentifier({
    locationObject = globalThis.location,
    fetchFunction = globalThis.fetch?.bind(globalThis),
    cryptoObject = globalThis.crypto,
    moduleEntryUrl = new URL("../main.js", import.meta.url).href,
    sourceUrls = DEVELOPMENT_SOURCE_URLS
} = {}) {

    if (!isLocalDevelopmentLocation(locationObject)) return null;
    if (!fetchFunction || !cryptoObject?.subtle) return "dev-unavailable";

    const sources = await collectDevelopmentSources({
        fetchFunction,
        moduleEntryUrl,
        sourceUrls
    });

    return fingerprintSources(sources, cryptoObject);
}

function buildInfoText({
    config,
    runtimeBuild,
    localDevelopment,
    developmentBuildIdentifier,
    serviceWorkerStatus,
    compact,
    mapIndicator,
    runtimeBuildIdentifier
}) {

    if (mapIndicator) {
        const identifier = localDevelopment
            ? developmentBuildIdentifier || "dev-checking..."
            : /^[0-9a-f]{8}$/i.test(runtimeBuildIdentifier)
                ? runtimeBuildIdentifier.toLowerCase()
                : getBuildIdentifier(runtimeBuild);

        return `v${config.version} \u00b7 ${identifier}`;
    }

    const parts = [compact
        ? `v${config.version}`
        : `TrailBook v${config.version}`];

    parts.push(getBuildIdentifier(runtimeBuild));
    if (localDevelopment) {
        parts.push(developmentBuildIdentifier || "dev-checking...");
    }
    parts.push(`SW: ${serviceWorkerStatus}`);

    return parts.join(" \u00b7 ");
}

export function getServiceWorkerStatus(
    registration,
    navigatorObject = globalThis.navigator
) {

    if (!registration) return "unavailable";
    if (registration.waiting) return "waiting";
    if (registration.installing) return "installing";
    if (navigatorObject?.serviceWorker?.controller || registration.active) {
        return "active";
    }
    return "unavailable";
}

export function updateBuildInfoElement(element, {
    config = Config,
    runtimeBuild = globalThis.TRAILBOOK_BUILD,
    locationObject = globalThis.location,
    developmentBuildIdentifier = null,
    serviceWorkerStatus = null,
    runtimeBuildIdentifier = RUNTIME_BUILD_ID
} = {}) {

    const localDevelopment = isLocalDevelopmentLocation(locationObject);

    element.textContent = buildInfoText({
        config,
        runtimeBuild,
        localDevelopment,
        developmentBuildIdentifier,
        serviceWorkerStatus: serviceWorkerStatus ||
            (localDevelopment ? "disabled" : "checking"),
        compact: element.dataset.compact === "true",
        mapIndicator: element.dataset.mapIndicator === "true",
        runtimeBuildIdentifier
    });

    return element;
}

export function createBuildInfoElement({
    config = Config,
    runtimeBuild = globalThis.TRAILBOOK_BUILD,
    locationObject = globalThis.location,
    compact = false,
    mapIndicator = false,
    runtimeBuildIdentifier = RUNTIME_BUILD_ID
} = {}) {

    const element = document.createElement("footer");

    element.className = mapIndicator
        ? "trailbook-build-info map-build-indicator"
        : "trailbook-build-info";
    element.dataset.compact = String(compact);
    element.dataset.mapIndicator = String(mapIndicator);
    updateBuildInfoElement(element, {
        config,
        runtimeBuild,
        locationObject,
        runtimeBuildIdentifier
    });

    return element;
}

export async function resolveBuildInfoElements(elements, {
    config = Config,
    runtimeBuild = globalThis.TRAILBOOK_BUILD,
    locationObject = globalThis.location,
    serviceWorkerRegistration = null,
    developmentBuildIdentifier = null,
    runtimeBuildIdentifier = RUNTIME_BUILD_ID,
    developmentIdentifierOptions = {},
    navigatorObject = globalThis.navigator
} = {}) {

    const localDevelopment = isLocalDevelopmentLocation(locationObject);
    const identifierPromise = localDevelopment
        ? developmentBuildIdentifier ||
            globalThis.TRAILBOOK_DEVELOPMENT_FINGERPRINT ||
            getDevelopmentBuildIdentifier({
                locationObject,
                ...developmentIdentifierOptions
            })
        : null;
    const [resolvedIdentifier, registration] = await Promise.all([
        Promise.resolve(identifierPromise).catch(() => "dev-unavailable"),
        Promise.resolve(serviceWorkerRegistration).catch(() => null)
    ]);
    const serviceWorkerStatus = localDevelopment
        ? "disabled"
        : getServiceWorkerStatus(registration, navigatorObject);

    elements.filter(Boolean).forEach(element => updateBuildInfoElement(element, {
        config,
        runtimeBuild,
        locationObject,
        developmentBuildIdentifier: resolvedIdentifier,
        serviceWorkerStatus,
        runtimeBuildIdentifier
    }));

    if (!localDevelopment && registration) {
        const renderLifecycle = () => {
            const status = getServiceWorkerStatus(
                registration,
                navigatorObject
            );

            elements.filter(Boolean).forEach(element => updateBuildInfoElement(
                element,
                {
                    config,
                    runtimeBuild,
                    locationObject,
                    developmentBuildIdentifier: resolvedIdentifier,
                    serviceWorkerStatus: status,
                    runtimeBuildIdentifier
                }
            ));
        };
        const watchWorker = worker => worker?.addEventListener?.(
            "statechange",
            renderLifecycle
        );

        watchWorker(registration.installing);
        watchWorker(registration.waiting);
        registration.addEventListener?.("updatefound", () => {
            watchWorker(registration.installing);
            renderLifecycle();
        });
        navigatorObject?.serviceWorker?.addEventListener?.(
            "controllerchange",
            renderLifecycle
        );
    }

    return {
        developmentBuildIdentifier: resolvedIdentifier,
        serviceWorkerStatus
    };
}
