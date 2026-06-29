# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the Vite renderer application (`App.tsx`, `main.tsx`, `index.css`). `electron/` contains the Electron main and preload processes. Build output goes to `dist/` for the renderer and `dist-electron/` for Electron; do not edit generated files directly. Root config files include `vite.config.ts`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, and `tsdown.electron.mts`. IPC types shared between renderer and Electron live in `shared/`.

### Path Aliases

Two path aliases are configured in both `tsconfig.json` (`compilerOptions.paths`) and `path-aliases.ts` (`resolve.alias`, consumed by Vite):

- `@/*` → `./src/*` — for imports reaching `src/lib`, `src/components`, `src/pages`, `src/routes`, `App`, etc. from outside `src/` or across feature folders.
- `@shared/*` → `./shared/*` — for importing shared types and utilities from `electron/` or `src/` renderer code.

**Rules:** Prefer aliases over deep relative paths (`../../../lib/cn` → `@/lib/cn`). Keep single-dot relative imports within the same feature folder (e.g. `workbench/layout` importing `./ActivityBar`, `electron/ipc` importing `./deps`). Do not add a `@electron` alias — Electron internals stay as relative (`../home-path`, `./ipc`). For the workbench barrel (`src/components/workbench/index.ts`), always import via `@/components/workbench` from outside the workbench folder; inside workbench keep subdirectory-relative imports.

### Electron IPC layout & type safety

- Import main-process IPC from `electron/ipc/` (package entry `ipc/index.ts`). **Do not** add a sibling `electron/ipc.ts` file — it shadows the folder and breaks imports.
- Channel contracts live in `shared/ipc/app-maps.ts` (`AppIpcMethodMap`, `AppIpcEventMap`). Renderer uses `preload` + `shared/ipc/renderer.ts`; main registers handlers via `registerIpcMethods`.
- Handlers live in `electron/ipc/*-handlers.ts`, merged in `method-handlers.ts`. **Never import `main.ts` from handlers** — pass dependencies through `IpcMainDeps` (or extend that type) to avoid circular imports.
- When adding or changing invoke channels:
  1. Update `AppIpcMethodMap` in `shared/ipc/app-maps.ts`.
  2. Implement the handler in the namespace file (`window-handlers.ts`, `projects-handlers.ts`, or a new `*-handlers.ts` for a new `prefix:` namespace).
  3. Type each namespace handler as `IpcMainMethodHandlers<WindowIpcMethodMap>` (or the matching `*IpcMethodMap` slice) so **missing keys fail typecheck**.
  4. `createAppIpcMethodHandlers` spreads namespace handlers and uses `satisfies IpcMainMethodHandlers<AppIpcMethodMap>` so **an unmerged channel fails typecheck**.
  5. Keep `UncategorizedAppIpcMethodChannels` in `app-maps.ts` as `never` — if you add a channel outside existing prefixes, add a new prefix map + handler file (or extend the partition types); otherwise the partition assertion in `method-handlers.ts` fails.

### RPC service type conventions

- Shared RPC contracts live in `shared/rpc/`. Keep service/handle interfaces there, and keep Electron implementations in `electron/rpc/`.
- Only interfaces representing a live remote object should `extends RpcTarget`. In the current design that includes the root object `AppRpcRoot`, service objects like `ProjectsService` / `WindowService`, and nested live handles like `ProjectHandle`.
- Plain value objects must **not** `extends RpcTarget`. Use `type`/plain `interface` for snapshots and DTOs such as `BranchInfo` and `OpenProjectResult`.
- If a method returns another live remote object, model that property/return type with an interface that `extends RpcTarget`, and implement it on the Electron side with a class that `extends RpcTarget`.
- Prefer synchronous signatures unless the contract is semantically async at the API boundary. Do **not** add `Promise` just because the renderer receives a `RpcStub` — `RpcStub` already lifts remote calls to async usage.
- Add `Promise` only when the logical result is genuinely asynchronous or streaming-oriented: dialogs, I/O that must be awaited before a value exists, transport/bridge APIs, or subscription factories that explicitly return stream-like handles.
- When one call needs to return both metadata and a live RPC object, wrap them in a plain result object (for example `{ handle, metadata }`) instead of forcing everything into an RPC target.
- Document lifecycle-sensitive handles with a short comment when needed, especially if the server keeps underlying resources open until session disposal.

