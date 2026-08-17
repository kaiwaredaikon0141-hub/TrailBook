const APP_SHELL_CACHE_PREFIX = "trailbook-app-shell-";
const APP_SHELL_CACHE = `${APP_SHELL_CACHE_PREFIX}v1`;
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./favicon.svg",
    "./icons/trailbook-192.png",
    "./icons/trailbook-512.png",
    "./css/base.css",
    "./css/layout.css",
    "./css/theme.css",
    "./vendor/leaflet/leaflet.css",
    "./vendor/leaflet/leaflet.js",
    "./vendor/leaflet/images/layers.png",
    "./vendor/leaflet/images/layers-2x.png",
    "./vendor/leaflet/images/marker-icon.png",
    "./vendor/leaflet/images/marker-icon-2x.png",
    "./vendor/leaflet/images/marker-shadow.png"
];
const MODULE_ENTRY = "./js/main.js";
const MODULE_SPECIFIER_PATTERN = /\b(?:import|export)\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

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
        const moduleUrl = pending.shift();

        if (visited.has(moduleUrl)) continue;
        visited.add(moduleUrl);

        const response = await fetch(moduleUrl, { cache: "reload" });

        if (!response.ok) {
            throw new Error(`App shell module fetch failed: ${response.status}`);
        }

        await cache.put(moduleUrl, response.clone());
        const source = await response.text();

        collectModuleSpecifiers(source).forEach(specifier => {
            if (!specifier.startsWith(".")) return;

            const dependencyUrl = new URL(specifier, moduleUrl);

            if (
                dependencyUrl.origin === self.location.origin &&
                dependencyUrl.pathname.endsWith(".js") &&
                !visited.has(dependencyUrl.href)
            ) {
                pending.push(dependencyUrl.href);
            }
        });
    }
}

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.addAll(CORE_ASSETS);
        await precacheModuleGraph(cache);
        await self.skipWaiting();
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
