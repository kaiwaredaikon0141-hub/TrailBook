/**
 * TrailBook Global Configuration
 */

const Config = {

    version: "1.0.0",

    uiSettings: {
        storageKey: "trailbook.uiSettings",
        schemaVersion: 1
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
            lineOpacity: 0.85,
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
