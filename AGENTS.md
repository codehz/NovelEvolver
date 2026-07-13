# Repository Guidelines

## Compatibility Policy (Prototype Phase)

This project is currently in **prototype development phase** — **no changes need to consider backward compatibility**. This includes but is not limited to:

- **Data storage formats**: SQLite schemas, file structures, serialization formats may change at any time without migration paths.
- **RPC interfaces**: Channel names, parameter signatures, return types may be arbitrarily modified without retaining deprecated versions.
- **Component props / state structures**: React component interfaces and state management shapes may be refactored at any time.
- **Persistent data**: User-local data (project config, window state, draft content, etc.) is not guaranteed to be cross-version compatible during the prototype phase.
- **Public API**: Any module exports or type definitions may be broken without semver consideration.

> **Principle**: Prioritize rapid idea validation — do not let compatibility concerns slow down iteration during the prototype phase. Introduce compatibility strategies only after the product enters Beta/stable stage.

## Project Structure & Module Organization

`src/` contains the Vite renderer application (`main.tsx`, `index.css`). `electron/` contains the Electron main and preload processes. Build output goes to `dist/` for the renderer and `dist-electron/` for Electron; do not edit generated files directly. Root config files include `vite.config.ts`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, and `scripts/build-electron.mjs`. RPC contracts shared between renderer and Electron live in `shared/rpc/`.

Renderer layout (`src/`):

- `app/` — bootstrap (`App.tsx`, `routes.tsx`)
- `shell/` — global desktop chrome (`WindowFrame`, notifications, quick-pick)
- `shared/` — cross-feature UI primitives (`shared/ui/`) and utilities (`shared/lib/` grouped as `rpc/`, `shell/`, `ui/`, `notifications/`, `quick-pick/`)
- `features/` — domain features (`project-list/`, `project-workbench/`)

`features/project-workbench/` domains: `chrome/` (layout shell barrel), `branch/`, `worktree/`, `history/`, `tree/`, `editor/` (`state/`, `contributions/`, `panes/`), `explorer/` (`shared/`, `manuscript/`, `resource-library/`), `changes/`, `search/`, `sidebar/`, `statusbar/`, `auxiliary/`, `state/` (project scope only), `lib/` (workbench-local micro-utils).

`electron/` layout (high level):

- `main.ts`, `preload.ts` — bootstrap entrypoints
- `lib/` — shared main-process utilities (e.g. `stream-publisher.ts`)
- `projects/` — project-library presentation helpers
- `db/` — SQLite persistence (`app-state.db`)
- `rpc/` — capnweb RPC server (`server/`), services (`services/`), session objects (`session/`), handles (`handles/`)
- `worktree/` — branch workspace domain (`session/` modules, `snapshots/`, `trees/`, `journal/`, etc.)

### Path Aliases

Three path aliases are configured in both `tsconfig.json` (`compilerOptions.paths`) and `path-aliases.ts` (`resolve.alias`, consumed by Vite):

- `#app/*` → `./src/*` — renderer root (`#app/app/App`, `#app/shared/lib/ui/cn`, `#app/features/project-list`, etc.)
- `#shared/*` → `./shared/*` — IPC/RPC contracts shared with `electron/`
- `#workbench/*` → `./src/features/project-workbench/*` — workbench-internal cross-domain imports (`#workbench/tree/TreeBody`, `#workbench/editor/state/molecules`)

**Rules:** Prefer aliases over deep relative paths (`../../../shared/lib/ui/cn` → `#app/shared/lib/ui/cn`). Keep single-dot relative imports within the same domain folder (e.g. `chrome/layout` importing `./WorkbenchLayout`, `rpc/server` importing `./transport`). Do not add a `#electron` alias — Electron internals stay as relative (`../db/app-database`, `./changes-ops`). Import workbench chrome via `#workbench/chrome` (barrel), not internal `chrome/layout/` / `chrome/sidebar/` subpaths. Use `#workbench/*` only inside `features/project-workbench/`; feature entrypoints export through `features/project-workbench/index.ts` for external consumers.

