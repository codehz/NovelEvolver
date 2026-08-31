#!/usr/bin/env node
/**
 * Download the pinned SQLite amalgamation into cpp/sqlite (gitignored).
 *
 * Env:
 *   SKIP_SQLITE=1     skip entirely
 *   SQLITE_FORCE=1    re-download even when cached
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(packageRoot, "sqlite.manifest.json");
const force = process.env.SQLITE_FORCE === "1" || process.argv.includes("--force");

if (process.env.SKIP_SQLITE === "1") {
  console.log("[sqlite] SKIP_SQLITE=1 — skipped");
  process.exit(0);
}

/** @param {string} filePath */
function sha3File(filePath) {
  const hash = createHash("sha3-256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

/** @param {string} value @param {string} expected @param {string} label */
function assertSha3(value, expected, label) {
  if (value.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} sha3-256 mismatch\n  expected: ${expected}\n  actual:   ${value}`);
  }
}

/**
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  console.log(`[sqlite] downloading ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`download failed (${response.status} ${response.statusText}): ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

/**
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

async function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`missing manifest: ${manifestPath}`);
  }

  const unzipCheck = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  if (unzipCheck.error || unzipCheck.status === 127) {
    throw new Error("system `unzip` is required (install unzip package)");
  }

  /** @type {{
   *   version: string;
   *   url: string;
   *   zipSha3_256: string;
   *   outputDir: string;
   *   extracts: Array<{ from: string; to: string; sha3_256: string }>;
   * }} */
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const outputDir = path.join(packageRoot, manifest.outputDir);
  mkdirSync(outputDir, { recursive: true });

  const targets = manifest.extracts.map((item) => ({
    ...item,
    abs: path.join(outputDir, item.to),
  }));

  if (!force) {
    const ready = targets.every((item) => {
      if (!existsSync(item.abs)) {
        return false;
      }
      try {
        assertSha3(sha3File(item.abs), item.sha3_256, item.to);
        return true;
      } catch {
        return false;
      }
    });
    if (ready) {
      console.log(`[sqlite] ${manifest.version}: cache hit`);
      return;
    }
  }

  const workDir = mkdtempSync(path.join(tmpdir(), "novelevolver-sqlite-"));
  const zipPath = path.join(workDir, "amalgamation.zip");
  try {
    await download(manifest.url, zipPath);
    assertSha3(sha3File(zipPath), manifest.zipSha3_256, `SQLite ${manifest.version} zip`);

    const extractDir = path.join(workDir, "extract");
    for (const item of targets) {
      const extracted = extractTo(zipPath, item.from, extractDir);
      assertSha3(sha3File(extracted), item.sha3_256, item.from);
      const bytes = readFileSync(extracted);
      mkdirSync(path.dirname(item.abs), { recursive: true });
      writeFileSync(item.abs, bytes);
      assertSha3(sha3File(item.abs), item.sha3_256, item.to);
      console.log(`[sqlite] wrote ${item.to} (${formatBytes(bytes.length)})`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  console.log(`[sqlite] ${manifest.version} done`);
}

main().catch((error) => {
  console.error(`[sqlite] failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
