# Desktop renderer

Vite React app (`main.tsx`, `index.css`). Keep renderer code here; Electron-only code stays in `electron/`. Renderer must not import `electron` or `electron/` (`no-restricted-imports`).

Workbench architecture: [features/project-workbench/AGENTS.md](features/project-workbench/AGENTS.md). Aliases / packaging: [../AGENTS.md](../AGENTS.md). Fonts pipeline: [../../../scripts/AGENTS.md](../../../scripts/AGENTS.md).

## Layout

- `app/` — bootstrap (`App.tsx`, `routes.tsx`)
- `shell/` — global chrome (`WindowFrame`, notifications, quick-pick)
- `shared/` — UI primitives (`shared/ui/`) and utils (`shared/lib/` → `rpc/`, `shell/`, `ui/`, `notifications/`, `quick-pick/`)
- `features/` — `project-list/`, `project-workbench/`

## Module conventions

- **Named exports only.** Exception: Vite entry may `export default` (`app/App.tsx`).
- **Files:** `ComponentName.tsx`, `use-foo.ts` (hooks), `foo-bar.ts` (utils), `foo-chrome.ts` (**only** shared Tailwind class constants). Do not mix helpers and chrome constants. Do **not** name components `*Chrome.tsx`.
- **Props:** `type XxxProps = { … }` above the component in the same file. **Never** `interface XxxProps`. Do **not** export Props unless another module imports the type. Do **not** put an anonymous inline props object on an **exported** component. Local children may inline when props are ≤2 simple fields. Native elements: `type XxxProps = ComponentPropsWithRef<"button"> & { … }`.
- **Imports:**
  - `#app/*` — cross-feature / shared renderer
  - `#domain/*` — DTOs
  - `#desktop-rpc/*` — capnweb handles
  - `#workbench/*` — workbench **cross-domain** (required when leaving the current top-level workbench domain)
  - `./` or same-domain `../sibling` — only within one top-level domain (`editor/`, `changes/`, `auxiliary/ai-chat/`, `chrome/` including layout/sidebar/statusbar/titlebar, `explorer/` including manuscript/resource-library/shared, …)
  - Do **not** `../other-domain/…` or `../../` across workbench domains — use `#workbench/other-domain/…`
  - Do **not** add empty / re-export-only stubs to shorten paths
- **shared/ui:** public primitives from `#app/shared/ui` (barrel). Feature-local controls stay in the feature.
- **Hooks / state (ownership, not folder symmetry):**
  - `state/` — molecules, reducers, providers, hooks that **own** domain state / sync
  - Domain root or `hooks/` — UI/action hooks; add `hooks/` only when the domain has ≥3 non-state hooks
  - Do not force every domain to mirror the same layout
- **Style constants:** multi-component / overlay shell → `*-chrome.ts`, every string via `cn(...)`. Single-component reuse → local `const fooClass = cn(...)` or inline `className`. Shared interaction primitives live in `#app/shared/lib/ui/interaction-chrome`. Import chrome/helpers modules directly; no pure re-export barrels.

## React performance

- **Default: no `memo`.** Use only for (a) layout shells with stable props (existing dock/frame: `export const X = memo(function X(...))`), or (b) list leaves under proven high-frequency parent re-renders.
- **Default: no `useCallback` / `useMemo`.** Use only when (a) passing to a `memo` child, (b) a stable identity is required by an effect/deps array, or (c) the computation is clearly expensive.
- Do not wrap every handler in `useCallback` for style. Do not mass-remove existing memos; fix obvious waste when touching a file.

## Styling

Tailwind CSS v4; tokens in `index.css` `@theme` (`app-*`, `titlebar-*`, `badge-*`, …).

- Prefer existing tokens (`text-app-foreground`, `bg-app-crust`, `bg-app-surface`, `h-titlebar`, `text-chat`, `text-chat-meta`) over raw hex / one-off arbitrary sizes.
- Do **not** add a semantic **color** token unless the role is shared or needs centralized theme control. Local color → palette utility, not a new alias.
- **No ad-hoc CSS classes** for layout/appearance — Tailwind + `@theme`. Exception: third-party libs that cannot be tokenized, or platform hooks (`-webkit-app-region`) already in `index.css`.
- Extend `@theme` only for reusable semantic roles / shared sizing. Avoid 1:1 Catppuccin wrappers for a single component.
- **Extracted Tailwind strings must use `cn()`** (`fooClass` / `fooClasses`). Inline `className="..."` is fine. This is what `oxlint-tailwindcss` validates.
- After `@theme` / CSS changes, **`bun run lint` is authoritative**. Do not “fix” working theme utilities just to clear stale IDE squiggles.