### Electron RPC

Renderer ↔ main communication uses **capnweb** over `shared/rpc/transport.ts`. Contracts live in `shared/rpc/`; implementations live in `electron/rpc/{server,services,session,handles}/`. Branch workspace logic stays in `electron/worktree/session/` — RPC handles are thin delegates only.

- **Entry:** `electron/rpc/server/connect.ts` (`ElectronRpcServer`) owns per-`webContents` sessions; `electron/preload.ts` exposes `window.appRpcBridge`.
- **Deps:** pass main-process dependencies through `RpcMainDeps` (`electron/rpc/server/deps.ts`). Never import `main.ts` from RPC code.
- **Types:** only live remote objects `extends RpcTarget` (root, services, sessions, handles). Snapshots/DTOs stay plain interfaces. Prefer sync signatures; add `Promise` only for dialogs, real async I/O, or stream subscriptions.
- **Dispose:** resources opened on the server must implement `[Symbol.dispose]()` and chain from `AppRpcRootImpl` when `ElectronRpcServer.closeRecord()` runs. `electron/worktree/` must not import `electron/rpc/`; shared streaming helpers live in `electron/lib/`.

To add or change an RPC surface: update `shared/rpc/`, implement under `electron/rpc/`, wire into `AppRpcRootImpl` / `ElectronRpcServer.connect()` when needed, and keep domain logic out of handles.

## Build, Test, and Development Commands

Use Bun for local work because the repo is locked with `bun.lock`.

- `bun install` installs dependencies.
- `bun run dev` starts Vite, watches Electron with `scripts/build-electron.mjs`, and launches the desktop app.
- `bun run build` builds both renderer and Electron bundles. If you see CSS warnings about `::highlight` (e.g. "Unknown pseudo class" or similar), these are false positives caused by lightningcss's incomplete support for the CSS `::highlight()` pseudo-element — they can be safely ignored.
- `bun run lint` is the **only** TypeScript validation gate: `oxlint` runs with `typeAware` and `typeCheck` (see `.oxlintrc.json`) on `src/`, `electron/`, and `shared/`, including compiler-style diagnostics. Renderer files must not import `electron` or `electron/` (enforced via `no-restricted-imports`). **Do not** add a `typecheck` script, `tsc --noEmit` npm script, or parallel CI step for standalone `tsc`; extend `.oxlintrc.json` if you need stricter checks. It may take a while to return results, so when invoking it from an agent or terminal tool, use a 5-second result wait timeout (`yield_time_ms`) rather than a shorter default.
- `bun run lint:fix` applies safe lint fixes.
- `bun run format` and `bun run format:check` run `oxfmt`.

## Coding Style & Naming Conventions

Write TypeScript with 2-space indentation, semicolons, and double quotes, matching the current codebase. Use PascalCase for React components, camelCase for functions and variables, and descriptive RPC service/handle names. Keep renderer code in `src/`, Electron-only code in `electron/`, and prefer small local types over loosely typed objects. Let `oxlint` and `oxfmt` enforce import order and Tailwind class ordering.

## Styling & Design Tokens

The renderer uses **Tailwind CSS v4** with theme tokens defined in `src/index.css` under `@theme` (for example `app-*`, `titlebar-*`, `badge-*` colors, spacing, and typography). When designing UI:

- Prefer **existing shared tokens** for app-wide roles (`text-app-foreground`, `bg-window-chrome`, `bg-app-surface`, `h-titlebar`, etc.) over raw hex values.
- Do **not** add a new semantic **color** token unless that role is shared across multiple components or needs centralized theme control. If a color choice is local to one component or one narrow variant, use the underlying palette/theme utility directly instead of inventing a new alias.
- **Do not add new ad-hoc CSS classes** in stylesheets for layout or appearance; express styling with Tailwind utilities wired to `@theme` tokens.
- **Exception:** minimal global or component-scoped CSS is allowed only when integrating a **third-party component library** that cannot be styled via tokens/utilities, or for platform hooks (e.g. `-webkit-app-region`) already centralized in `index.css`.
- Extend `@theme` with new named tokens only when the value represents a reusable semantic role, repeated state, or shared sizing/spacing primitive. Avoid one-to-one wrapper tokens that only rename a Catppuccin color for a single component.
- **Tailwind class constants must use `cn()`:** Any module-level or local constant whose value is a Tailwind utility string (including a single short string) must be assigned via `cn("...")` or `cn("...", condition && "...")`, not a bare string literal. This lets `oxlint-tailwindcss` statically validate classes (unknown utilities, duplicates, conflicts, sort order, etc.). Inline `className="..."` on JSX is fine; the rule applies to extracted `*Class` / `*Classes` variables and similar reuse.
- **Trust `bun run lint` for Tailwind after `@theme` / CSS changes:** The editor may show stale Tailwind diagnostics (e.g. “unknown class” for new theme tokens) because IDE Tailwind plugins do not always reload `src/index.css` immediately. Treat **`bun run lint`** (oxlint + `oxlint-tailwindcss`) as the authority; do not “fix” working theme utilities solely to clear editor squiggles.

## Testing Guidelines

There is no automated test suite configured yet. Until one exists, every change should pass `bun run lint` and `bun run build`. If you add tests, keep them close to the feature as `*.test.ts` or `*.test.tsx`, and prioritize renderer behavior plus Electron RPC boundaries.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style: `feat(electron): ...`, `fix: ...`, `build: ...`, `refactor: ...`. Keep commits scoped to one change. PRs should include a short summary, the commands you ran for verification, and screenshots or recordings for UI changes such as title bar or window controls.

## Overlay components (Base UI)

Renderer overlays use **`@base-ui/react`** (unstyled, tree-shakable). Prefer Base UI for new Dialog / Popover / Menu / Context Menu work.

- Prefer Base UI overlays: QuickPick uses `Dialog`, context menus use `Menu` with a virtual pointer anchor, anchored selectors/notifications use `Popover`. Do not reintroduce a custom `createPopover` factory or native `<dialog showModal>` wrapper.
- Prefer CSS transitions via Base UI `data-starting-style` / `data-ending-style` over hand-rolled close timers.
- Keep the app root with `isolation: isolate` (Tailwind `isolate` on the root in `App.tsx`) so portaled popups stack above page content.

## ScrollArea usage

`ScrollArea` (`src/shared/ui/ScrollArea.tsx`) wraps a single controlled viewport driven by the shared `ScrollbarController` (`src/shared/lib/ui/scrollbar/`). It is designed to be the **outermost scroll container** of a panel/section, not a nested inner wrapper.

- **Do not nest `ScrollArea` inside another `ScrollArea`.** The controller listens to scroll/resize on its viewport and renders a sticky rail; nesting produces overlapping sticky rails, double scrollbar metrics, and broken thumb sizing because the inner controller reads a viewport that is itself scrolled by the outer one.
- Each scrollable surface in a layout should have **exactly one** `ScrollArea`. If a sub-region needs to scroll independently, model it as its own sibling `ScrollArea` (with its own `fill` / flex container) rather than placing it inside an outer `ScrollArea`'s children.
- For non-scrolling inner content that just needs overflow clipping, use plain `overflow-auto` / `overflow-hidden` utilities instead of `ScrollArea` — `ScrollArea` is reserved for surfaces that warrant a custom sticky rail.
- When a panel is a flex column with a fixed header + scrollable body, use the `fill` prop on a single body-level `ScrollArea` (`fill` applies `h-0 flex-1`) so it grows within the flex column without nesting.
- The viewport ref is owned by `useScrollbarController()`; do not re-wrap the viewport in another scroll container or introduce a second controller instance inside the same subtree.

## Configuration Notes

The renderer dev server is fixed to `http://localhost:5173`, and Electron startup waits for that port plus `dist-electron/main.js`. Keep those assumptions aligned when changing build or startup configuration.