## Build, Test, and Development Commands

Use Bun for local work because the repo is locked with `bun.lock`.

- `bun install` installs dependencies.
- `bun run dev` starts Vite, watches Electron with `tsdown`, and launches the desktop app.
- `bun run build` builds both renderer and Electron bundles.
- `bun run lint` is the **only** TypeScript validation gate: `oxlint` runs with `typeAware` and `typeCheck` (see `.oxlintrc.json`) on `src/`, `electron/`, and `shared/`, including compiler-style diagnostics. Renderer files must not import `electron` or `electron/` (enforced via `no-restricted-imports`). **Do not** add a `typecheck` script, `tsc --noEmit` npm script, or parallel CI step for standalone `tsc`; extend `.oxlintrc.json` if you need stricter checks. It may take a while to return results, so when invoking it from an agent or terminal tool, use a 5-second result wait timeout (`yield_time_ms`) rather than a shorter default.
- `bun run lint:fix` applies safe lint fixes.
- `bun run format` and `bun run format:check` run `oxfmt`.

## Coding Style & Naming Conventions

Write TypeScript with 2-space indentation, semicolons, and double quotes, matching the current codebase. Use PascalCase for React components, camelCase for functions and variables, and descriptive IPC channel names like `window:get-state`. Keep renderer code in `src/`, Electron-only code in `electron/`, and prefer small local types over loosely typed objects. Let `oxlint` and `oxfmt` enforce import order and Tailwind class ordering.

## Styling & Design Tokens

The renderer uses **Tailwind CSS v4** with theme tokens defined in `src/index.css` under `@theme` (for example `app-*`, `titlebar-*`, `badge-*` colors, spacing, and typography). When designing UI:

- Prefer **semantic tokens** (`text-app-foreground`, `bg-titlebar-background`, `h-titlebar`, etc.) over raw hex values or one-off utility combinations.
- **Do not add new ad-hoc CSS classes** in stylesheets for layout or appearance; express styling with Tailwind utilities wired to `@theme` tokens.
- **Exception:** minimal global or component-scoped CSS is allowed only when integrating a **third-party component library** that cannot be styled via tokens/utilities, or for platform hooks (e.g. `-webkit-app-region`) already centralized in `index.css`.
- New visual concepts should start by **extending `@theme`** with named tokens, then use those names in components.
- **Tailwind class constants must use `cn()`:** Any module-level or local constant whose value is a Tailwind utility string (including a single short string) must be assigned via `cn("...")` or `cn("...", condition && "...")`, not a bare string literal. This lets `oxlint-tailwindcss` statically validate classes (unknown utilities, duplicates, conflicts, sort order, etc.). Inline `className="..."` on JSX is fine; the rule applies to extracted `*Class` / `*Classes` variables and similar reuse.
- **Trust `bun run lint` for Tailwind after `@theme` / CSS changes:** The editor may show stale Tailwind diagnostics (e.g. “unknown class” for new theme tokens) because IDE Tailwind plugins do not always reload `src/index.css` immediately. Treat **`bun run lint`** (oxlint + `oxlint-tailwindcss`) as the authority; do not “fix” working theme utilities solely to clear editor squiggles.

## Testing Guidelines

There is no automated test suite configured yet. Until one exists, every change should pass `bun run lint` and `bun run build`. If you add tests, keep them close to the feature as `*.test.ts` or `*.test.tsx`, and prioritize renderer behavior plus Electron IPC boundaries.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style: `feat(electron): ...`, `fix: ...`, `build: ...`, `refactor: ...`. Keep commits scoped to one change. PRs should include a short summary, the commands you ran for verification, and screenshots or recordings for UI changes such as title bar or window controls.

## Configuration Notes

The renderer dev server is fixed to `http://localhost:5173`, and Electron startup waits for that port plus `dist-electron/main.js`. Keep those assumptions aligned when changing build or startup configuration.
