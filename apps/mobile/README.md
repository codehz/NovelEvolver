# NovelEvolver Mobile

Bare React Native app (`@react-native-community/cli`). **Expo is not used and must not be added.**

- Native id: `com.novelevolver.mobile`
- JS component name: `NovelEvolver` (`app.json`)
- Domain types: `@novelevolver/domain`
- Bundler: Metro (`metro.config.js`) with `react-native-monorepo-config` for workspace resolution. RN CLI `start` / `bundle` use the standard Metro commands. Codicon imports (`~icons/{collection}/{icon}`) are resolved by `metro-icons-resolver.js` into React Native SVG components.
- Theme: Catppuccin Mocha JS tokens in `src/shared/theme/` (no NativeWind / Tailwind). Semantic roles match desktop `@theme` (`background` / `surface` / mauve accent). Flavor is pinned — do not follow system light mode.
- Backend access: mobile-specific (local MMKV settings, HTTP, WebSocket — TBD; **not** capnweb RPC)
- Settings: local MMKV (`novelevolver-settings`), domain store logic from `@novelevolver/domain`

## Commands

From the repository root:

```sh
bun install
bun run mobile:fonts     # ensure and link native MiSans / Maple Mono assets
bun run mobile            # Metro dev server
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
