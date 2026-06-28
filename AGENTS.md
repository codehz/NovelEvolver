# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vite renderer application (`App.tsx`, `main.tsx`, `index.css`). `electron/` contains the Electron main and preload processes. Build output goes to `dist/` for the renderer and `dist-electron/` for Electron; do not edit generated files directly. Root config files include `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `.oxfmtrc.json`, and `tsdown.electron.mts`.

## Build, Test, and Development Commands
Use Bun for local work because the repo is locked with `bun.lock`.

- `bun install` installs dependencies.
- `bun run dev` starts Vite, watches Electron with `tsdown`, and launches the desktop app.
- `bun run build` builds both renderer and Electron bundles.
- `bun run lint` runs `oxlint` (including TypeScript-aware checks) on `src/` and `electron/`. It may take a while to return results, so when invoking it from an agent or terminal tool, use a 5-second result wait timeout (`yield_time_ms`) rather than a shorter default.
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

## Testing Guidelines
There is no automated test suite configured yet. Until one exists, every change should pass `bun run lint` and `bun run build`. If you add tests, keep them close to the feature as `*.test.ts` or `*.test.tsx`, and prioritize renderer behavior plus Electron IPC boundaries.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style: `feat(electron): ...`, `fix: ...`, `build: ...`, `refactor: ...`. Keep commits scoped to one change. PRs should include a short summary, the commands you ran for verification, and screenshots or recordings for UI changes such as title bar or window controls.

## Configuration Notes
The renderer dev server is fixed to `http://localhost:5173`, and Electron startup waits for that port plus `dist-electron/main.js`. Keep those assumptions aligned when changing build or startup configuration.
