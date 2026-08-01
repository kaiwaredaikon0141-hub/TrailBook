export const ROOT_PATH = "";

export function parentPath(path) {

    if (!path) {
        return ROOT_PATH;
    }

    const separator = path.lastIndexOf("/");

    return separator < 0 ? ROOT_PATH : path.slice(0, separator);
}

export function joinPath(parent, name) {

    return parent ? `${parent}/${name}` : name;
}

export function isDescendant(path, parent) {

    return path.startsWith(`${parent}/`);
}

export function isSameOrDescendant(path, parent) {

    return path === parent || parent === ROOT_PATH || isDescendant(path, parent);
}

export function folderPathFromFilePath(path) {

    return parentPath(path);
}
