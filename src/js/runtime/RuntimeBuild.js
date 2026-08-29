const DEPLOYED_BUILD_ID = "__TRAILBOOK_RUNTIME_BUILD_ID__";

export const RUNTIME_BUILD_ID = /^[0-9a-f]{8}$/i.test(DEPLOYED_BUILD_ID)
    ? DEPLOYED_BUILD_ID.toLowerCase()
    : "local";
