# NovelEvolver Mobile

Bare React Native app (`@react-native-community/cli`). **Expo is not used and must not be added.**

- Native id: `com.novelevolver.mobile`
- JS component name: `NovelEvolver` (`app.json`)
- Domain types: `@novelevolver/domain`
- Bundler: [Rollipop](https://rollipop.dev) (`rollipop.config.ts`), not Metro. RN CLI `start` / `bundle` are overridden via `react-native.config.js`. RN 0.87 removed `rn-get-polyfills`; `patches/react-native@0.87.1.patch` shims it to `@react-native/js-polyfills` until Rollipop supports 0.87 natively. Iconify icons: `unplugin-icons` (`~icons/{collection}/{icon}`), compiled to `react-native-svg`.
- Theme: Catppuccin Mocha JS tokens in `src/shared/theme/` (no NativeWind / Tailwind). Semantic roles match desktop `@theme` (`background` / `surface` / mauve accent). Flavor is pinned — do not follow system light mode.
- Backend access: mobile-specific (local MMKV settings, HTTP, WebSocket — TBD; **not** capnweb RPC)
- Settings: local MMKV (`novelevolver-settings`), domain store logic from `@novelevolver/domain`

## Commands

From the repository root:

```sh
bun install
bun run mobile:fonts     # ensure and link native MiSans / Maple Mono assets
bun run mobile            # Rollipop dev server
bun run mobile:android    # debug APK / emulator
bun run mobile:ios        # Xcode / simulator (macOS)
```

`bun run mobile`, `mobile:android`, and `mobile:ios` ensure and link the fonts automatically. The native TTF files are generated under the ignored `vendor/fonts/native/` cache; run `bun run mobile:fonts` again after deleting that cache or when refreshing the font manifest.

Or from this package:

```sh
bun run start
bun run android
bun run ios
```

iOS pods (macOS):

```sh
cd ios && bundle install && bundle exec pod install
```
