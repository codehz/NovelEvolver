# AI Runtime (`@novelevolver/ai-runtime`)

Shared conversation engine for desktop and mobile. DTOs stay in `@novelevolver/domain`. Persistence stays in `@novelevolver/worktree` (`AiChatRepository`). RPC handles stay in `@novelevolver/desktop-rpc` / `electron/rpc/`.

## Owns

- `ProjectAiChatController` / `AiConversationRuntime` (turns, directory, mock scenarios)
- Provider backends (`@codehz/ai`) and the worktree tool catalog
- Subagent executor

## Ports

Callers inject:

- `AiChatRepository` + `ResolveWorktree` (`() => WorktreeSession`)
- `AiModelsPort` / `AiAgentsPort` / `AiRuntimePolicyPort` (settings stores)

Do not import Electron, React, or capnweb. Use `nanoid/non-secure` instead of `node:crypto` / Web Crypto. Do not use `structuredClone` (missing on Hermes); JSON snapshots: `cloneJson` from `@novelevolver/domain/clone-json`.
