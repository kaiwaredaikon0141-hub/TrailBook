import Config from "../core/Config.js";

export function getBuildIdentifier(
    runtimeBuild = globalThis.TRAILBOOK_BUILD
) {

    const commit = runtimeBuild?.commit;

    if (typeof commit !== "string" || !/^[0-9a-f]{7,40}$/i.test(commit)) {
        return "local";
    }

    return commit.slice(0, 8).toLowerCase();
}

export function createBuildInfoElement({
    config = Config,
    runtimeBuild = globalThis.TRAILBOOK_BUILD
} = {}) {

    const element = document.createElement("footer");
    element.className = "trailbook-build-info";
    element.textContent =
        `TrailBook v${config.version} · ${getBuildIdentifier(runtimeBuild)}`;

    return element;
}
