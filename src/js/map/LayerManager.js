const FIT_PADDING = [20, 20];

/**
 * Manages independent Track and Waypoint layers for displayed GPX files.
 */
export default class LayerManager {

    constructor(map, mapConfig, options = {}) {

        this.map = map;
        this.mapConfig = mapConfig;
        this.trackRenderer = options.trackRenderer || null;
        this.onTrackClick = options.onTrackClick || null;
        this.layers = new Map();
        this.selectedPath = null;
    }

    displayGPX(path, result, style, options = {}) {

        this.removeGPX(path);

        const trackLayerGroup = L.layerGroup().addTo(this.map);
        const trackBounds = [];
        const trackStyle = style || this.mapConfig.trackStyle;
        const segments = [];

        result.tracks.forEach(track => {
            track.segments.forEach(segment => {
                const latLngs = segment.points.map(point => {
                    const latLng = [point.latitude, point.longitude];
                    trackBounds.push(latLng);
                    return latLng;
                });

                if (latLngs.length > 0) {
                    const mainLayer = L.polyline(latLngs, {
                        ...trackStyle,
                        renderer: this.trackRenderer,
                        interactive: true,
                        bubblingMouseEvents: false,
                        gpxPath: path
                    }).addTo(trackLayerGroup);

                    mainLayer.on("click", event => {
                        const currentEntry = this.layers.get(path);
                        const isCurrentLayer = currentEntry?.segments.some(
                            currentSegment => currentSegment.mainLayer === mainLayer
                        );

                        if (!isCurrentLayer) {
                            return;
                        }

                        this.onTrackClick?.(path, event);
                    });

                    segments.push({ latLngs, mainLayer });
                }
            });
        });

        this.layers.set(path, {
            trackLayerGroup,
            outlineLayerGroup: null,
            waypointLayerGroup: null,
            segments,
            trackBounds,
            normalStyle: { ...trackStyle },
            selectedMainStyle: null,
            selectedOutlineStyle: null,
            color: trackStyle.color || trackStyle.lineColor || null,
            waypointCount: result.waypoints.length
        });

        if (options.showWaypoints) {
            this.addWaypoints(path, result);
        }
    }

    addWaypoints(path, result) {

        const entry = this.layers.get(path);

        if (!entry || entry.waypointLayerGroup || result.waypoints.length === 0) {
            return;
        }

        const waypointLayerGroup = L.layerGroup().addTo(this.map);

        result.waypoints.forEach(waypoint => {
            L.marker([waypoint.latitude, waypoint.longitude])
                .addTo(waypointLayerGroup);
        });

        entry.waypointLayerGroup = waypointLayerGroup;
    }

    removeWaypoints(path) {

        const entry = this.layers.get(path);

        if (!entry?.waypointLayerGroup) {
            return;
        }

        entry.waypointLayerGroup.remove();
        entry.waypointLayerGroup = null;
    }

    removeGPX(path) {

        const entry = this.layers.get(path);

        if (!entry) {
            return;
        }

        if (this.selectedPath === path) {
            this.clearSelectionHighlight();
        }

        entry.trackLayerGroup.remove();
        entry.outlineLayerGroup?.remove();
        entry.waypointLayerGroup?.remove();
        this.layers.delete(path);
    }

    clear() {

        this.clearSelectionHighlight();

        this.layers.forEach(entry => {
            entry.trackLayerGroup.remove();
            entry.outlineLayerGroup?.remove();
            entry.waypointLayerGroup?.remove();
        });

        this.layers.clear();
    }

    refocus() {

        this.#fitBounds(this.#allBounds());
    }

    refocusGPX(path) {

        const bounds = this.layers.get(path)?.trackBounds || [];

        if (bounds.length === 0) {
            return;
        }

        this.#fitBounds(bounds);
    }

    hasDisplay(path) {

        if (path !== undefined) {
            return this.layers.has(path);
        }

        return this.layers.size > 0;
    }

    getDisplayedPaths() {

        return [...this.layers.keys()];
    }

    updateTrackWeights(weight) {

        if (!Number.isFinite(weight) || weight <= 0) {
            return 0;
        }

        const selectedWeight = weight + (
            this.mapConfig.trackStyle.selectedWeightOffset || 3
        );

        return this.updateTrackStyles({
            normalWeight: weight,
            selectedMainWeight: selectedWeight,
            outlineWeight: selectedWeight + (
                this.mapConfig.trackStyle.outlineWeightOffset || 2
            )
        });
    }

