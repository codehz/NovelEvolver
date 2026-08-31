# Electron main process

`main.ts` / `preload.ts` are bootstrap. Renderer talks to main via capnweb (`packages/desktop-rpc/transport/`). Contracts: [../../packages/desktop-rpc/AGENTS.md](../../packages/desktop-rpc/AGENTS.md). DTOs: [../../packages/domain/AGENTS.md](../../packages/domain/AGENTS.md).

## Layout

- `lib/` — shared main-process utilities (e.g. `stream-publisher.ts`)
- `projects/` — project-library presentation helpers
- `db/` — SQLite (`app-state.db`); worktree/projects tables via `@novelevolver/worktree`
- `rpc/` — capnweb server (`server/`), services, session objects, handles

No `#electron` alias — imports stay relative. Shared streaming helpers live in `lib/`.

## RPC

Handles are thin delegates. Domain logic stays in `@novelevolver/worktree`, not in handles.

- **Entry:** `rpc/server/connect.ts` (`ElectronRpcServer`) owns per-`webContents` sessions. `preload.ts` exposes `window.appRpcBridge`.
- **Deps:** pass main-process dependencies through `RpcMainDeps` (`rpc/server/deps.ts`). Never import `main.ts` from RPC code.
- **Types:** only live remote objects `extends RpcTarget`. Snapshots/DTOs stay plain interfaces. Prefer sync signatures; `Promise` only for dialogs, real async I/O, or stream subscriptions.
- **Dispose:** server-opened resources implement `[Symbol.dispose]()` and chain from `AppRpcRootImpl` when `ElectronRpcServer.closeRecord()` runs.

To change an RPC surface: update domain DTOs if needed → change handle interfaces in `packages/desktop-rpc/` → implement under `rpc/` → wire `AppRpcRootImpl` / `connect()` when needed → keep domain logic out of handles.

Protocol details (feeds, handle granularity, renderer dispose rules): [../../packages/desktop-rpc/README.md](../../packages/desktop-rpc/README.md).
