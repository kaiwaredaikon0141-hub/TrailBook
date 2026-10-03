/** Blend Track strokes with each other without blending the basemap. */
export default function createTrackBlendRenderer(leaflet, tolerance) {

    if (typeof leaflet.Canvas?.extend !== "function") {
        return leaflet.canvas({ tolerance });
    }

    const TrackBlendCanvas = leaflet.Canvas.extend({
        blendMode: "screen",

        getBlendMode() {
            return this.blendMode;
        },

        setBlendMode(mode) {
            if (!["screen", "multiply"].includes(mode) ||
                mode === this.blendMode) return false;

            this.blendMode = mode;
            if (this._map) {
                this._redrawBounds = null;
                this._redrawRequest = this._redrawRequest ||
                    leaflet.Util.requestAnimFrame(this._redraw, this);
            }
            return true;
        },

        _fillStroke(context, layer) {
            if (!layer.options.trackBlend) {
                leaflet.Canvas.prototype._fillStroke.call(this, context, layer);
                return;
            }

            context.save();
            context.globalCompositeOperation = this.blendMode;
            try {
                leaflet.Canvas.prototype._fillStroke.call(this, context, layer);
            } finally {
                context.restore();
            }
        }
    });

    return new TrackBlendCanvas({ tolerance });
}
