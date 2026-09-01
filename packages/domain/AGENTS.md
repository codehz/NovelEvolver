# Domain (`@novelevolver/domain`)

Cross-platform DTOs and pure helpers. **Zero runtime deps.** Import as `@novelevolver/domain/…`.

- Snapshots, deltas, query/result types stay **plain interfaces** — no `RpcTarget` / stubs
- Shared feed primitives: `sync/feed.ts` (`SnapshotEvent`, `RpcDeltaEvent`)
- Worktree path/domain literals (e.g. `"manuscript" | "resource"`) converge on a **single exported type** (`WorktreeDomain`); other domain aliases should not drift
- Do not put capnweb handles or Electron/React code here — handles live in `@novelevolver/desktop-rpc`, UI in apps
- Do not use `structuredClone` or Web Crypto (missing on Hermes). JSON snapshots: `cloneJson` from `@novelevolver/domain/clone-json`
- Prototype: public exports may break without semver
