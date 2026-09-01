# Worktree (`@novelevolver/worktree`)

Shared branch workspace engine for desktop and mobile. DTOs stay in `@novelevolver/domain`. RPC handles stay in `@novelevolver/desktop-rpc` / `electron/rpc/`.

## Owns

- `WorktreeSession` (manuscript / resource / changes / history / search / replace)
- `initAppState` (`projects` + worktree + `ai_conversation` SQL) and the matching repositories
- Outline helpers; `validateOutline` is re-exported from `@novelevolver/domain/worktree`

## Ports

Callers inject:

- `DatabasePort` (sync SQL; no `node:sqlite` / `@novelevolver/mobile-sqlite` here)
- nano-git `Repository` + `Repository["objects"]`

Do not import Electron, React, or capnweb.

## Git

Depends on `nano-git@^0.13`. Commit trees are `manuscript/` + `resources/` only.
