# Scripts

Repo-level helpers. Electron bundling for the desktop app lives in `apps/desktop/scripts/build-electron.mjs` (not here).

## Fonts

UI/mono fonts are **full local files**, not npm subset packages (subsetting drops OpenType features such as `tnum`).

- Source of truth: [fonts.manifest.json](fonts.manifest.json) + [ensure-fonts.mjs](ensure-fonts.mjs)
- Pipeline: download official TTF zips → verify `sourceSha256` → convert with `wawoff2` (full font, **no subset**) → write WOFF2 and pin `sha256`
- Output (gitignored): `vendor/fonts/` — desktop WOFF2 plus validated native TTF copies for Android/iOS (MiSans VF + Maple Mono CN)
- CSS: `apps/desktop/src/fonts/faces.css`, imported from `apps/desktop/src/index.css`
- Commands: `bun run fonts:ensure` (also in `prepare`); mobile runs `bun run mobile:fonts` before native builds. Offline: `SKIP_FONTS=1`. Force refresh: `FONTS_FORCE=1`
- Attribution: **MiSans** (Xiaomi). Maple Mono CN is SIL OFL 1.1

## SQLite amalgamation

Pinned official SQLite sources for `@novelevolver/mobile-sqlite`. Manifest and downloader live in that package (`sqlite.manifest.json`, `scripts/ensure-sqlite.mjs`). Output is gitignored `packages/mobile-sqlite/cpp/sqlite/sqlite3.{c,h}`. `bun run sqlite:ensure`; native Android/iOS builds also fetch it. Offline: `SKIP_SQLITE=1`. Force refresh: `SQLITE_FORCE=1`.
