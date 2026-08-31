# Repository Guidelines

This is a **Bun workspace monorepo**. Root `AGENTS.md` is the always-on index. **Do not load every nested file.** Read only the nested `AGENTS.md` whose tree you are editing (nearest ancestor + any package you will touch).

| Path                                                                                                           | Read when                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [apps/desktop/AGENTS.md](apps/desktop/AGENTS.md)                                                               | Desktop app (renderer, Electron, packaging) |
| [apps/desktop/src/AGENTS.md](apps/desktop/src/AGENTS.md)                                                       | Vite renderer UI                            |
| [apps/desktop/src/features/project-workbench/AGENTS.md](apps/desktop/src/features/project-workbench/AGENTS.md) | Workbench layers / import boundaries        |
| [apps/desktop/electron/AGENTS.md](apps/desktop/electron/AGENTS.md)                                             | Electron main / RPC / worktree              |
| [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md)                                                                 | React Native app                            |
| [packages/domain/AGENTS.md](packages/domain/AGENTS.md)                                                         | Cross-platform DTOs                         |
| [packages/desktop-rpc/AGENTS.md](packages/desktop-rpc/AGENTS.md)                                               | capnweb IPC contracts                       |
| [packages/worktree/AGENTS.md](packages/worktree/AGENTS.md)                                                     | Shared worktree session / app-state SQL     |
| [packages/mobile-sqlite/AGENTS.md](packages/mobile-sqlite/AGENTS.md)                                           | Mobile SQLite Nitro Module / amalgamation   |
| [scripts/AGENTS.md](scripts/AGENTS.md)                                                                         | Fonts and repo-level build helpers          |

## Compatibility (prototype)

**No backward compatibility.** SQLite schemas, RPC, props, persisted user data, and public exports may change without migration. Validate ideas first; add compatibility only after Beta.

## Layout

```
apps/desktop/       @novelevolver/desktop — Electron + Vite renderer
apps/mobile/        @novelevolver/mobile — bare React Native (no Expo / Metro)
packages/domain/    @novelevolver/domain — DTOs, pure helpers (zero deps)
packages/desktop-rpc/  @novelevolver/desktop-rpc — capnweb contracts (desktop only)
packages/worktree/     @novelevolver/worktree — shared worktree session + app-state SQL
packages/mobile-sqlite/ @novelevolver/mobile-sqlite — mobile SQLite Nitro Module
scripts/            repo-level helpers (electron bundle, fonts)
```

Do not edit generated output (`apps/desktop/dist/`, `apps/desktop/dist-electron/`). Repo lint/format config lives at the root (`.oxlintrc.json`, `.oxfmtrc.json`).

## Commands

Use Bun (`bun.lock`).

- `bun install`
- `bun run dev` — desktop (Vite + Electron)
- `bun run mobile` / `mobile:android` / `mobile:ios`
- `bun run build` / `pack` / `dist` — desktop (see [apps/desktop/AGENTS.md](apps/desktop/AGENTS.md))
- `bun run lint` — **only** TypeScript gate (`oxlint` `typeAware` + `typeCheck`). Do **not** add a `typecheck` / `tsc --noEmit` script or CI step. Agent/terminal: wait ≥5s for results. CSS `::highlight` warnings from lightningcss are false positives.
- `bun run lint:fix` / `bun run format` / `bun run format:check`
- `bun run fonts:ensure` — see [scripts/AGENTS.md](scripts/AGENTS.md)
- `bun run sqlite:ensure` — download pinned SQLite amalgamation for mobile native builds

## Shared style

TypeScript, 2-space indent, semicolons, double quotes. PascalCase components, camelCase functions/vars, descriptive RPC names. Prefer small local types. `oxlint` / `oxfmt` own import order and Tailwind class order.

## Testing

No dedicated suite yet. Changes must pass `bun run lint` and `bun run build`. New tests: `*.test.ts` / `*.test.tsx` next to the feature; prefer renderer behavior and Electron RPC boundaries. `bun test` runs whatever `*.test.ts` exist.

## Commits / PRs

Conventional Commits: `feat(electron): …`, `fix: …`, `build: …`, `refactor: …`. One concern per commit. PRs: short summary, commands run, screenshots/recordings for UI (title bar, window controls).
