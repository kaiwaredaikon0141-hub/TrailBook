export function resolvePathHashColor(path, palette) {

    let hash = 0;

    for (let index = 0; index < path.length; index += 1) {
        hash = ((hash << 5) - hash + path.charCodeAt(index)) | 0;
    }

    return palette[Math.abs(hash) % palette.length];
}
