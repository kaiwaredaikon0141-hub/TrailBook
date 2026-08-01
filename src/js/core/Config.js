/**
 * TrailBook Global Configuration
 */

const Config = {

    appName: "TrailBook",

    version: "0.6.0",

    map: {

        center: {
            latitude: 36.2,
            longitude: 138.25
        },

        initialZoom: 5,

        singlePointZoom: 15,

        tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

        tileAttribution: "© OpenStreetMap contributors",

        tileMaxZoom: 19,

        trackStyle: {
            lineColor: "#e53935",
            lineWeight: 4,
            lineOpacity: 0.85
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
    },

    debug: true

};

export default Config;