/**
 * TrailBook Global Configuration
 */

export function getGoogleDriveRuntimeConfig(
    runtimeConfig = globalThis.TRAILBOOK_CONFIG
) {

    return {
        clientId: runtimeConfig?.googleOAuthClientId || "",
        apiKey: runtimeConfig?.googleApiKey || "",
        appId: runtimeConfig?.googlePickerAppId || ""
    };
}

const Config = {

    version: "1.7.0",

    uiSettings: {
        storageKey: "trailbook.uiSettings",
        schemaVersion: 1
    },

    discoveryView: {
        storageKey: "trailbook.discoveryView",
        schemaVersion: 1
    },

    viewState: {
        storageKey: "trailbook.viewState",
        schemaVersion: 1,
        debounceMs: 750,
        maxVisibleTracks: 5000,
        maxSerializedBytes: 1048576,
        minZoom: 0,
        maxZoom: 19,
        sidebarDefaultWidth: 260,
        sidebarMinWidth: 220,
        sidebarMaxWidth: 520,
        sidebarKeyboardStep: 16,
        trackInfoDefaultHeight: 220,
        trackInfoMinHeight: 120,
        trackInfoMaxHeight: 420,
        trackListMinHeight: 100,
        trackInfoKeyboardStep: 16
    },

    previousLibrary: {
        databaseName: "trailbook.runtime",
        databaseVersion: 1,
        objectStoreName: "previousLibrary",
        recordKey: "last"
    },

    googleDrive: getGoogleDriveRuntimeConfig(),

    geometryCache: {
        databaseName: "trailbook.geometryCache",
        databaseVersion: 1,
        objectStoreName: "entries",
        cacheSchemaVersion: 3,
        parserSchemaVersion: 1,
        textDecoderSchemaVersion: 1
    },

    sharedLibrarySettings: {
        fileName: "trailbook.json",
        schemaVersion: 1,
        maxFileSizeBytes: 1048576
    },

    map: {

        center: {
            latitude: 36.2,
            longitude: 138.25
        },

        initialZoom: 5,

        singlePointZoom: 15,

        tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

        tileAttribution:
            '© <a href="https://www.openstreetmap.org/copyright" ' +
            'target="_blank" rel="noopener noreferrer" ' +
            'style="text-decoration: underline;">' +
            "OpenStreetMap contributors</a>",

        tileMaxZoom: 19,

        trackStyle: {
            lineColor: "#e53935",
            lineWeight: 4,
            lineOpacity: 0.55,
            selectedWeightOffset: 3,
            selectedOpacity: 1,
            outlineWeightOffset: 2,
            outlineLightColor: "#ffffff",
            outlineDarkColor: "#263238",
            outlineOpacity: 0.95,
            hitTolerance: 6,
            fallbackZoom: 8,
            fallbackWeight: 1,
            zoomBuckets: [
                { name: "near", minZoom: 15, weight: 4 },
                { name: "middle", minZoom: 12, weight: 3 },
                { name: "far", minZoom: 9, weight: 2 },
                { name: "overview", minZoom: null, weight: 1.5 }
            ]
        },

        displayPalette: [
            "#e53935",
            "#1e88e5",
            "#43a047",
            "#fb8c00",
            "#8e24aa",
            "#00897b",
            "#6d4c41",
            "#546e7a"
        ]
    }

};

export default Config;
