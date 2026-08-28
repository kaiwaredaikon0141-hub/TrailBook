import {
    cleanupLocalTrailBookServiceWorker,
    isLocalDevelopmentLocation,
    isServiceWorkerLocationAllowed,
    registerTrailBookServiceWorker
} from "../../src/js/services/PWAServiceWorker.js";
import Config from "../../src/js/core/Config.js";
import {
    createBuildInfoElement,
    getBuildIdentifier,
    getDevelopmentBuildIdentifier,
    resolveBuildInfoElements,
    updateBuildInfoElement
} from "../../src/js/ui/BuildInfoView.js";

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
    assert(index.includes('src="trailbook.build.js"'), "build runtime missing");
    assert(
        index.indexOf('src="trailbook.build.js"') <
        index.indexOf('src="js/main.js"'),
        "build runtime loads after application"
    );
    assert(!index.includes('href="/'), "root-absolute index asset URL");
    assert(index.includes('id = "trailbook-development-build-info"') &&
        index.includes("getDevelopmentBuildIdentifier") &&
        index.includes("dev-checking...") &&
        index.includes("SW: disabled"),
    "localhost bootstrap build diagnostic missing");

    const buildSource = await fetch(new URL(
        "../../src/trailbook.build.js", location.href
    )).then(response => response.text());
    assert(buildSource.includes('commit: "local"'), "localhost build fallback");
    assert(!buildSource.includes("development:"),
        "fixed localhost development build stamp retained");
    assert(!buildSource.includes(Config.version), "version duplicated in build runtime");

    assert(getBuildIdentifier({ commit: "431FB68Cbe81145f" }) === "431fb68c",
        "short build identifier");
    assert(getBuildIdentifier({ commit: "local" }) === "local",
        "invalid build did not use local fallback");
    const buildInfo = createBuildInfoElement({
        config: Config,
        runtimeBuild: { commit: "431fb68cbe81145f" },
        locationObject: { hostname: "example.github.io" }
    });
    assert(buildInfo.textContent ===
        `TrailBook v${Config.version} · 431fb68c · SW: checking`,
        "version / build display");
    updateBuildInfoElement(buildInfo, {
        config: Config,
        runtimeBuild: { commit: "431fb68cbe81145f" },
        locationObject: { hostname: "example.github.io" },
        serviceWorkerStatus: "active"
    });
    assert(buildInfo.textContent.endsWith("SW: active"),
        "Pages Service Worker status display");

    const localBuildInfo = createBuildInfoElement({
        config: Config,
        runtimeBuild: { commit: "local" },
        locationObject: { hostname: "localhost" }
    });
    assert(localBuildInfo.textContent ===
        `TrailBook v${Config.version} · local · dev-checking... · SW: disabled`,
        "localhost checking build display");

    const sourceBodies = new Map([
        ["http://localhost/src/js/main.js", 'import "./feature.js";'],
        ["http://localhost/src/js/feature.js", "export const value = 1;"],
        ["http://localhost/src/index.html", "<html>TrailBook</html>"]
    ]);
    const fetchOptions = [];
    const fetchFunction = async (url, options) => {
        fetchOptions.push(options);
        return {
            ok: sourceBodies.has(url),
            text: async () => sourceBodies.get(url)
        };
    };
    const fingerprintOptions = {
        locationObject: { hostname: "localhost" },
        fetchFunction,
        cryptoObject: globalThis.crypto,
        moduleEntryUrl: "http://localhost/src/js/main.js",
        sourceUrls: ["http://localhost/src/index.html"]
    };
    const firstFingerprint = await getDevelopmentBuildIdentifier(
        fingerprintOptions
    );
    const repeatedFingerprint = await getDevelopmentBuildIdentifier(
        fingerprintOptions
    );

    assert(/^dev-[0-9a-f]{8}$/.test(firstFingerprint),
        "localhost source fingerprint format");
    assert(firstFingerprint === repeatedFingerprint,
        "same source bytes changed fingerprint");
    sourceBodies.set(
        "http://localhost/src/js/feature.js",
        "export const value = 2;"
    );
    const changedFingerprint = await getDevelopmentBuildIdentifier(
        fingerprintOptions
    );
    assert(changedFingerprint !== firstFingerprint,
        "changed imported module did not change fingerprint");
    assert(fetchOptions.every(options => options.cache === "no-store"),
        "development fingerprint fetch used browser cache");

    const compactBuildInfo = createBuildInfoElement({
        config: Config,
        runtimeBuild: { commit: "local" },
        locationObject: { hostname: "localhost" },
        compact: true
    });
    await resolveBuildInfoElements([localBuildInfo, compactBuildInfo], {
        config: Config,
        runtimeBuild: { commit: "local" },
        locationObject: { hostname: "localhost" },
        serviceWorkerRegistration: null,
        developmentBuildIdentifier: changedFingerprint
    });
    assert(localBuildInfo.textContent.includes(changedFingerprint) &&
        localBuildInfo.textContent.endsWith("SW: disabled"),
        "resolved localhost build diagnostics");
    assert(compactBuildInfo.textContent.startsWith(`v${Config.version}`) &&
        compactBuildInfo.textContent.includes(changedFingerprint),
        "compact localhost build diagnostics");

    const mainSource = await fetch(new URL(
        "../../src/js/main.js", location.href
    )).then(response => response.text());
    assert(mainSource.includes("trailbook-development-build-info"),
        "localhost fixed build diagnostic is not attached");

    const themeSource = await fetch(new URL(
        "../../src/css/theme.css", location.href
    )).then(response => response.text());
    assert(themeSource.includes(".trailbook-development-build-info") &&
        themeSource.includes("position:fixed"),
    "localhost fixed build diagnostic CSS missing");

    const workflow = await fetch(new URL(
        "../../.github/workflows/pages.yml", location.href
    )).then(response => response.text());
    assert(workflow.includes('Path("_site/trailbook.build.js")'),
        "Pages artifact build runtime generation missing");
    assert(workflow.includes('os.environ.get("GITHUB_SHA"'),
        "Pages build does not use commit SHA");
    assert(workflow.includes('"__TRAILBOOK_BUILD_ID__"'),
        "Pages Service Worker build replacement missing");

    const workerSource = await fetch(new URL(
        "../../src/service-worker.js", location.href
    )).then(response => response.text());
    const deployedWorker = workerSource.replace(
        "__TRAILBOOK_BUILD_ID__",
        "431fb68c"
    );
    assert(workerSource.includes('"./trailbook.build.js"'),
        "build runtime not in app shell");
    assert(deployedWorker.includes('APP_SHELL_BUILD_ID = "431fb68c"'),
        "deploy build does not update Service Worker source");
    assert(!deployedWorker.includes('APP_SHELL_CACHE_PREFIX}v1'),
        "fixed app shell cache version retained");
    assert(!workerSource.includes("self.location.hostname"),
        "localhost-only fetch branch remains in production worker");
    assert(workerSource.indexOf("const cached = await cache.match(request)") <
        workerSource.indexOf("return await fetch(request)"),
    "production app shell is no longer cache-first");

    const mobileCss = await fetch(new URL(
        "../../src/css/theme.css", location.href
    )).then(response => response.text());
    assert(
        mobileCss.includes(".leaflet-top.leaflet-left .leaflet-control-zoom") &&
        mobileCss.includes(".leaflet-control-zoom a") &&
        mobileCss.includes("height:60px") &&
        mobileCss.includes("line-height:60px"),
        "Pages source does not contain the large horizontal mobile zoom row"
    );
}

