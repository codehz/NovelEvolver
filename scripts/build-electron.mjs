import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import esbuild from "esbuild";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(projectRoot, "dist-electron");
const watch = process.argv.includes("--watch");

const alias = {
  "#app": path.join(projectRoot, "src"),
  "#shared": path.join(projectRoot, "shared"),
};

function aliasPlugin() {
  return {
    name: "alias",
    setup(build) {
      for (const [key, target] of Object.entries(alias)) {
        const exact = new RegExp(`^${key}$`);
        const nested = new RegExp(`^${key}/`);

        build.onResolve({ filter: exact }, () => ({ path: resolvePath(target) }));
        build.onResolve({ filter: nested }, (args) => ({
          path: resolvePath(path.join(target, args.path.slice(key.length + 1))),
        }));
      }
    },
  };
}

function resolvePath(filePath) {
  const candidates = [
    filePath,
    `${filePath}.ts`,
    `${filePath}.tsx`,
    `${filePath}.js`,
    `${filePath}.jsx`,
    `${filePath}.mts`,
    `${filePath}.cts`,
    path.join(filePath, "index.ts"),
    path.join(filePath, "index.tsx"),
    path.join(filePath, "index.js"),
    path.join(filePath, "index.jsx"),
    path.join(filePath, "index.mts"),
    path.join(filePath, "index.cts"),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));

  return match ?? filePath;
}

function createConfig(entryPoint, outfile) {
  return {
    absWorkingDir: projectRoot,
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    tsconfig: path.join(projectRoot, "tsconfig.json"),
    sourcemap: true,
    packages: "bundle",
    external: ["electron"],
    plugins: [aliasPlugin()],
    logLevel: "info",
  };
}

const builds = [
  createConfig("electron/main.ts", path.join(distDir, "main.js")),
  createConfig("electron/preload.ts", path.join(distDir, "preload.js")),
];

fs.rmSync(distDir, { force: true, recursive: true });
fs.mkdirSync(distDir, { recursive: true });

if (watch) {
  const contexts = await Promise.all(builds.map((config) => esbuild.context(config)));
  await Promise.all(contexts.map((context) => context.watch()));
  console.log("[build-electron] watching");
} else {
  await Promise.all(builds.map((config) => esbuild.build(config)));
}
