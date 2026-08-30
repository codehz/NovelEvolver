# NovelEvolver Mobile

Placeholder workspace for the future React Native app.

## Planned layout

- UI: React Native (Expo or bare workflow TBD)
- Shared contracts: `@novelevolver/shared` (`packages/shared`) — RPC DTOs, domain types, pure helpers
- Backend access: mobile-specific transport (HTTP/WebSocket) mirroring desktop capnweb RPC surfaces

## Next steps (when starting mobile)

1. Initialize React Native / Expo in this directory
2. Add `@novelevolver/shared` as a workspace dependency
3. Introduce a mobile RPC client that implements the same contracts as desktop preload bridge
4. Extract platform-agnostic UI logic into new shared packages as needed
