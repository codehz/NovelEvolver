# NovelEvolver Mobile

Bare React Native app (`@react-native-community/cli`). **Expo is not used and must not be added.**

- Native id: `com.novelevolver.mobile`
- JS component name: `NovelEvolver` (`app.json`)
- Domain types: `@novelevolver/domain`
- Backend access: mobile-specific (local storage, HTTP, WebSocket — TBD; **not** capnweb RPC)

## Commands

From the repository root:

```sh
bun install
bun run mobile          # Metro
bun run mobile:android  # debug APK / emulator
bun run mobile:ios      # Xcode / simulator (macOS)
```

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
