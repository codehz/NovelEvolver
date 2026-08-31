# Project workbench

Composition → domain → session → view kernel / `#app/shared` / `#domain`. Domains must not import other domains' internals; cross-domain traffic uses narrow ports (`openEditorTarget`, `revealInTree`, status item exports) or `lib/` helpers.

Renderer UI: `#domain/*` DTOs. RPC clients: `#desktop-rpc/*` handles. Chrome: `#workbench/chrome` barrel only.

## Layers

- **Session** (`session/`): project/branch scope, workspace handle graph, changes feed / tree snapshot. Domains read handles and feed here — **no UI or domain actions**.
- **Domain:** `editor/` (`state/`, `contributions/`, `panes/`, status e.g. caret), `explorer/` (`ExplorerSidebar` + `shared/` / `manuscript/` / `resource-library/`), `changes/`, `search/`, `history/`, `auxiliary/ai-chat/`, `branch/` (**UX only**: switcher, status item — not the RPC handle bus).
- **View kernel:** `chrome/` (layout shell barrel; sidebar/statusbar primitives under `chrome/sidebar` / `chrome/statusbar`), `tree/` (list/drag only — no feed/domain imports).
- **Composition:** `ProjectWorkbench.tsx` + `composition/` — **only** place that assembles primary views / editor / auxiliary / status contributions.
- **Misc:** `lib/` = workbench-local micro-utils and **shared cross-domain helpers** (change-tree projector, change-list row chrome). Do **not** reintroduce top-level `sidebar/` or `statusbar/` hosts. Do **not** reintroduce a renderer `worktree/` domain — feed/snapshot live under `session/changes-feed/`; `#domain/worktree` DTOs and `@novelevolver/worktree` (Electron main) are separate.

Do **not** add RPC handles or molecules under `branch/` — that belongs in `session/`. Primary views and status items live in their domain (or thin composition assembly); chrome only provides shell primitives.

## Boundary freeze (tree vs session)

- `tree/` = pure view kernel (rows, drag, motion, icons). May depend on `#app/shared` and `#domain` DTO types only. **Must not** import `session/` or any domain.
- `session/changes-feed/` = data plane (feed molecule, tree snapshot/revision, delta apply). May depend on session scopes/handles and `#domain` only. **Must not** import `tree/` or domain UI.
- Domains may import both `tree` (UI) and `session` (data). Shared pure helpers used by multiple domains belong in `lib/`.
- Explorer `createContentTreeMolecule` stays a domain factory over session scopes; do not push feed logic into `tree/`.

## Lint guards (`.oxlintrc.json`)

Banned hosts: `#workbench/worktree/**`, `#workbench/sidebar/**`, `#workbench/statusbar/**`, `#workbench/state/**`, `#workbench/branch/branch-scopes`.

Layer bans: `chrome/**` must not import session/tree/domains; `tree/**` must not import session/chrome/domains; `session/**` must not import tree/chrome/domains.
