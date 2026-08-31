const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const ASSETS_PREFIX = "/assets/";
const MONOREPO_PREFIX = "/assets/__monorepo/";

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

/**
 * Metro encodes assets outside projectRoot as `/assets/../..`, which URL
 * parsers collapse out of `/assets` (empty Image, no Metro error).
 * Rewrite those locations to a stable prefix Metro can serve.
 */
function plugin(assetData) {
  const location = toPosix(assetData.httpServerLocation);
  if (!location.startsWith(ASSETS_PREFIX)) {
    return assetData;
  }
  const relFromProject = location.slice(ASSETS_PREFIX.length);
  if (!relFromProject.split("/").includes("..")) {
    return assetData;
  }
  const absDir = path.resolve(projectRoot, relFromProject);
  const relFromWorkspace = toPosix(path.relative(workspaceRoot, absDir));
  if (relFromWorkspace.startsWith("..") || path.isAbsolute(relFromWorkspace)) {
    return assetData;
  }
  return {
    ...assetData,
    httpServerLocation: `${MONOREPO_PREFIX}${relFromWorkspace}`,
  };
}

function rewriteRequestUrl(url) {
  const queryIndex = url.indexOf("?");
  const rawPath = queryIndex === -1 ? url : url.slice(0, queryIndex);
  let pathname = rawPath;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    pathname = rawPath;
  }
  if (!pathname.startsWith(MONOREPO_PREFIX)) {
    return url;
  }
  const rest = pathname.slice(MONOREPO_PREFIX.length);
  const abs = path.resolve(workspaceRoot, rest);
  const rel = toPosix(path.relative(projectRoot, abs));
  const params = new URLSearchParams(queryIndex === -1 ? "" : url.slice(queryIndex + 1));
  params.set("unstable_path", rel);
  return `/assets?${params.toString()}`;
}

plugin.rewriteRequestUrl = rewriteRequestUrl;

module.exports = plugin;
