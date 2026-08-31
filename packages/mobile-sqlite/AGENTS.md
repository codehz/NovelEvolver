# Worktree SQLite (`@novelevolver/mobile-sqlite`)

Mobile-only sync SQLite driver. Desktop uses `node:sqlite`.

- JS: `Database` / `Statement` for nano-git and `DatabasePort`
- Native: Nitro Hybrid Object `NativeSqlite` (`open` / `execute` / `close`)
- Engine: SQLite amalgamation from [sqlite.manifest.json](sqlite.manifest.json), downloaded by `scripts/ensure-sqlite.mjs` into gitignored `cpp/sqlite/` (not the OS library)

SQL parameters and rows are JSI values (`string` / `number` / `boolean` / `null` / `ArrayBuffer`), not JSON. Do not add Expo, Nitro SQLite, or extra statement APIs unless a caller needs them.

After changing `*.nitro.ts` or `nitro.json`, run `bun run specs` in this package and commit `nitrogen/generated/`.

## Amalgamation

Pinned official zip + SHA3-256. Cache hit skips the download.

- `bun run sqlite:ensure` (repo root or this package)
- Android Gradle configuration and iOS `prepare_command` also run it
- Offline: `SKIP_SQLITE=1`. Force refresh: `SQLITE_FORCE=1`
