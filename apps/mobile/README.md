# NovelEvolver Mobile

Expo (SDK 57) React Native app in the Bun monorepo.

## Stack

- **UI:** Expo managed workflow + React Native
- **Domain:** `@novelevolver/domain` (workspace package)
- **Lint:** local ESLint via `eslint-config-expo` (not included in root `bun run lint`)

## Prerequisites

### Android (local smoke test)

1. Install [Android SDK](https://developer.android.com/studio) (platform-tools, emulator, a system image).
2. Export environment variables (add to `~/.zshrc`):

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

3. Start an emulator **or** connect a device with [Expo Go](https://expo.dev/go) installed.

Verify:

```bash
adb devices
```

## Commands

From repo root:

```bash
bun run --filter @novelevolver/mobile start
bun run --filter @novelevolver/mobile android
bun run --filter @novelevolver/mobile lint
```

From `apps/mobile`:

```bash
bun run start      # Metro + QR / dev menu
bun run android    # Open on Android emulator or device
bun run lint       # ESLint
```

## Monorepo notes

- Backend access will live under `api/` (HTTP/WebSocket — not capnweb RPC).
- `@novelevolver/domain` is resolved through the workspace; Expo SDK 57+ autoconfigures Metro for monorepos.
