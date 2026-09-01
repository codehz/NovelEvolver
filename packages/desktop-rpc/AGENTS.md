# Desktop RPC (`@novelevolver/desktop-rpc`)

capnweb IPC **contracts** (desktop only). Domain DTOs: `@novelevolver/domain`. Implementations: `apps/desktop/electron/rpc/`. Transport: `transport/`.

Use the nearest domain barrel (`@novelevolver/desktop-rpc/transport`, `@novelevolver/desktop-rpc/worktree`, …) for cross-package imports.

**Not for mobile.** Changing a surface: DTOs in `packages/domain/` if needed → handle interfaces here → impl under `electron/rpc/` (session engine in `@novelevolver/worktree`) → wire `AppRpcRootImpl` / `connect()` → keep domain logic out of handles.

## Contract rules

- Only live remote objects `extends RpcTarget` (root, services, sessions, handles). Snapshots/DTOs are plain types.
- Prefer sync signatures; `Promise` only for dialogs, real async I/O, or stream subscriptions.
- Renderer depends on `@novelevolver/desktop-rpc/*` contracts only — not Electron impl paths.
- Full user-protocol conventions (feeds, naming, handle granularity, dispose/lifecycle): [README.md](README.md). Read it before adding or reshaping a handle.
