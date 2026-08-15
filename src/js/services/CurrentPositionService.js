export const GEOLOCATION_OPTIONS = Object.freeze({
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 15000
});

/**
 * Owns one session-only Geolocation watch.
 */
export default class CurrentPositionService {

    constructor(geolocation = globalThis.navigator?.geolocation) {

        this.geolocation = geolocation;
        this.watchId = null;
    }

    isSupported() {

        return typeof this.geolocation?.watchPosition === "function" &&
            typeof this.geolocation?.clearWatch === "function";
    }

    isTracking() {

        return this.watchId !== null;
    }

    start(onPosition, onError) {

        if (!this.isSupported()) return false;
        if (this.isTracking()) return true;

        this.watchId = this.geolocation.watchPosition(
            onPosition,
            onError,
            GEOLOCATION_OPTIONS
        );

        return true;
    }

    stop() {

        if (!this.isTracking()) return false;

        this.geolocation.clearWatch(this.watchId);
        this.watchId = null;
        return true;
    }
}