async function testRegistrationContract() {

    assert(isLocalDevelopmentLocation({ hostname: "localhost" }),
        "localhost not detected as development");
    assert(isLocalDevelopmentLocation({ hostname: "127.0.0.1" }),
        "127.0.0.1 not detected as development");
    assert(isLocalDevelopmentLocation({ hostname: "[::1]" }),
        "IPv6 localhost not detected as development");
    assert(!isLocalDevelopmentLocation({ hostname: "example.github.io" }),
        "Pages origin detected as local development");
    assert(isServiceWorkerLocationAllowed(
        { hostname: "example.github.io" }, true
    ), "HTTPS secure context rejected");
    assert(!isServiceWorkerLocationAllowed(
        { hostname: "localhost" }, true
    ), "localhost Service Worker registration accepted");
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
        locationObject: {
            hostname: "example.github.io",
            href: "https://example.github.io/TrailBook/index.html"
        },
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
        locationObject: {
            hostname: "example.github.io",
            href: "https://example.github.io/TrailBook/index.html"
        },
        secureContext: true,
        consoleObject: { warn(...args) { warnings.push(args); } }
    });

    assert(failed === null, "registration failure escaped");
    assert(warnings.length === 1, "registration failure not reported once");
    assert(await registerTrailBookServiceWorker({
        navigatorObject: {},
        locationObject: { hostname: "example.github.io" },
        secureContext: true
    }) === null, "unsupported browser rejected Viewer startup");

    let localRegisterCalls = 0;
    let targetUnregisterCalls = 0;
    let unrelatedUnregisterCalls = 0;
    const deletedCaches = [];
    const localNavigator = {
        serviceWorker: {
            register() {
                localRegisterCalls += 1;
                return Promise.resolve({});
            },
            getRegistrations() {
                return Promise.resolve([
                    {
                        scope: "http://localhost:8000/src/",
                        unregister() {
                            targetUnregisterCalls += 1;
                            return Promise.resolve(true);
                        }
                    },
                    {
                        scope: "http://localhost:8000/other/",
                        unregister() {
                            unrelatedUnregisterCalls += 1;
                            return Promise.resolve(true);
                        }
                    }
                ]);
            }
        }
    };
    const localCaches = {
        keys() {
            return Promise.resolve([
                "trailbook-app-shell-old",
                "trailbook-app-shell-local",
                "unrelated-cache"
            ]);
        },
        delete(name) {
            deletedCaches.push(name);
            return Promise.resolve(true);
        }
    };
    const localLocation = {
        hostname: "localhost",
        href: "http://localhost:8000/src/index.html"
    };
    const localResult = await registerTrailBookServiceWorker({
        navigatorObject: localNavigator,
        locationObject: localLocation,
        secureContext: true,
        cacheStorage: localCaches
    });

    assert(localResult === null, "localhost registration did not stop");
    assert(localRegisterCalls === 0, "localhost registered a new worker");
    assert(targetUnregisterCalls === 1,
        "current TrailBook scope worker not unregistered");
    assert(unrelatedUnregisterCalls === 0,
        "unrelated Service Worker was unregistered");
    assert(deletedCaches.length === 2 &&
        deletedCaches.every(name => name.startsWith("trailbook-app-shell-")),
    "TrailBook cache cleanup scope changed");
    assert(!deletedCaches.includes("unrelated-cache"),
        "unrelated cache was deleted");

    let nonLocalTouched = false;
    const nonLocalCleanup = await cleanupLocalTrailBookServiceWorker({
        navigatorObject: {
            serviceWorker: {
                getRegistrations() {
                    nonLocalTouched = true;
                    return Promise.resolve([]);
                }
            }
        },
        locationObject: {
            hostname: "example.github.io",
            href: "https://example.github.io/TrailBook/"
        },
        cacheStorage: {
            keys() {
                nonLocalTouched = true;
                return Promise.resolve([]);
            }
        }
    });
    assert(nonLocalCleanup === false && !nonLocalTouched,
        "production origin entered local cleanup");
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
    assert(cacheNames.includes("trailbook-app-shell-local"),
        "versioned app shell cache missing");

    const cache = await caches.open("trailbook-app-shell-local");
    const required = [
        "index.html",
        "manifest.webmanifest",
        "trailbook.build.js",
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
    assert(cachedModules.length === 103, "production module graph not precached");
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
    await caches.delete("trailbook-app-shell-local");
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
