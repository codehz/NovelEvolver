# Mobile (`@novelevolver/mobile`)

Bare React Native (Community CLI + [Rollipop](https://rollipop.dev)). **Do not add Expo** (`expo`, `expo-router`, `expo-*`) or Metro.

- Native projects: `android/`, `ios/`
- JS entry: `index.js`; bundler: `rollipop.config.ts`; UI: `src/`
- Domain DTOs: `@novelevolver/domain` (no `#app` / `#domain` path aliases)
- Rollipop uses standard Node resolution — workspace packages resolve without Metro `watchFolders` / asset URL rewrites
- Iconify: on-demand `unplugin-icons` (`import IconAdd from "~icons/codicon/add"`), compiled to `react-native-svg` in `rollipop.config.ts`
- Theme: Catppuccin Mocha JS tokens in `src/shared/theme/` (no NativeWind / Tailwind). Semantic roles match desktop `@theme`. Flavor is pinned — do not follow system light mode
- Backend: mobile-specific (MMKV, HTTP, WebSocket — TBD). **Not** capnweb / `desktop-rpc`
- Settings: local MMKV (`novelevolver-settings`); domain store logic from `@novelevolver/domain`

Human-oriented notes: [README.md](README.md).

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
