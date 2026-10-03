/** Mirrors one renderer-owned Track blend choice in desktop and mobile UI. */
export default class TrackBlendModeControl {

    constructor(mapView, settingsStore = null) {
        this.mapView = mapView;
        this.settingsStore = settingsStore;
        this.selects = [];
    }

    attach() {
        this.mapView.trackRenderer.setBlendMode(
            this.settingsStore?.getTrackBlendMode() ?? "screen");
        const targets = [
            this.mapView.element.querySelector(".map-toolbar"),
            this.mapView.sidebarDisplayControls
        ];
        targets.forEach(target => {
            if (!target) return;
            const label = document.createElement("label");
            label.className = "track-blend-control";
            label.innerHTML = `
                <span>Trackの重なり</span>
                <select aria-label="Trackの重なり方">
                    <option value="screen">明るく</option>
                    <option value="multiply">暗く</option>
                </select>`;
            const select = label.querySelector("select");
            select.value = this.mapView.trackRenderer.getBlendMode();
            select.addEventListener("change", () => {
                this.mapView.trackRenderer.setBlendMode(select.value);
                this.settingsStore?.setTrackBlendMode(
                    this.mapView.trackRenderer.getBlendMode());
                this.selects.forEach(other => {
                    other.value = this.mapView.trackRenderer.getBlendMode();
                });
            });
            target.append(label);
            this.selects.push(select);
        });
    }
}
