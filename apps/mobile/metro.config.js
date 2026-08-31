const path = require("node:path");

const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const monorepoAssets = require("./metro-monorepo-assets");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import("@react-native/metro-config").MetroConfig}
 */
const config = {
  // Invalidate cached asset URLs that still contain `/assets/../..`.
  cacheVersion: "monorepo-assets-1",
  watchFolders: [workspaceRoot],
  transformer: {
    assetPlugins: [require.resolve("./metro-monorepo-assets")],
  },
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        if (typeof req.url === "string") {
          req.url = monorepoAssets.rewriteRequestUrl(req.url);
        }
        return middleware(req, res, next);
      };
    },
  },
  resolver: {
    extraNodeModules: {
      "@novelevolver/domain": path.resolve(workspaceRoot, "packages/domain"),
    },
    nodeModulesPaths: [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
