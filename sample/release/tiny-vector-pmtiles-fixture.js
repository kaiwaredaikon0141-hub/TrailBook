function concat(...parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

function varint(value) {
    const result = [];
    let current = value >>> 0;
    while (current > 127) {
        result.push((current & 127) | 128);
        current >>>= 7;
    }
    result.push(current);
    return Uint8Array.from(result);
}

function bytesField(field, value) {
    return concat(varint((field << 3) | 2), varint(value.length), value);
}

function uintField(field, value) {
    return concat(varint(field << 3), varint(value));
}

function text(value) {
    return new TextEncoder().encode(value);
}

function stringValue(value) {
    return bytesField(1, text(value));
}

function zigzag(value) {
    return ((value << 1) ^ (value >> 31)) >>> 0;
}

function feature({ id, type, tags, geometry }) {
    return concat(
        uintField(1, id),
        bytesField(2, concat(...tags.map(varint))),
        uintField(3, type),
        bytesField(4, concat(...geometry.map(varint)))
    );
}

function layer(name, properties, features) {
    const keys = [];
    const values = [];
    const tagsFor = props => {
        const result = [];
        for (const [key, value] of Object.entries(props)) {
            let keyIndex = keys.indexOf(key);
            if (keyIndex < 0) {
                keyIndex = keys.push(key) - 1;
            }
            let valueIndex = values.indexOf(value);
            if (valueIndex < 0) {
                valueIndex = values.push(value) - 1;
            }
            result.push(keyIndex, valueIndex);
        }
        return result;
    };
    const encodedFeatures = features.map((item, index) => bytesField(2,
        feature({ ...item, id: index + 1, tags: tagsFor(properties[index]) })
    ));
    return concat(
        bytesField(1, text(name)),
        ...encodedFeatures,
        ...keys.map(key => bytesField(3, text(key))),
        ...values.map(value => bytesField(4, stringValue(value))),
        uintField(5, 4096),
        uintField(15, 2)
    );
}

function vectorTile() {
    const road = layer("roads", [{
        kind: "major_road",
        name: "Fixture Road",
        "name:ja": "テスト道路"
    }], [{
        type: 2,
        geometry: [9, zigzag(256), zigzag(2048), 10,
            zigzag(3584), zigzag(0)]
    }]);
    const water = layer("water", [{ kind: "lake" }], [{
        type: 3,
        geometry: [9, zigzag(512), zigzag(512), 26,
            zigzag(3072), zigzag(0),
            zigzag(0), zigzag(3072),
            zigzag(-3072), zigzag(0), 15]
    }]);
    const place = layer("places", [{
        kind: "locality",
        name: "Fixture City",
        "name:ja": "テスト市"
    }, {
        kind: "locality",
        name: "Fallback Town"
    }], [{
        type: 1,
        geometry: [9, zigzag(2048), zigzag(2048)]
    }, {
        type: 1,
        geometry: [9, zigzag(1024), zigzag(1024)]
    }]);
    return concat(
        bytesField(3, road),
        bytesField(3, water),
        bytesField(3, place)
    );
}

function setUint64(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
    view.setUint32(offset + 4, Math.floor(value / 2 ** 32), true);
}

export function createTinyVectorPMTiles({ tileType = 1 } = {}) {
    const tile = vectorTile();
    const metadata = text(JSON.stringify({
        name: "Tiny Vector Fixture",
        attribution: "Vector fixture attribution",
        vector_layers: [
            { id: "roads", fields: { name: "String", "name:ja": "String" } },
            { id: "water", fields: { kind: "String" } },
            { id: "places", fields: { name: "String", "name:ja": "String" } }
        ]
    }));
    const root = concat(
        Uint8Array.of(1, 0, 1),
        varint(tile.length),
        Uint8Array.of(1)
    );
    const rootOffset = 127;
    const metadataOffset = rootOffset + root.length;
    const tileOffset = metadataOffset + metadata.length;
    const bytes = new Uint8Array(tileOffset + tile.length);
    bytes.set(text("PMTiles"), 0);
    const view = new DataView(bytes.buffer);
    view.setUint8(7, 3);
    [
        [8, rootOffset], [16, root.length],
        [24, metadataOffset], [32, metadata.length],
        [40, tileOffset], [48, 0],
        [56, tileOffset], [64, tile.length],
        [72, 1], [80, 1], [88, 1]
    ].forEach(([offset, value]) => setUint64(view, offset, value));
    view.setUint8(96, 1);
    view.setUint8(97, 1);
    view.setUint8(98, 1);
    view.setUint8(99, tileType);
    view.setUint8(100, 0);
    view.setUint8(101, 0);
    view.setInt32(102, -1800000000, true);
    view.setInt32(106, -850511288, true);
    view.setInt32(110, 1800000000, true);
    view.setInt32(114, 850511288, true);
    view.setUint8(118, 0);
    view.setInt32(119, 0, true);
    view.setInt32(123, 0, true);
    bytes.set(root, rootOffset);
    bytes.set(metadata, metadataOffset);
    bytes.set(tile, tileOffset);
    return bytes;
}
