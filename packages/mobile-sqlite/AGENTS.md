# Worktree SQLite (`@novelevolver/mobile-sqlite`)

Mobile-only sync SQLite driver **and** project-file access. Desktop uses `node:sqlite`.

- JS: `Database` / `Statement` for nano-git and `DatabasePort`
- Native: Nitro Hybrid Object `NativeSqlite` (`open` / `execute` / `close`)
- Native: Nitro Hybrid Object `NativeFs` (list/delete/rename/share `.npk` by **filename only** — JS never sees absolute paths)
- Android: `NpkDocumentsProvider` exposes `novelevolver/projects/` through the Storage Access Framework so other apps can copy `.npk` files in or out
- Engine: SQLite amalgamation from [sqlite.manifest.json](sqlite.manifest.json), downloaded by `scripts/ensure-sqlite.mjs` into gitignored `cpp/sqlite/` (not the OS library)

SQL parameters and rows are JSI values (`string` / `number` / `boolean` / `null` / `ArrayBuffer`), not JSON. Do not add Expo, Nitro SQLite, extra statement APIs, or React Native file/share/picker libraries unless a caller needs them.

After changing `*.nitro.ts` or `nitro.json`, run `bun run specs` in this package and commit `nitrogen/generated/`.

## Project files

`.npk` files live at `{Android filesDir | iOS Documents}/novelevolver/projects/`. Open them with `Database.open(fileName, { location: PROJECTS_LOCATION })`. iOS `NativeFs.shareFile` is a stub.

## Amalgamation

Pinned official zip + SHA3-256. Cache hit skips the download.

- `bun run sqlite:ensure` (repo root or this package)
- Android Gradle configuration and iOS `prepare_command` also run it
- Offline: `SKIP_SQLITE=1`. Force refresh: `SQLITE_FORCE=1`