### Interaction semantics (locked)

Reuse `#app/shared/lib/ui/interaction-chrome`; do not invent variants.

| Role                           | Canonical                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Control focus ring             | `controlFocusVisibleClass` — `outline-2` + `badge-background` (not `ring-*` / mauve)              |
| Icon-button hover              | `iconButtonHoverClass` — `hover:bg-ctp-text/8`                                                    |
| List row hover                 | `rowHoverClass` — `hover:bg-ctp-surface0/55`                                                      |
| Panel / secondary hover        | `panelHoverClass` — `hover:bg-ctp-surface0/40`                                                    |
| Combobox / QuickPick highlight | `listRowHighlightClass` — `data-highlighted:bg-ctp-surface0/55`                                   |
| Menu / Select highlight        | `menuItemHighlightClass` — `data-highlighted:bg-ctp-surface0/70`                                  |
| Control disabled (standard)    | `controlDisabledClass` — `pointer-events-none` + `opacity-50`                                     |
| Control disabled (soft)        | `controlDisabledSoftClass` — same, `opacity-40`                                                   |
| Field / select disabled        | `fieldDisabledClass` — `cursor-default` + `opacity-50` (keep focus semantics)                     |
| Menu item disabled             | `menuItemDisabledClass` — mute to `text-app-muted` only                                           |
| Wrapper has-disabled           | `hasDisabledClass` — shell following a Base UI child with `data-disabled`                         |
| Non-native disabled surface    | `disabledSurfaceClass` — conditional `cursor-default opacity-50`                                  |
| Overlay enter/exit             | `overlayMotionClass` — `duration-220` + `cubic-bezier(0.33,1,0.68,1)`                             |
| Popover surface                | `popoverSurfaceClass` — border + `bg-app-surface` + `rounded-lg`                                  |
| Field surface                  | `fieldSurfaceClass` / `fieldInputClass` — transparent border + `bg-ctp-surface0`; accent on focus |
| Field shell (adornments)       | `fieldSurfaceFocusWithinClass` — accent via `focus-within`                                        |

- **Radius:** controls `rounded-sm`; panels/cards `rounded-lg`; pills/progress `rounded-full`.
- **Accent:** chrome uses `badge-background` / existing semantic tokens. Decorative severity may stay raw `ctp-*`.
- **Chat type:** body `text-chat`, meta `text-chat-meta` — no `text-[0.8125rem]` / `text-[0.75rem]`.
- Custom `@theme --text-*` sizes must also be registered in `shared/lib/ui/cn.ts` (`extendTailwindMerge` → `classGroups["font-size"]`, e.g. `2xs`, `chat`, `chat-meta`) or `cn()` drops them as text-color.
- Collapsible height motion may keep `collapsibleHeightMotionClass`; do not use it for overlays.

## Overlays (Base UI)

Use `@base-ui/react` for Dialog / Popover / Menu / Context Menu. QuickPick → `Dialog`; context menus → `Menu` + virtual pointer anchor; anchored selectors/notifications → `Popover`. Do not reintroduce `createPopover` or native `<dialog showModal>`. Prefer `data-starting-style` / `data-ending-style` over close timers. App root stays `isolate` (`App.tsx`) so portaled popups stack.

## Native scrolling

Native overflow only — **no** shared `ScrollArea`, custom thumbs, or fixed scrollbar widths.

- Flex remainder: `h-0 min-h-0 flex-1 overflow-y-auto`
- Parent already sized: `h-full min-h-0 overflow-y-auto`
- Clamped popover: shell `max-h-* overflow-hidden` + `min-h-0 flex-1 overflow-y-auto` body
- Blink `OverlayScrollbars` is enabled in `electron/main.ts`. Colors live in `index.css`.
- CodeMirror `.cm-scroller` and tab rails stay native overflow.
