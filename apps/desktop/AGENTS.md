# Desktop (`@novelevolver/desktop`)

Electron + Vite. Renderer: `src/` → `dist/`. Main/preload: `electron/` → `dist-electron/`. Do not edit generated files.

Config lives here: `vite.config.ts`, `tsconfig.json`, `path-aliases.ts`, `electron-builder.yml`, `scripts/build-electron.mjs`.

Before editing UI, main process, or workbench, also read:

- [src/AGENTS.md](src/AGENTS.md) — renderer
- [src/features/project-workbench/AGENTS.md](src/features/project-workbench/AGENTS.md) — workbench
- [electron/AGENTS.md](electron/AGENTS.md) — RPC
- [../../packages/desktop-rpc/AGENTS.md](../../packages/desktop-rpc/AGENTS.md) — IPC contracts
- [../../packages/domain/AGENTS.md](../../packages/domain/AGENTS.md) — DTOs
- [../../packages/worktree/AGENTS.md](../../packages/worktree/AGENTS.md) — shared worktree session

## Imports

`#app/*` is the only path alias (same-package renderer/electron files). It is defined in `tsconfig.json` `paths` and `path-aliases.ts` (Vite / Electron `resolve.alias`).

Cross-package imports use workspace names via each package’s `exports` — do **not** add `@novelevolver/domain`, `@novelevolver/desktop-rpc`, or `@novelevolver/worktree` to desktop `tsconfig` `paths`:

| Specifier                     | Source                      |
| ----------------------------- | --------------------------- |
| `#app/*`                      | `./src/*` (same package)    |
| `@novelevolver/domain/*`      | `@novelevolver/domain`      |
| `@novelevolver/desktop-rpc/*` | `@novelevolver/desktop-rpc` |
| `@novelevolver/worktree`      | `@novelevolver/worktree`    |

Prefer `#app/*` over deep relatives (`#app/shared/lib/ui/cn`). Keep single-dot relatives inside the same domain folder. **No `#electron` alias** — Electron stays relative (`../db/app-database`). `#app/features/project-workbench/*` only inside `features/project-workbench/`; external consumers import via `features/project-workbench/index.ts`. Import chrome via `#app/features/project-workbench/chrome` (barrel), not `chrome/layout|sidebar|statusbar|titlebar` subpaths.

Renderer UI: `@novelevolver/domain/*` for DTOs. RPC clients: `@novelevolver/desktop-rpc/*` for capnweb handles.

## Commands

From repo root (or `bun run --filter @novelevolver/desktop …`):

- `bun run dev` — Vite, watch Electron (`scripts/build-electron.mjs`), launch app
- `bun run build` — renderer + Electron bundles
- `bun run pack` — unpacked smoke binary under `release/`
- `bun run dist` — current host OS into `release/` (`dist:linux` / `dist:win` / `dist:mac` for explicit targets)

Packaging is **native-host only** (no cross-compile). Prototype: **no code signing / notarization**. CI (`.github/workflows/package.yml`) packages Linux/Windows/macOS on `main`/PR; tag `v*` creates a GitHub Release (version from `package.json`; tags with `-` are prerelease).

## Dev server

Renderer is fixed at `http://localhost:5173`. Electron startup waits for that port **and** `dist-electron/main.js`. Keep those assumptions aligned when changing build/startup.
