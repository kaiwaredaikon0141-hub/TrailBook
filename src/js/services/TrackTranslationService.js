const METERS_PER_LATITUDE_DEGREE = 111320;
const MAX_LATITUDE = 90;

export const ZERO_TRACK_TRANSLATION = Object.freeze({
    latitudeDelta: 0,
    longitudeDelta: 0,
    northMeters: 0,
    eastMeters: 0,
    referenceLatitude: 0
});

/**
 * Calculates and applies one geographic offset to Track Points only.
 */
export default class TrackTranslationService {

    normalize(value = ZERO_TRACK_TRANSLATION) {

        value ||= ZERO_TRACK_TRANSLATION;
        const normalized = {
            latitudeDelta: Number(value.latitudeDelta) || 0,
            longitudeDelta: Number(value.longitudeDelta) || 0,
            northMeters: Number(value.northMeters) || 0,
            eastMeters: Number(value.eastMeters) || 0,
            referenceLatitude: Number(value.referenceLatitude) || 0
        };

        return Object.freeze(normalized);
    }

    isZero(value) {

        const offset = this.normalize(value);

        return Math.abs(offset.latitudeDelta) < 1e-12 &&
            Math.abs(offset.longitudeDelta) < 1e-12;
    }

    calculateFromDrag(map, startPoint, endPoint, base = ZERO_TRACK_TRANSLATION) {

        if (!map?.project || !map?.unproject || !map?.getCenter) {
            throw new TypeError("A project-capable Leaflet Map is required");
        }

        const start = this.#point(startPoint);
        const end = this.#point(endPoint);
        const current = this.normalize(base);
        const zoom = map.getZoom?.();
        const anchor = map.getCenter();
        const projected = map.project(anchor, zoom);
        const translated = map.unproject({
            x: projected.x + end.x - start.x,
            y: projected.y + end.y - start.y
        }, zoom);
        const latitudeDelta = current.latitudeDelta +
            translated.lat - anchor.lat;
        const longitudeDelta = this.#normalizeLongitudeDelta(
            current.longitudeDelta + translated.lng - anchor.lng
        );
        const referenceLatitude = Number(anchor.lat) || 0;

        return this.normalize({
            latitudeDelta,
            longitudeDelta,
            northMeters: latitudeDelta * METERS_PER_LATITUDE_DEGREE,
            eastMeters: longitudeDelta * METERS_PER_LATITUDE_DEGREE *
                Math.cos(referenceLatitude * Math.PI / 180),
            referenceLatitude
        });
    }

    translateCoordinate(latitude, longitude, value) {

        const offset = this.normalize(value);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
        }

        return Object.freeze({
            latitude: Math.max(
                -MAX_LATITUDE,
                Math.min(MAX_LATITUDE, latitude + offset.latitudeDelta)
            ),
            longitude: this.#wrapLongitude(longitude + offset.longitudeDelta)
        });
    }

    apply(document, value) {

        const offset = this.normalize(value);

        if (this.isZero(offset)) return 0;

        let changed = 0;

        this.#children(document?.documentElement, "trk").forEach(track => {
            this.#children(track, "trkseg").forEach(segment => {
                this.#children(segment, "trkpt").forEach(point => {
                    const latitude = Number(point.getAttribute("lat"));
                    const longitude = Number(point.getAttribute("lon"));
                    const translated = this.translateCoordinate(
                        latitude,
                        longitude,
                        offset
                    );

                    if (!translated) return;

                    point.setAttribute(
                        "lat",
                        this.#formatCoordinate(
                            translated.latitude,
                            point.getAttribute("lat")
                        )
                    );
                    point.setAttribute(
                        "lon",
                        this.#formatCoordinate(
                            translated.longitude,
                            point.getAttribute("lon")
                        )
                    );
                    changed += 1;
                });
            });
        });

        return changed;
    }

    #formatCoordinate(value, original) {

        const match = /\.(\d+)/.exec(String(original || ""));
        const precision = Math.max(7, match?.[1]?.length || 0);

        return value.toFixed(Math.min(precision, 15));
    }

    #normalizeLongitudeDelta(value) {

        let normalized = value;

        while (normalized > 180) normalized -= 360;
        while (normalized < -180) normalized += 360;
        return normalized;
    }

    #wrapLongitude(value) {

        let normalized = value;

        while (normalized > 180) normalized -= 360;
        while (normalized < -180) normalized += 360;
        return normalized;
    }

    #point(value) {

        if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) {
            throw new TypeError("Drag points must contain finite x/y values");
        }

        return value;
    }

    #children(element, localName) {

        return Array.from(element?.children || []).filter(
            child => child.localName === localName
        );
    }
}
