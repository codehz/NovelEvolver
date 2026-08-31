import { createRequire } from "node:module";
import path from "node:path";

import { transform as svgrTransform } from "@svgr/core";
import { defineConfig } from "rollipop";
import Icons from "unplugin-icons/rolldown";
import type { CustomCompiler } from "unplugin-icons/types";

const require = createRequire(path.join(process.cwd(), "package.json"));
const rollipopRequire = createRequire(require.resolve("rollipop/package.json"));
const rnBabelRequire = createRequire(require.resolve("@react-native/babel-preset"));
const reactNativeRoot = path.dirname(require.resolve("react-native/package.json"));
const reanimatedRoot = path.dirname(require.resolve("react-native-reanimated/package.json"));
const workletsRoot = path.dirname(require.resolve("react-native-worklets/package.json"));
const gestureHandlerRoot = path.dirname(
  require.resolve("react-native-gesture-handler/package.json"),
);
const cryptoStubPath = path.join(process.cwd(), "src/shared/node-compat/crypto.ts");
const zlibStubPath = path.join(process.cwd(), "src/shared/node-compat/zlib.ts");

function iconComponentName(collection: string, icon: string): string {
  return `${collection}-${icon}`.replace(/(?:^|-)([a-z0-9])/g, (_, char: string) =>
    char.toUpperCase(),
  );
}

const reactNativeIconCompiler: CustomCompiler = {
  extension: "jsx",
  compiler: async (svg, collection, icon) =>
    svgrTransform(
      svg,
      {
        native: true,
        plugins: ["@svgr/plugin-jsx"],
        jsxRuntime: "automatic",
        prettier: false,
        svgo: false,
        icon: 16,
      },
      { componentName: iconComponentName(collection, icon) },
    ),
};

export default defineConfig({
  entry: "index.js",
  plugins: [
    Icons({
      compiler: reactNativeIconCompiler,
      jsx: "react",
      scale: 1,
    }),
  ],
  // Bun's isolated store lives outside the app tree, so Rolldown cannot
  // discover apps/mobile/tsconfig.json from dependency files.
  tsconfig: false,
  resolve: {
    alias: [
      {
        // RN 0.87 internals still deep-import src/private, which is not in
        // package.json exports. Metro's Haste allowed this; Node resolution does not.
        find: /^react-native\/src\/private\/(.+)/,
        replacement: path.join(reactNativeRoot, "src/private/$1"),
      },
      {
        // Prefer precompiled JS. The `react-native` package field points at
        // TypeScript `src/`, which the Worklets Babel plugin cannot print
        // under Babel 8.
        find: /^react-native-reanimated$/,
        replacement: path.join(reanimatedRoot, "lib/module/index.js"),
      },
      {
        find: /^react-native-worklets$/,
        replacement: path.join(workletsRoot, "lib/module/index.js"),
      },
      {
        find: /^react-native-gesture-handler$/,
        replacement: path.join(gestureHandlerRoot, "lib/module/index.js"),
      },
    ],
  },
  // Built-ins are externalized before Rollipop's array alias plugin runs.
  // Inject these into Rolldown's native alias table so nano-git's imports are
  // replaced in dependency modules as well as application modules.
  rolldownOptions: (options) => ({
    ...options,
    input: {
      ...options.input,
      resolve: {
        ...options.input?.resolve,
        alias: {
          "node:crypto": cryptoStubPath,
          crypto: cryptoStubPath,
          "node:zlib": zlibStubPath,
          zlib: zlibStubPath,
        },
      },
    },
  }),
  reactNative: {
    // RN 0.87 moved this off Libraries/Image/AssetRegistry.js.
    assetRegistryPath: "react-native/asset-registry",
  },
  transform: {
    // RN 0.87 Flow (match / component syntax) is beyond fast-flow-transform.
    // Hermes Babel parser + Babel 8 plugins handle those files instead.
    flow: {
      filter: {
        id: { include: /\.jsx?$/, exclude: /node_modules[/\\]react-native[/\\]/ },
        code: /@flow/,
      },
    },
    babel: {
      rules: [
        {
          filter: {
            id: /node_modules[/\\]react-native[/\\].*\.jsx?$/,
            code: /@flow/,
          },
          options: {
            plugins: [
              [
                rollipopRequire.resolve("babel-plugin-syntax-hermes-parser"),
                { parseLangTypes: "flow", reactRuntimeTarget: "19" },
              ],
              rnBabelRequire.resolve("babel-plugin-transform-flow-enums"),
              rollipopRequire.resolve("@babel/plugin-transform-flow-strip-types"),
              [require.resolve("@babel/plugin-transform-react-jsx"), { runtime: "automatic" }],
            ],
          },
        },
        {
          filter: {
            id: { include: /\.[cm]?[jt]sx?$/, exclude: /node_modules/ },
          },
          options: {
            parserOpts: { plugins: ["jsx", "typescript"] },
            plugins: [require.resolve("react-native-worklets/plugin")],
          },
        },
        {
          // Transform `'worklet'` directives in the precompiled packages.
          // Metro did this via babel.config.js; skipping it leaves Reanimated's
          // barrel half-evaluated so `import { Easing }` reads undefined, and
          // RNGH's UI-runtime gesture `callback` / `scheduleOnUI` cleanup throw.
          filter: {
            id: /node_modules[/\\]react-native-(?:reanimated|worklets|gesture-handler)[/\\]lib[/\\].*\.js$/,
          },
          options: {
            plugins: [require.resolve("react-native-worklets/plugin")],
          },
        },
      ],
    },
  },
});
