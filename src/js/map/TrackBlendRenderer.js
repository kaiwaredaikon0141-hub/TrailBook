/** Blend Track strokes with each other without blending the basemap. */
export default function createTrackBlendRenderer(leaflet, tolerance) {

    if (typeof leaflet.Canvas?.extend !== "function") {
        return leaflet.canvas({ tolerance });
    }

    const invertedColors = new Map();
    const invertedStyles = new WeakMap();
    let colorContext;

    function invertColor(color) {
        if (invertedColors.has(color)) return invertedColors.get(color);

        if (!colorContext) {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            colorContext = canvas.getContext("2d", { willReadFrequently: true });
        }
        // Normalize CSS colors once, not by reading the Track canvas per frame.
        colorContext.clearRect(0, 0, 1, 1);
        colorContext.fillStyle = "#000000";
        colorContext.fillStyle = color;
        colorContext.fillRect(0, 0, 1, 1);
        const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data;
        const inverted = `rgba(${255 - red}, ${255 - green}, ${255 - blue}, ${alpha / 255})`;
        if (invertedColors.size >= 256) invertedColors.clear();
        invertedColors.set(color, inverted);
        return inverted;
    }

    function darkPresentation(layer) {
        const options = layer.options;
        let cached = invertedStyles.get(options);
        if (!cached || cached.color !== options.color ||
            cached.fillColor !== options.fillColor) {
            // Inherit live weight/opacity/dash state without mutating model styles.
            const presentation = Object.create(options);
            presentation.color = invertColor(options.color);
            presentation.fillColor = invertColor(options.fillColor || options.color);
            cached = { color: options.color, fillColor: options.fillColor,
                layer: { options: presentation } };
            invertedStyles.set(options, cached);
        }
        return cached.layer;
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

        _draw() {
            leaflet.Canvas.prototype._draw.call(this);
            // multiply(a,b) = invert(screen(invert(a),invert(b))).
            // Invert this transparent Track surface once, never the basemap.
            // Commit the filter with the redraw to avoid a mode-switch flash.
            const filter = this.blendMode === "multiply" ? "invert(1)" : "";
            if (this._container.style.filter !== filter) {
                this._container.style.filter = filter;
            }
        },

        _fillStroke(context, layer) {
            const presentation = this.blendMode === "multiply"
                ? darkPresentation(layer) : layer;
            if (!layer.options.trackBlend) {
                leaflet.Canvas.prototype._fillStroke.call(this, context, presentation);
                return;
            }

            context.save();
            context.globalCompositeOperation = "screen";
            try {
                leaflet.Canvas.prototype._fillStroke.call(this, context, presentation);
            } finally {
                context.restore();
            }
        }
    });

    return new TrackBlendCanvas({ tolerance });
}
