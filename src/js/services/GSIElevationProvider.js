const ENDPOINT = "https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php";

/** Online ground elevation only. Future offline providers can implement lookup(). */
export default class GSIElevationProvider {
    constructor({ fetchFunction = (...args) => globalThis.fetch(...args), timeoutMs = 8000 } = {}) {
        this.fetchFunction = fetchFunction;
        this.timeoutMs = timeoutMs;
    }

    async lookup({ latitude, longitude }, { signal } = {}) {
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new Error("Invalid elevation coordinates");
        }
        const url = new URL(ENDPOINT);
        url.searchParams.set("lat", String(latitude));
        url.searchParams.set("lon", String(longitude));
        url.searchParams.set("outtype", "JSON");
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, this.timeoutMs);
        try {
            const response = await this.fetchFunction(url.href, {
                signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer"
            });
            if (!response.ok) throw new Error(`Elevation HTTP ${response.status}`);
            const data = await response.json();
            if (typeof data.elevation !== "number" || !Number.isFinite(data.elevation) ||
                typeof data.hsrc !== "string" || !data.hsrc || data.hsrc === "-----") {
                throw new Error("Elevation is unavailable");
            }
            return { meters: data.elevation, source: "国土地理院", dataset: data.hsrc };
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
        }
    }
}
