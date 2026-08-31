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
