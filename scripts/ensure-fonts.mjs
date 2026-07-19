#!/usr/bin/env node
/**
 * Download full local fonts into vendor/fonts (gitignored), convert TTF → WOFF2.
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
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { compress } from "wawoff2";

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
 * Extract one zip entry into workDir (flat basename) and return its absolute path.
 * @param {string} zipPath
 * @param {string} entry
 * @param {string} workDir
 */
function extractTo(zipPath, entry, workDir) {
  mkdirSync(workDir, { recursive: true });
  const result = spawnSync("unzip", ["-jo", zipPath, entry, "-d", workDir], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`unzip failed for "${entry}"\n${result.stderr || result.stdout || ""}`.trim());
  }
  const extractedPath = path.join(workDir, path.basename(entry));
  if (!existsSync(extractedPath)) {
    throw new Error(`unzip produced no file for entry: ${entry}`);
  }
  return extractedPath;
}

/**
 * Remove a leftover TTF next to a WOFF2 target (same stem).
 * @param {string} woff2Abs
 */
function removeLegacyTtf(woff2Abs) {
  const legacyTtf = woff2Abs.replace(/\.woff2$/i, ".ttf");
  if (legacyTtf !== woff2Abs && existsSync(legacyTtf)) {
    unlinkSync(legacyTtf);
    console.log(`[fonts] removed legacy ${path.relative(projectRoot, legacyTtf)}`);
  }
}

/**
 * @param {number} bytes
 */
function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * @param {{
 *   id: string;
 *   name: string;
 *   url: string;
 *   zipSha256: string;
 *   githubMirrorEnv?: string;
 *   extracts: Array<{ from: string; to: string; sourceSha256: string; sha256: string }>;
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
      if (!item.sha256) {
        return false;
      }
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
      const extractDir = path.join(workDir, "extract");
      const tempTtf = extractTo(zipPath, item.from, extractDir);
      assertSha256(sha256File(tempTtf), item.sourceSha256, `${item.from} (source ttf)`);

      const ttfBytes = readFileSync(tempTtf);
      const woff2Bytes = Buffer.from(await compress(ttfBytes));
      mkdirSync(path.dirname(item.abs), { recursive: true });
      writeFileSync(item.abs, woff2Bytes);

      const actualWoff2 = sha256File(item.abs);
      if (item.sha256) {
        assertSha256(actualWoff2, item.sha256, item.to);
      } else {
        console.log(`[fonts] ${item.to}: pin sha256 → ${actualWoff2}`);
      }

      removeLegacyTtf(item.abs);
      console.log(
        `[fonts] ${pkg.name}: wrote ${item.to} (${formatBytes(ttfBytes.length)} → ${formatBytes(woff2Bytes.length)})`,
      );
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
