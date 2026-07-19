#!/usr/bin/env node
/**
 * Download full local fonts into vendor/fonts (gitignored).
 *
 * Env:
 *   SKIP_FONTS=1     skip entirely
 *   FONTS_FORCE=1    re-download even when cached
 *   GITHUB_MIRROR    optional prefix for GitHub release URLs
 *                    (e.g. mirror.ghproxy.com/https://github.com)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(projectRoot, "scripts/fonts.manifest.json");
const force = process.env.FONTS_FORCE === "1" || process.argv.includes("--force");

if (process.env.SKIP_FONTS === "1") {
  console.log("[fonts] SKIP_FONTS=1 — skipped");
  process.exit(0);
}

/** @param {string} filePath */
function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

/** @param {string} value @param {string} expected @param {string} label */
function assertSha256(value, expected, label) {
  if (value.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} sha256 mismatch\n  expected: ${expected}\n  actual:   ${value}`);
  }
}

/**
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  console.log(`[fonts] downloading ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`download failed (${response.status} ${response.statusText}): ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

/**
 * Resolve GitHub release URL through optional mirror.
 * GITHUB_MIRROR examples:
 *   - https://mirror.ghproxy.com/https://github.com
 *   - https://ghproxy.net/https://github.com
 * @param {string} url
 * @param {string | undefined} mirrorEnv
 */
function resolveUrl(url, mirrorEnv) {
  if (!mirrorEnv) {
    return url;
  }
  const mirror = process.env[mirrorEnv];
  if (!mirror) {
    return url;
  }
  if (!url.startsWith("https://github.com/")) {
    return url;
  }
  const base = mirror.replace(/\/$/, "");
  if (base.includes("github.com")) {
    return `${base}${url.slice("https://github.com".length)}`;
  }
  return `${base}/${url}`;
}

/**
 * @param {string} zipPath
 * @param {string} entry
 * @param {string} dest
 * @param {string} workDir
 */
function extractOne(zipPath, entry, dest, workDir) {
  mkdirSync(path.dirname(dest), { recursive: true });
  const result = spawnSync("unzip", ["-jo", zipPath, entry, "-d", workDir], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`unzip failed for "${entry}"\n${result.stderr || result.stdout || ""}`.trim());
  }
  const extractedName = path.basename(entry);
  const extractedPath = path.join(workDir, extractedName);
  if (!existsSync(extractedPath)) {
    throw new Error(`unzip produced no file for entry: ${entry}`);
  }
  copyFileSync(extractedPath, dest);
  unlinkSync(extractedPath);
}

/**
 * @param {{
 *   id: string;
 *   name: string;
 *   url: string;
 *   zipSha256: string;
 *   githubMirrorEnv?: string;
 *   extracts: Array<{ from: string; to: string; sha256: string }>;
 * }} pkg
 * @param {string} outputDir
 */
async function ensurePackage(pkg, outputDir) {
  const targets = pkg.extracts.map((item) => ({
    ...item,
    abs: path.join(outputDir, item.to),
  }));

  if (!force) {
    const ready = targets.every((item) => {
      if (!existsSync(item.abs)) {
        return false;
      }
      try {
        assertSha256(sha256File(item.abs), item.sha256, item.to);
        return true;
      } catch {
        return false;
      }
    });
    if (ready) {
      console.log(`[fonts] ${pkg.name}: cache hit`);
      return;
    }
  }

  const workDir = mkdtempSync(path.join(tmpdir(), `novelevolver-fonts-${pkg.id}-`));
  const zipPath = path.join(workDir, `${pkg.id}.zip`);
  try {
    const url = resolveUrl(pkg.url, pkg.githubMirrorEnv);
    await download(url, zipPath);
    assertSha256(sha256File(zipPath), pkg.zipSha256, `${pkg.name} zip`);

    for (const item of targets) {
      extractOne(zipPath, item.from, item.abs, workDir);
      assertSha256(sha256File(item.abs), item.sha256, item.to);
      console.log(`[fonts] ${pkg.name}: wrote ${item.to}`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`missing manifest: ${manifestPath}`);
  }

  const unzipCheck = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  if (unzipCheck.error || unzipCheck.status === 127) {
    throw new Error("system `unzip` is required (install unzip package)");
  }

  /** @type {{ outputDir: string; packages: Array<any> }} */
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const outputDir = path.join(projectRoot, manifest.outputDir);
  mkdirSync(outputDir, { recursive: true });

  console.log(`[fonts] ensuring into ${path.relative(projectRoot, outputDir) || "."}`);
  for (const pkg of manifest.packages) {
    await ensurePackage(pkg, outputDir);
  }
  console.log("[fonts] done");
}

main().catch((error) => {
  console.error(`[fonts] failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
