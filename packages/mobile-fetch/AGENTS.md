# Streaming fetch (`@novelevolver/mobile-fetch`)

Mobile-only `fetch` replacement with a readable `Response.body`. React Native's built-in `fetch` leaves `response.body` unset, which breaks `@codehz/ai` SSE (`Response body is not readable`).

- Native: Nitro Hybrid Objects over OkHttp (Android) and `URLSession` (iOS)
- JS: `installStreamFetch()` patches `globalThis.fetch`; always streams (no prefetch / worklets / Cronet)
- Do not add `react-native-nitro-fetch`

After changing `*.nitro.ts` or `nitro.json`, run `bun run specs` in this package and commit `nitrogen/generated/`.
