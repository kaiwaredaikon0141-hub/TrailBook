/**
 * Prevents selection changes while keeping Map navigation available.
 */
export default class TrackEditingInteractionGuard {

    constructor(mapView, interactionRoot = null) {

        this.mapView = mapView;
        this.interactionRoot = interactionRoot;
        this.locked = false;
    }

    setLocked(locked) {

        const isLocked = Boolean(locked);

        this.locked = isLocked;
        this.mapView.setSelectionInteractionEnabled(!isLocked);

        if (!this.interactionRoot) return this.locked;

        this.interactionRoot.inert = isLocked;
        this.interactionRoot.classList.toggle("is-editing-locked", isLocked);

        if (isLocked) {
            this.interactionRoot.setAttribute("inert", "");
            this.interactionRoot.setAttribute("aria-disabled", "true");
        } else {
            this.interactionRoot.removeAttribute("inert");
            this.interactionRoot.removeAttribute("aria-disabled");
        }

        return this.locked;
    }
}
