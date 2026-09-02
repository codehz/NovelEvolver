# Mobile (`@novelevolver/mobile`)

Bare React Native (Community CLI + [Rollipop](https://rollipop.dev)). **Do not add Expo** (`expo`, `expo-router`, `expo-*`) or Metro.

- Native projects: `android/`, `ios/`
- JS entry: `index.js`; bundler: `rollipop.config.ts`; UI: `src/`
- Domain DTOs: `@novelevolver/domain` (workspace package; no `#app` path alias)
- Rollipop uses standard Node resolution — workspace packages resolve without Metro `watchFolders` / asset URL rewrites
- Hermes does not parse `async function*` / `for await`; Rollipop Babel transforms those in app + `@novelevolver/ai-runtime` / `@codehz/ai`
- Hermes has no Web Crypto or `structuredClone`; `index.js` installs `crypto.randomUUID` via `src/shared/node-compat/crypto-global.ts` and `structuredClone` via `src/shared/node-compat/structured-clone.ts` (`@codehz/ai` uses the global)
- Iconify: on-demand `unplugin-icons` (`import IconAdd from "~icons/codicon/add"`), compiled to `react-native-svg` in `rollipop.config.ts`
- Theme: Catppuccin Mocha JS tokens in `src/shared/theme/` (no NativeWind / Tailwind). Semantic roles match desktop `@theme`. Flavor is pinned — do not follow system light mode
- Backend: mobile-specific (MMKV for settings, SQLite app-state + nano-git for projects). **Not** capnweb / `desktop-rpc`
- Settings: local MMKV (`novelevolver-settings`); domain store logic from `@novelevolver/domain`
- Projects / worktree drafts: `@novelevolver/worktree` on a mobile `app-state.db` (not MMKV), via `@novelevolver/mobile-sqlite`
- AI chat: `@novelevolver/ai-runtime` on the opened project's `AiChatRepository` + settings stores
- Overlays: root-stack `transparentModal` via `OverlayHost` (`useOverlay`); not `Alert.alert` / `Modal`

Human-oriented notes: [README.md](README.md).

## Source layout

```
src/
  app/                 # root navigation, split navigator
  features/
    projects/          # local worktree projects (not desktop-rpc)
      ProjectListScreen.tsx
      ProjectScreen.tsx            # composition: header + workspace
      ProjectWorkspace.tsx         # compact tabs / wide columns
      use-project-workspace.ts     # opened session, selection, mutations
      ProjectManagerProvider.tsx
      editor/                      # document pane
      explorer/                    # domain switch + shared tree kernel
      manuscript/                  # manuscript tree
      resource/                    # resource tree
      git/                         # app-state sqlite + nano-git + repository manager
      ai/                          # project AI chat (shared @novelevolver/ai-runtime)
    settings/          # MMKV settings
  shared/              # theme, overlays, files, node-compat
  native/              # Nitro modules
```

`ProjectScreen` is composition only. Worktree mutations and explorer/editor selection live in `use-project-workspace.ts`. Do not copy the desktop workbench layer graph here.

## Commands

From repo root: `bun run mobile` / `mobile:android` / `mobile:ios`. From this package: `bun run start` / `android` / `ios`. iOS: `cd ios && bundle install && bundle exec pod install`.

## Header conventions

- Use `Header` from `@react-navigation/elements` for screens that render their own consistent page header. Do not build a replacement header with a manually laid-out `View` row.
- When a screen renders a `Header`, set that screen's native-stack option to `headerShown: false`; do not render the custom and native headers together.
- Keep the shared header appearance aligned with the settings screens: use `color.background`, `color.accent`, the shared sans font, the standard title size, `headerShadowVisible={false}`, and the theme border on the bottom edge.
- Reuse `SettingsHeaderBackButton` for the left action and `settingsStyles.headerLeftContainer` for its inset. Use `SettingsHeaderButton` for text or icon actions on the right, including outside the settings feature.
- Put screen-specific actions and status indicators in `headerLeft` and `headerRight`. For plain text on the right, provide a `headerRightContainerStyle` with `space[4]` end padding so the text does not touch or get clipped by the screen edge.
- Let `Header` own the top safe-area inset. A loaded screen with a custom header should use `SafeAreaView` from `react-native-safe-area-context` with `edges={["bottom"]}`. Loading and error states that do not render a header should include both `"top"` and `"bottom"` edges.
- Keep dynamic titles in the `Header` `title` prop. The navigation stack should only provide a native title when the screen intentionally uses the native stack header.

## Overlay dialogs

In-app alerts, confirms, and text prompts use the settings leave-confirm chrome: a root-stack `transparentModal` over a `wash.backdrop`, with a bordered `color.surface` card (`radius.panel`), 220ms bezier fade + scale (`OVERLAY_TIMING`), and action buttons from `overlay-chrome`. Do **not** use React Native `Alert.alert`, `Modal`, or a feature-local overlay tree.

- Call `useOverlay()` (or `useConfirm()`) from `src/shared/ui/OverlayHost`. Feature code must not `navigate` to overlay routes itself.
- Kinds: `alert` — notice with one primary action (`确定` by default). `confirm` — cancel + danger action (leave-guard default: 未保存的更改 / 丢弃). `prompt` — text field, cancel + primary; empty submit is disabled; iOS uses `KeyboardAvoidingView`.
- New overlay screens belong on the **root** stack so they sit above Settings and project screens. Options: `headerShown: false`, `presentation: "transparentModal"`, `animation: "none"`, `gestureEnabled: false`, transparent `contentStyle`. Reuse `overlayStyles` in `src/shared/ui/overlay-chrome.ts`; do not restyle per feature.
- Wire the host above `RootNavigation` (`OverlayHost`). Settings dirty leave-confirm binds through `SettingsLeaveBinder` (`setSettingsLeaveConfirm(() => confirm())`); do not reintroduce a settings-only dialog host.
