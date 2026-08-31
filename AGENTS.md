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

This repository is a **Bun workspace monorepo**:

```
apps/
  desktop/          @novelevolver/desktop — Electron + Vite renderer
  mobile/           @novelevolver/mobile — React Native (Community CLI, not Expo)
packages/
  domain/           @novelevolver/domain — cross-platform DTOs, pure helpers (zero deps)
  desktop-rpc/      @novelevolver/desktop-rpc — capnweb IPC contracts (desktop only)
scripts/            repo-level build helpers (electron bundle, fonts)
```

`apps/mobile/` is a **bare React Native** app (Community CLI + [Rollipop](https://rollipop.dev) bundler). Do **not** add Expo (`expo`, `expo-router`, `expo-*`) or Metro. Native projects live in `android/` and `ios/`; JS entry is `index.js`; bundler config is `rollipop.config.ts`; UI lives under `src/`. Domain DTOs use `@novelevolver/domain` (no `#app` / `#domain` path aliases). Rollipop uses standard Node module resolution, so workspace packages resolve without Metro `watchFolders` / asset URL rewrites.

`apps/desktop/src/` contains the Vite renderer application (`main.tsx`, `index.css`). `apps/desktop/electron/` contains the Electron main and preload processes. Build output goes to `apps/desktop/dist/` for the renderer and `apps/desktop/dist-electron/` for Electron; do not edit generated files directly. Desktop config lives under `apps/desktop/` (`vite.config.ts`, `tsconfig.json`, `path-aliases.ts`, `electron-builder.yml`, `scripts/build-electron.mjs`); repo-wide lint/format config stays at the root (`.oxlintrc.json`, `.oxfmtrc.json`). Cross-platform domain types live in `packages/domain/` (`@novelevolver/domain`); desktop capnweb IPC contracts live in `packages/desktop-rpc/` (`@novelevolver/desktop-rpc`).

Renderer layout (`apps/desktop/src/`):

- `app/` — bootstrap (`App.tsx`, `routes.tsx`)
- `shell/` — global desktop chrome (`WindowFrame`, notifications, quick-pick)
- `shared/` — cross-feature UI primitives (`shared/ui/`) and utilities (`shared/lib/` grouped as `rpc/`, `shell/`, `ui/`, `notifications/`, `quick-pick/`)
- `features/` — domain features (`project-list/`, `project-workbench/`)

`features/project-workbench/` layers and domains:

- **Session plane** (`session/`): project/branch scope, workspace handle graph, changes feed / tree snapshot. Domains read handles and feed here — do **not** put UI or domain actions in `session/`.
- **Domain plane**: `editor/` (`state/`, `contributions/`, `panes/`, status contribution e.g. caret), `explorer/` (`ExplorerSidebar` + `shared/` / `manuscript/` / `resource-library/`), `changes/` (`ChangesSidebar` + list UI), `search/` (`SearchSidebar` + query/results), `history/`, `auxiliary/ai-chat/` (panel + AI status contribution), `branch/` (**UX only**: switcher, status item — not the RPC handle bus).
- **View kernel**: `chrome/` (layout shell barrel only — includes chrome sidebar/statusbar primitives under `chrome/sidebar` / `chrome/statusbar`), `tree/` (list/drag primitives only — no feed/domain imports).
- **Composition root**: `ProjectWorkbench.tsx` + `composition/` (e.g. `WorkbenchStatusBar`) — only place that assembles primary views / editor / auxiliary / status contributions from domain public entries.
- **Misc**: `lib/` is workbench-local micro-utils and **shared cross-domain helpers** that are not owned by a single domain (e.g. change-tree projector, shared change-list row chrome). Do **not** reintroduce top-level `sidebar/` or `statusbar/` business host folders. Do **not** reintroduce a renderer `worktree/` domain — feed/snapshot live under `session/changes-feed/`; `#domain/worktree` DTOs and `electron/worktree/` backend are separate concerns.

**Boundary freeze (tree vs session data plane):**

- `tree/` = pure view kernel (rows, drag, motion, icons). May depend on `#app/shared` and `#domain` DTO types only. **Must not** import `session/` or any domain.
- `session/changes-feed/` = data plane (changes feed molecule, tree snapshot/revision, delta apply). May depend on session scopes/handles and `#domain` only. **Must not** import `tree/` or domain UI.
- Domains may import both `tree` (UI) and `session` (data). Shared pure helpers used by multiple domains belong in `lib/`, not inside one domain's folder.
- Explorer `createContentTreeMolecule` stays a domain factory over session scopes; do not push feed logic into `tree/`.

**Dependency direction (non-negotiable):** composition → domain → session → view kernel / `#app/shared` / `#domain`. Domains must not import other domains' internals; cross-domain traffic uses narrow ports (`openEditorTarget`, `revealInTree`, status item exports) or `lib/` shared helpers. Do **not** add new RPC handles or molecules under `branch/` — that belongs in `session/`. Primary view sections and status items live in their domain (or thin composition assembly); chrome only provides shell primitives. Renderer UI imports `#domain/*` for DTOs; RPC client code imports `#desktop-rpc/*` for capnweb handles.

**Lint guards (`.oxlintrc.json`, renderer):**

- Deleted hosts banned: `#workbench/worktree/**`, `#workbench/sidebar/**`, `#workbench/statusbar/**`, `#workbench/state/**`, `#workbench/branch/branch-scopes`.
- Layer bans: `chrome/**` must not import session/tree/domains; `tree/**` must not import session/chrome/domains; `session/**` must not import tree/chrome/domains.
- Chrome internals still import via `#workbench/chrome` barrel only (not `chrome/layout|sidebar|statusbar|titlebar` subpaths).

`apps/desktop/electron/` layout (high level):

- `main.ts`, `preload.ts` — bootstrap entrypoints
- `lib/` — shared main-process utilities (e.g. `stream-publisher.ts`)
- `projects/` — project-library presentation helpers
- `db/` — SQLite persistence (`app-state.db`)
- `rpc/` — capnweb RPC server (`server/`), services (`services/`), session objects (`session/`), handles (`handles/`)
- `worktree/` — branch workspace domain (`session/` modules, `snapshots/`, `trees/`, `journal/`, etc.)

### Path Aliases

Three path aliases are configured in `apps/desktop/tsconfig.json` (`compilerOptions.paths`) and `apps/desktop/path-aliases.ts` (`resolve.alias`, consumed by Vite):

- `#app/*` → `./src/*` (under `apps/desktop/`) — renderer root (`#app/app/App`, `#app/shared/lib/ui/cn`, `#app/features/project-list`, etc.)
- `#domain/*` → `../../packages/domain/*` — cross-platform DTOs and pure helpers (`@novelevolver/domain`)
- `#desktop-rpc/*` → `../../packages/desktop-rpc/*` — capnweb IPC contracts (`@novelevolver/desktop-rpc`, desktop only)
- `#workbench/*` → `./src/features/project-workbench/*` — workbench-internal cross-domain imports (`#workbench/tree/TreeBody`, `#workbench/editor/state/molecules`)

**Rules:** Prefer aliases over deep relative paths (`../../../shared/lib/ui/cn` → `#app/shared/lib/ui/cn`). Keep single-dot relative imports within the same domain folder (e.g. `chrome/layout` importing `./WorkbenchLayout`, `rpc/server` importing `./transport`). Do not add a `#electron` alias — Electron internals stay as relative (`../db/app-database`, `./changes-ops`). Import workbench chrome via `#workbench/chrome` (barrel), not internal `chrome/layout/` / `chrome/sidebar/` subpaths. Use `#workbench/*` only inside `features/project-workbench/`; feature entrypoints export through `features/project-workbench/index.ts` for external consumers.

### Electron RPC

Renderer ↔ main communication uses **capnweb** over `packages/desktop-rpc/transport/`. Domain DTOs live in `packages/domain/`; capnweb handle interfaces live in `packages/desktop-rpc/`; implementations live in `apps/desktop/electron/rpc/{server,services,session,handles}/`. Branch workspace logic stays in `apps/desktop/electron/worktree/session/` — RPC handles are thin delegates only.

- **Entry:** `apps/desktop/electron/rpc/server/connect.ts` (`ElectronRpcServer`) owns per-`webContents` sessions; `apps/desktop/electron/preload.ts` exposes `window.appRpcBridge`.
- **Deps:** pass main-process dependencies through `RpcMainDeps` (`apps/desktop/electron/rpc/server/deps.ts`). Never import `main.ts` from RPC code.
- **Types:** only live remote objects `extends RpcTarget` (root, services, sessions, handles). Snapshots/DTOs stay plain interfaces. Prefer sync signatures; add `Promise` only for dialogs, real async I/O, or stream subscriptions.
- **Dispose:** resources opened on the server must implement `[Symbol.dispose]()` and chain from `AppRpcRootImpl` when `ElectronRpcServer.closeRecord()` runs. `apps/desktop/electron/worktree/` must not import `apps/desktop/electron/rpc/`; shared streaming helpers live in `apps/desktop/electron/lib/`.

To add or change an RPC surface: update domain DTOs in `packages/domain/` when needed, add or change capnweb handle interfaces in `packages/desktop-rpc/`, implement under `apps/desktop/electron/rpc/`, wire into `AppRpcRootImpl` / `ElectronRpcServer.connect()` when needed, and keep domain logic out of handles.

## Build, Test, and Development Commands

Use Bun for local work because the repo is locked with `bun.lock`.

- `bun install` installs dependencies.
- `bun run dev` starts Vite, watches Electron with `apps/desktop/scripts/build-electron.mjs`, and launches the desktop app.
- `bun run build` builds both renderer and Electron bundles. If you see CSS warnings about `::highlight` (e.g. "Unknown pseudo class" or similar), these are false positives caused by lightningcss's incomplete support for the CSS `::highlight()` pseudo-element — they can be safely ignored.
- `bun run pack` builds then runs `electron-builder --dir` for a local unpacked smoke binary under `apps/desktop/release/`.
- `bun run dist` builds then packages the **current host OS** defaults into `apps/desktop/release/` (`dist:linux` / `dist:win` / `dist:mac` for explicit targets). Packaging is native-host only — no cross-compile. Config lives in `apps/desktop/electron-builder.yml`. Prototype phase: **no code signing / notarization**. CI (`.github/workflows/package.yml`) packages Linux/Windows/macOS on `main`/PR and uploads workflow artifacts; pushing a tag matching `v*` also creates a GitHub Release with those packages attached (version comes from `package.json` on the tagged commit, typically via `npm version`; tags with `-` such as `v1.0.0-beta.1` are marked prerelease).
- `bun run lint` is the **only** TypeScript validation gate: `oxlint` runs with `typeAware` and `typeCheck` (see `.oxlintrc.json`) on `apps/desktop/src/`, `apps/desktop/electron/`, `packages/domain/`, and `packages/desktop-rpc/`, including compiler-style diagnostics. Renderer files must not import `electron` or `electron/` (enforced via `no-restricted-imports`). **Do not** add a `typecheck` script, `tsc --noEmit` npm script, or parallel CI step for standalone `tsc`; extend `.oxlintrc.json` if you need stricter checks. It may take a while to return results, so when invoking it from an agent or terminal tool, use a 5-second result wait timeout (`yield_time_ms`) rather than a shorter default.
- `bun run lint:fix` applies safe lint fixes.
- `bun run format` and `bun run format:check` run `oxfmt`.

## Coding Style & Naming Conventions

Write TypeScript with 2-space indentation, semicolons, and double quotes, matching the current codebase. Use PascalCase for React components, camelCase for functions and variables, and descriptive RPC service/handle names. Keep renderer code in `apps/desktop/src/`, Electron-only code in `apps/desktop/electron/`, and prefer small local types over loosely typed objects. Let `oxlint` and `oxfmt` enforce import order and Tailwind class ordering.

### Frontend module conventions (`apps/desktop/src/`)

- **Named exports only.** Exception: Vite app entry may use `export default` (`apps/desktop/src/app/App.tsx`).
- **File names:** `ComponentName.tsx`, `use-foo.ts` (hooks), `foo-bar.ts` (utils), `foo-chrome.ts` (**only** shared Tailwind class constants). Do not mix pure helpers and chrome class constants in the same file. Do **not** name React components `*Chrome.tsx` — that suffix is reserved for style-constant modules.
- **Props:**
  - Always `type XxxProps = { ... }` next to the component. **Never** `interface XxxProps`.
  - Place the type above the component in the same file.
  - **Do not export** Props unless another module actually imports the type (e.g. `#workbench/chrome` barrel, public editor handle types).
  - **Do not** put an anonymous inline props object on an **exported** component (`export function Foo({ x }: { x: T })`). Local non-exported children may inline when props are ≤2 simple fields.
  - Extending native elements: `type XxxProps = ComponentPropsWithRef<"button"> & { ... }` (still a `type`, still named `XxxProps`).
- **Import paths:**
  - `#app/*` — cross-feature / shared renderer code
  - `#domain/*` — cross-platform DTOs and pure helpers
  - `#desktop-rpc/*` — capnweb IPC contracts (desktop renderer RPC client + Electron only)
  - `#workbench/*` — workbench **cross-domain** imports (required when leaving the current top-level workbench domain)
  - `./` or same-domain `../sibling-in-domain` — only within the same top-level domain folder (`editor/`, `changes/`, `auxiliary/ai-chat/`, `chrome/` including its layout/sidebar/statusbar/titlebar subfolders, `explorer/` including manuscript/resource-library/shared, etc.)
  - Do **not** use relative `../other-domain/...` to reach a **different** top-level workbench domain; switch to `#workbench/other-domain/...`.
  - Do **not** use `../../` (or deeper) across workbench domains.
  - Do **not** add empty or re-export-only stub files under parent folders to shorten paths.
- **shared/ui:** import public primitives from `#app/shared/ui` (barrel). Feature-local controls stay in their feature folder.
- **Hooks / state (ownership, not folder symmetry):**
  - `state/` — molecules, reducers, providers, and hooks that **own** domain state / sync
  - Domain root or `hooks/` — UI/action hooks; create a `hooks/` directory only when the domain has ≥3 non-state hooks
  - Do **not** force every domain to mirror the same physical layout (editor may keep hooks at domain root; ai-chat may use `hooks/` + `state/`)
  - Do not add re-export-only stub files under parent folders
- **Style constants:**
  - Multi-component / overlay shell styles → `*-chrome.ts`, every string via `cn(...)`
  - Single-component local reuse → `const fooClass = cn(...)` in that component file, or inline `className`
  - Shared interaction primitives (focus, hover, list highlight, overlay motion, popover surface) live in `#app/shared/lib/ui/interaction-chrome` — reuse them instead of re-copying the same utilities
  - Prefer importing chrome/helpers modules directly (`ai-chat-chrome`, `ai-chat-helpers`); do not add pure re-export barrels that only re-surface those modules

### React performance habits (`apps/desktop/src/`)

- **Default: no `memo`.** Use only for (a) layout shells with stable props (existing dock/frame pattern: `export const X = memo(function X(...))`), or (b) list leaves under proven high-frequency parent re-renders.
- **Default: no `useCallback` / `useMemo`.** Use only when (a) passing to a `memo` child, (b) a stable identity is required by an effect/dependency array, or (c) the computation is clearly expensive (large tree projection, filtering).
- Do **not** wrap every handler in `useCallback` for stylistic consistency.
- Do not mass-remove existing memos without a measured reason; fix obvious waste when touching a file (e.g. `memo` child receiving a fresh inline function each render when a trivial local fix exists).

## Styling & Design Tokens

The renderer uses **Tailwind CSS v4** with theme tokens defined in `apps/desktop/src/index.css` under `@theme` (for example `app-*`, `titlebar-*`, `badge-*` colors, spacing, and typography). When designing UI:

- Prefer **existing shared tokens** for app-wide roles (`text-app-foreground`, `bg-app-crust`, `bg-app-surface`, `h-titlebar`, `text-chat`, `text-chat-meta`, etc.) over raw hex values or one-off arbitrary sizes.
- Do **not** add a new semantic **color** token unless that role is shared across multiple components or needs centralized theme control. If a color choice is local to one component or one narrow variant, use the underlying palette/theme utility directly instead of inventing a new alias.
- **Do not add new ad-hoc CSS classes** in stylesheets for layout or appearance; express styling with Tailwind utilities wired to `@theme` tokens.
- **Exception:** minimal global or component-scoped CSS is allowed only when integrating a **third-party component library** that cannot be styled via tokens/utilities, or for platform hooks (e.g. `-webkit-app-region`) already centralized in `index.css`.
- Extend `@theme` with new named tokens only when the value represents a reusable semantic role, repeated state, or shared sizing/spacing primitive. Avoid one-to-one wrapper tokens that only rename a Catppuccin color for a single component.
- **Tailwind class constants must use `cn()`:** Any module-level or local constant whose value is a Tailwind utility string (including a single short string) must be assigned via `cn("...")` or `cn("...", condition && "...")`, not a bare string literal. This lets `oxlint-tailwindcss` statically validate classes (unknown utilities, duplicates, conflicts, sort order, etc.). Inline `className="..."` on JSX is fine; the rule applies to extracted `*Class` / `*Classes` variables and similar reuse.
- **Trust `bun run lint` for Tailwind after `@theme` / CSS changes:** The editor may show stale Tailwind diagnostics (e.g. “unknown class” for new theme tokens) because IDE Tailwind plugins do not always reload `apps/desktop/src/index.css` immediately. Treat **`bun run lint`** (oxlint + `oxlint-tailwindcss`) as the authority; do not “fix” working theme utilities solely to clear editor squiggles.

### Interaction & visual semantics (locked)

Prefer the shared classes from `#app/shared/lib/ui/interaction-chrome` over inventing new variants:

| Role                           | Canonical                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Control focus ring             | `controlFocusVisibleClass` — `outline-2` + `badge-background` (not `ring-*` / mauve)                          |
| Icon-button hover              | `iconButtonHoverClass` — `hover:bg-ctp-text/8`                                                                |
| List row hover                 | `rowHoverClass` — `hover:bg-ctp-surface0/55`                                                                  |
| Panel / secondary hover        | `panelHoverClass` — `hover:bg-ctp-surface0/40`                                                                |
| Combobox / QuickPick highlight | `listRowHighlightClass` — `data-highlighted:bg-ctp-surface0/55`                                               |
| Menu / Select highlight        | `menuItemHighlightClass` — `data-highlighted:bg-ctp-surface0/70`                                              |
| Control disabled (standard)    | `controlDisabledClass` — `pointer-events-none` + `opacity-50` (`disabled:` / `data-disabled:`)                |
| Control disabled (soft)        | `controlDisabledSoftClass` — same as standard but `opacity-40` (compact/icon/text chrome)                     |
| Field / select disabled        | `fieldDisabledClass` — `cursor-default` + `opacity-50` (no PE kill; keep form focus semantics)                |
| Menu item disabled             | `menuItemDisabledClass` — mute to `text-app-muted` only (no structural opacity)                               |
| Wrapper has-disabled           | `hasDisabledClass` — label/card shell following a Base UI child with `data-disabled`                          |
| Non-native disabled surface    | `disabledSurfaceClass` — conditional `cursor-default opacity-50` (CodeMirror host, Toggle chips)              |
| Overlay enter/exit             | `overlayMotionClass` — `duration-220` + `cubic-bezier(0.33,1,0.68,1)`                                         |
| Popover surface                | `popoverSurfaceClass` — border + `bg-app-surface` + `rounded-lg`                                              |
| Field surface                  | `fieldSurfaceClass` / `fieldInputClass` — transparent border + `bg-ctp-surface0`; accent border only on focus |
| Field shell (adornments)       | `fieldSurfaceFocusWithinClass` — same rest surface; accent border via `focus-within`                          |

Additional shape / type scale rules:

- **Radius:** controls `rounded-sm`; panels/cards `rounded-lg`; pills/progress `rounded-full`. Do not mix radii for the same role.
- **Accent:** chrome emphasis uses `badge-background` / existing semantic tokens. Decorative severity colors (info/warn/error) may stay raw `ctp-*`.
- **Chat type scale:** body `text-chat`, meta/secondary `text-chat-meta` (theme tokens) — avoid `text-[0.8125rem]` / `text-[0.75rem]` arbitrary values.
- **Custom `@theme --text-*` sizes must also be registered** in `apps/desktop/src/shared/lib/ui/cn.ts` under `extendTailwindMerge` → `classGroups["font-size"]` (e.g. `2xs`, `chat`, `chat-meta`). Otherwise `cn()` treats them as text-color and drops them when merged with `text-app-foreground` / other `text-*` color utilities.
- **Collapsible height motion** may keep the separate ease in `collapsibleHeightMotionClass`; do not use it for overlays.

## Testing Guidelines

There is no automated test suite configured yet. Until one exists, every change should pass `bun run lint` and `bun run build`. If you add tests, keep them close to the feature as `*.test.ts` or `*.test.tsx`, and prioritize renderer behavior plus Electron RPC boundaries.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style: `feat(electron): ...`, `fix: ...`, `build: ...`, `refactor: ...`. Keep commits scoped to one change. PRs should include a short summary, the commands you ran for verification, and screenshots or recordings for UI changes such as title bar or window controls.

## Overlay components (Base UI)

Renderer overlays use **`@base-ui/react`** (unstyled, tree-shakable). Prefer Base UI for new Dialog / Popover / Menu / Context Menu work.

- Prefer Base UI overlays: QuickPick uses `Dialog`, context menus use `Menu` with a virtual pointer anchor, anchored selectors/notifications use `Popover`. Do not reintroduce a custom `createPopover` factory or native `<dialog showModal>` wrapper.
- Prefer CSS transitions via Base UI `data-starting-style` / `data-ending-style` over hand-rolled close timers.
- Keep the app root with `isolation: isolate` (Tailwind `isolate` on the root in `App.tsx`) so portaled popups stack above page content.

## Native scrolling

Use native overflow utilities directly — **do not** reintroduce a shared `ScrollArea` (or similar) abstraction, custom thumb/rail controllers, or thin/fixed scrollbar widths.

- Flex remainder: `h-0 min-h-0 flex-1 overflow-y-auto` (parent is a definite-height flex column).
- Parent already sized / inline height: `h-full min-h-0 overflow-y-auto`.
- Self-clamped popover/picker: shell `max-h-* overflow-hidden` with fixed header/footer siblings and a `min-h-0 flex-1 overflow-y-auto` body; body-only clamp can use `max-h-* overflow-y-auto` alone.
- Electron enables Blink `OverlayScrollbars` (`enableBlinkFeatures` in `apps/desktop/electron/main.ts`) so the bar overlays content when supported. App-wide scrollbar **colors** live in `apps/desktop/src/index.css`.
- Ad-hoc scrollports (CodeMirror `.cm-scroller`, horizontal tab rails) stay native overflow only.

## Fonts

UI and mono fonts are **full local files**, not npm subset packages (subsetting drops OpenType features such as `tnum` / `tabular-nums`).

- Source of truth: [scripts/fonts.manifest.json](scripts/fonts.manifest.json) + [scripts/ensure-fonts.mjs](scripts/ensure-fonts.mjs)
- Pipeline: download official TTF zips → verify `sourceSha256` → convert with `wawoff2` (full font, **no subset**) → write WOFF2 and pin `sha256`
- Output (gitignored): `vendor/fonts/` — MiSans VF + Maple Mono CN static faces as `.woff2` only
- CSS: [apps/desktop/src/fonts/faces.css](apps/desktop/src/fonts/faces.css), imported from [apps/desktop/src/index.css](apps/desktop/src/index.css)
- Commands: `bun run fonts:ensure` (also runs in `prepare`). Offline: `SKIP_FONTS=1`. Force refresh: `FONTS_FORCE=1`.
- **Attribution**: This application uses the **MiSans** typeface (Xiaomi). Maple Mono CN is SIL OFL 1.1.

## Configuration Notes

The renderer dev server is fixed to `http://localhost:5173`, and Electron startup waits for that port plus `dist-electron/main.js`. Keep those assumptions aligned when changing build or startup configuration.
