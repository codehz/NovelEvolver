const path = require("node:path");
const { getDefaultConfig } = require("@react-native/metro-config");
const { withMetroConfig } = require("react-native-monorepo-config");

const baseConfig = getDefaultConfig(__dirname);
const monorepoConfig = withMetroConfig(baseConfig, {
  root: path.resolve(__dirname, "../.."),
  dirname: __dirname,
});

module.exports = {
  ...monorepoConfig,
  resolver: {
    ...monorepoConfig.resolver,
    resolveRequest: require("./metro-icons-resolver"),
  },
};
