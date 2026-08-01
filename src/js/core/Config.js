/**
 * TrailBook Global Configuration
 */

const Config = {

    appName: "TrailBook",

    version: "0.5.0",

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
        }
    },

    debug: true

};

export default Config;