    updateTrackStyles({
        normalWeight,
        selectedMainWeight,
        outlineWeight
    } = {}) {

        if (
            !this.#isValidWeight(normalWeight) ||
            !this.#isValidWeight(selectedMainWeight) ||
            !this.#isValidWeight(outlineWeight)
        ) {
            return 0;
        }

        let updatedCount = 0;

        this.layers.forEach((entry, path) => {
            const isSelected = path === this.selectedPath;

            entry.normalStyle.weight = normalWeight;

            entry.segments.forEach(({ mainLayer }) => {
                mainLayer.setStyle({
                    weight: isSelected ? selectedMainWeight : normalWeight
                });
                updatedCount += 1;
            });

            if (!isSelected) {
                return;
            }

            entry.selectedMainStyle.weight = selectedMainWeight;
            entry.selectedOutlineStyle.weight = outlineWeight;
            entry.outlineLayerGroup?.eachLayer(layer => {
                layer.setStyle({ weight: outlineWeight });
                updatedCount += 1;
            });
        });

        return updatedCount;
    }

    updateTrackColor(path, {
        normalStyle,
        selectedMainStyle,
        selectedOutlineStyle
    } = {}) {

        const entry = this.layers.get(path);

        if (
            !entry ||
            typeof normalStyle?.color !== "string" ||
            normalStyle.color.length === 0 ||
            (path === this.selectedPath &&
                (!selectedMainStyle || !selectedOutlineStyle))
        ) {
            return 0;
        }

        const isSelected = path === this.selectedPath;

        entry.normalStyle = { ...normalStyle };
        entry.color = normalStyle.color;

        if (isSelected && selectedMainStyle && selectedOutlineStyle) {
            entry.selectedMainStyle = { ...selectedMainStyle };
            entry.selectedOutlineStyle = {
                ...selectedOutlineStyle,
                interactive: false
            };
        }

        entry.segments.forEach(({ mainLayer }) => {
            mainLayer.setStyle(
                isSelected ? entry.selectedMainStyle : entry.normalStyle
            );
        });

        if (isSelected) {
            entry.outlineLayerGroup?.eachLayer(layer => {
                layer.setStyle(entry.selectedOutlineStyle);
            });
        }

        return entry.segments.length;
    }

    setSelectedPath(path, selectedMainStyle, selectedOutlineStyle) {

        if (path === this.selectedPath) {
            return false;
        }

        const entry = this.layers.get(path);

        if (!entry) {
            return false;
        }

        this.clearSelectionHighlight();

        entry.selectedMainStyle = { ...selectedMainStyle };
        entry.selectedOutlineStyle = {
            ...selectedOutlineStyle,
            interactive: false
        };
        entry.outlineLayerGroup = L.layerGroup().addTo(this.map);

        entry.segments.forEach(({ latLngs, mainLayer }) => {
            L.polyline(latLngs, {
                ...entry.selectedOutlineStyle,
                renderer: this.trackRenderer,
                interactive: false,
                bubblingMouseEvents: false
            }).addTo(entry.outlineLayerGroup);
            mainLayer.setStyle(entry.selectedMainStyle);
            mainLayer.bringToFront();
        });

        this.selectedPath = path;

        return true;
    }

    clearSelectionHighlight() {

        const entry = this.layers.get(this.selectedPath);

        if (!entry) {
            this.selectedPath = null;
            return false;
        }

        entry.outlineLayerGroup?.remove();
        entry.outlineLayerGroup = null;
        entry.segments.forEach(({ mainLayer }) => {
            mainLayer.setStyle(entry.normalStyle);
        });
        entry.selectedMainStyle = null;
        entry.selectedOutlineStyle = null;
        this.selectedPath = null;

        return true;
    }

    #isValidWeight(weight) {

        return Number.isFinite(weight) && weight > 0;
    }

    #allBounds() {

        return [...this.layers.values()].flatMap(entry => entry.trackBounds);
    }

    #fitBounds(bounds) {

        if (bounds.length >= 2) {
            this.map.fitBounds(bounds, { padding: FIT_PADDING });
            return;
        }

        if (bounds.length === 1) {
            this.map.setView(bounds[0], this.mapConfig.singlePointZoom);
            return;
        }

        this.map.setView(
            [
                this.mapConfig.center.latitude,
                this.mapConfig.center.longitude
            ],
            this.mapConfig.initialZoom
        );
    }
}
