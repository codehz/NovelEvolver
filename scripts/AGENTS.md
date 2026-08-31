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
