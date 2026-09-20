const APP_SHELL_CACHE_PREFIX = "trailbook-app-shell-";
const APP_SHELL_BUILD_ID = "__TRAILBOOK_BUILD_ID__";
const APP_SHELL_CACHE = `${APP_SHELL_CACHE_PREFIX}${
    /^[0-9a-f]{8}$/i.test(APP_SHELL_BUILD_ID) ? APP_SHELL_BUILD_ID : "local"
}`;
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./trailbook.build.js",
    "./favicon.svg",
    "./icons/trailbook-192.png",
    "./icons/trailbook-512.png",
    "./icons/trailbook-maskable-192.png",
    "./icons/trailbook-maskable-512.png",
    "./css/base.css",
    "./css/layout.css",
    "./css/theme.css",
    "./vendor/leaflet/leaflet.css",
    "./vendor/leaflet/leaflet.js",
    "./vendor/protomaps-leaflet/protomaps-leaflet.js",
    "./vendor/leaflet/images/layers.png",
    "./vendor/leaflet/images/layers-2x.png",
    "./vendor/leaflet/images/marker-icon.png",
    "./vendor/leaflet/images/marker-icon-2x.png",
    "./vendor/leaflet/images/marker-shadow.png"
];
const MODULE_ENTRY = "./js/main.js";
const MODULE_SPECIFIER_PATTERN = /\b(?:import|export)\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const RUNTIME_BUILD_MODULE = "./js/runtime/RuntimeBuild.js";
const MODULE_FETCH_CONCURRENCY = 12;

function buildFetchUrl(url) {

    const result = new URL(url);

    if (/^[0-9a-f]{8}$/i.test(APP_SHELL_BUILD_ID)) {
        result.searchParams.set("trailbook-build", APP_SHELL_BUILD_ID);
    }
    return result.href;
}

async function fetchBuildAsset(url) {

    return fetch(buildFetchUrl(url), { cache: "reload" });
}

function assertBuildMarker(source, label) {

    if (
        /^[0-9a-f]{8}$/i.test(APP_SHELL_BUILD_ID) &&
        !source.includes(APP_SHELL_BUILD_ID)
    ) {
        throw new Error(`${label} does not match ${APP_SHELL_BUILD_ID}`);
    }
}

function collectModuleSpecifiers(source) {

    return [MODULE_SPECIFIER_PATTERN, DYNAMIC_IMPORT_PATTERN].flatMap(pattern => {
        pattern.lastIndex = 0;
        return Array.from(source.matchAll(pattern), match => match[1]);
    });
}

async function precacheModuleGraph(cache) {

    const scope = self.registration.scope;
    const pending = [new URL(MODULE_ENTRY, scope).href];
    const visited = new Set();

    while (pending.length > 0) {
        const batch = [];

        while (
            pending.length > 0 &&
            batch.length < MODULE_FETCH_CONCURRENCY
        ) {
            const moduleUrl = pending.shift();

            if (visited.has(moduleUrl)) continue;
            visited.add(moduleUrl);
            batch.push(moduleUrl);
        }

        const dependencies = await Promise.all(batch.map(async moduleUrl => {
            const response = await fetchBuildAsset(moduleUrl);

            if (!response.ok) {
                throw new Error(
                    `App shell module fetch failed: ${response.status}`
                );
            }

            await cache.put(moduleUrl, response.clone());
            const source = await response.text();

            if (moduleUrl === new URL(RUNTIME_BUILD_MODULE, scope).href) {
                assertBuildMarker(source, "Runtime module");
            }

            return collectModuleSpecifiers(source)
                .filter(specifier => specifier.startsWith("."))
                .map(specifier => new URL(specifier, moduleUrl).href);
        }));

        dependencies.flat().forEach(dependencyUrl => {
            const url = new URL(dependencyUrl);

            if (
                url.origin === self.location.origin &&
                url.pathname.endsWith(".js") &&
                !visited.has(url.href)
            ) {
                pending.push(url.href);
            }
        });
    }
}

async function precacheCoreAssets(cache) {

    const scope = self.registration.scope;

    await Promise.all(CORE_ASSETS.map(async asset => {
        const assetUrl = new URL(asset, scope).href;
        const response = await fetchBuildAsset(assetUrl);

        if (!response.ok) {
            throw new Error(`App shell asset fetch failed: ${response.status}`);
        }
        if (asset === "./trailbook.build.js") {
            assertBuildMarker(
                await response.clone().text(),
                "Build metadata"
            );
        }
        await cache.put(assetUrl, response);
    }));
}

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        await precacheCoreAssets(cache);
        await precacheModuleGraph(cache);
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => {
            if (
                cacheName.startsWith(APP_SHELL_CACHE_PREFIX) &&
                cacheName !== APP_SHELL_CACHE
            ) {
                return caches.delete(cacheName);
            }
            return Promise.resolve(false);
        }));
        await self.clients.claim();
    })());
});

self.addEventListener("message", event => {
    if (event.data?.type === "SKIP_WAITING") {
        event.waitUntil(self.skipWaiting());
    }
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);

        const cached = await cache.match(request);

        if (cached) return cached;

        try {
            return await fetch(request);
        } catch (error) {
            if (request.mode === "navigate") {
                const fallback = await cache.match("./index.html");
                if (fallback) return fallback;
            }
            throw error;
        }
    })());
});
