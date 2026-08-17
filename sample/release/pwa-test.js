import {
    isServiceWorkerLocationAllowed,
    registerTrailBookServiceWorker
} from "../../src/js/services/PWAServiceWorker.js";

const output = document.getElementById("result");
let assertions = 0;

function assert(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function waitForActivation(registration) {

    if (registration.active) return Promise.resolve();

    const worker = registration.installing || registration.waiting;

    if (!worker) return Promise.reject(new Error("Service Worker missing"));

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error("Service Worker activation timeout")),
            30000
        );
        worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
                clearTimeout(timeout);
                resolve();
            }
            if (worker.state === "redundant") {
                clearTimeout(timeout);
                reject(new Error("Service Worker became redundant"));
            }
        });
    });
}

async function testManifestAndAssets() {

    const manifestUrl = new URL("../../src/manifest.webmanifest", location.href);
    const manifest = await fetch(manifestUrl).then(response => response.json());

    assert(manifest.name === "TrailBook", "manifest name");
    assert(manifest.short_name === "TrailBook", "manifest short name");
    assert(manifest.start_url === "./", "start_url is not relative");
    assert(manifest.scope === "./", "scope is not relative");
    assert(manifest.display === "standalone", "standalone display missing");
    assert(manifest.orientation === "any", "orientation changed");
    assert(manifest.icons.length === 2, "PWA icon count");
    assert(manifest.icons.every(icon => !icon.src.startsWith("/")),
        "absolute manifest icon URL");

    const icon192 = await fetch(new URL(
        `../../src/${manifest.icons[0].src}`, location.href
    )).then(response => response.blob()).then(createImageBitmap);
    const icon512 = await fetch(new URL(
        `../../src/${manifest.icons[1].src}`, location.href
    )).then(response => response.blob()).then(createImageBitmap);

    assert(icon192.width === 192 && icon192.height === 192, "192 icon size");
    assert(icon512.width === 512 && icon512.height === 512, "512 icon size");

    const index = await fetch(new URL("../../src/index.html", location.href))
        .then(response => response.text());
    assert(index.includes('href="manifest.webmanifest"'), "manifest link missing");
    assert(index.includes('name="theme-color"'), "theme color missing");
    assert(!index.includes('href="/'), "root-absolute index asset URL");
}

async function testRegistrationContract() {

    assert(isServiceWorkerLocationAllowed(
        { hostname: "example.github.io" }, true
    ), "HTTPS secure context rejected");
    assert(isServiceWorkerLocationAllowed(
        { hostname: "localhost" }, false
    ), "localhost rejected");
    assert(!isServiceWorkerLocationAllowed(
        { hostname: "192.168.1.10" }, false
    ), "insecure LAN origin accepted");

    const calls = [];
    const registration = { scope: "test" };
    const result = await registerTrailBookServiceWorker({
        navigatorObject: {
            serviceWorker: {
                register(url, options) {
                    calls.push({ url, options });
                    return Promise.resolve(registration);
                }
            }
        },
        locationObject: { hostname: "localhost" },
        secureContext: true
    });

    assert(result === registration, "registration result lost");
    assert(calls.length === 1, "registration count");
    assert(calls[0].url === "./service-worker.js", "registration URL not relative");
    assert(calls[0].options.scope === "./", "registration scope not relative");

    const warnings = [];
    const failed = await registerTrailBookServiceWorker({
        navigatorObject: {
            serviceWorker: {
                register() { return Promise.reject(new Error("blocked")); }
            }
        },
        locationObject: { hostname: "localhost" },
        secureContext: true,
        consoleObject: { warn(...args) { warnings.push(args); } }
    });

    assert(failed === null, "registration failure escaped");
    assert(warnings.length === 1, "registration failure not reported once");
    assert(await registerTrailBookServiceWorker({
        navigatorObject: {},
        locationObject: { hostname: "localhost" },
        secureContext: true
    }) === null, "unsupported browser rejected Viewer startup");
}

async function testServiceWorkerCache() {

    if (!("serviceWorker" in navigator) || !("caches" in globalThis)) {
        throw new Error("Service Worker test requires localhost support");
    }

    const scopeUrl = new URL("../../src/", location.href);
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
        .filter(registration => registration.scope === scopeUrl.href)
        .map(registration => registration.unregister()));

    for (const cacheName of await caches.keys()) {
        if (cacheName.startsWith("trailbook-app-shell-")) {
            await caches.delete(cacheName);
        }
    }

    const oldCache = await caches.open("trailbook-app-shell-obsolete");
    await oldCache.put(scopeUrl, new Response("old"));
    const unrelatedCache = await caches.open("trailbook-unrelated-test");
    await unrelatedCache.put(scopeUrl, new Response("keep"));

    const workerUrl = new URL(
        `../../src/service-worker.js?unit=${Date.now()}`,
        location.href
    );
    const registration = await navigator.serviceWorker.register(workerUrl, {
        scope: scopeUrl.pathname
    });
    await waitForActivation(registration);

    const cacheNames = await caches.keys();
    assert(!cacheNames.includes("trailbook-app-shell-obsolete"),
        "old TrailBook cache not removed");
    assert(cacheNames.includes("trailbook-unrelated-test"),
        "unrelated cache was removed");
    assert(cacheNames.includes("trailbook-app-shell-v1"),
        "versioned app shell cache missing");

    const cache = await caches.open("trailbook-app-shell-v1");
    const required = [
        "index.html",
        "manifest.webmanifest",
        "css/base.css",
        "css/layout.css",
        "css/theme.css",
        "vendor/leaflet/leaflet.css",
        "vendor/leaflet/leaflet.js",
        "icons/trailbook-192.png",
        "icons/trailbook-512.png",
        "js/main.js"
    ];

    for (const path of required) {
        assert(await cache.match(new URL(path, scopeUrl)), `not precached: ${path}`);
    }

    const cachedRequests = await cache.keys();
    const cachedModules = cachedRequests.filter(request =>
        new URL(request.url).pathname.includes("/js/") &&
        new URL(request.url).pathname.endsWith(".js")
    );
    assert(cachedModules.length === 97, "production module graph not precached");
    assert(!cachedRequests.some(request => request.url.endsWith(".gpx")),
        "GPX entered app shell cache");
    assert(!cachedRequests.some(request => request.url.includes("googleapis.com")),
        "Google API response entered app shell cache");
    assert(!cachedRequests.some(request => request.url.includes("tile.openstreetmap.org")),
        "map tile entered app shell cache");
    assert(!cachedRequests.some(request => request.url.includes(
        "trailbook.local-config.js"
    )), "runtime Google config entered app shell cache");

    const cachedIndex = await cache.match(new URL("index.html", scopeUrl));
    const cachedMain = await cache.match(new URL("js/main.js", scopeUrl));
    const cachedLeaflet = await cache.match(new URL(
        "vendor/leaflet/leaflet.js", scopeUrl
    ));
    assert(cachedIndex?.ok, "offline index unavailable");
    assert(cachedMain?.ok, "offline production JS unavailable");
    assert(cachedLeaflet?.ok, "offline vendor asset unavailable");

    await registration.unregister();
    await caches.delete("trailbook-app-shell-v1");
    await caches.delete("trailbook-unrelated-test");
}

try {
    await testManifestAndAssets();
    await testRegistrationContract();
    await testServiceWorkerCache();
    output.textContent = `PASS: ${assertions} assertions`;
} catch (error) {
    output.textContent = `FAIL after ${assertions} assertions\n${error.stack}`;
    throw error;
}
