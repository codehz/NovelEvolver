# NovelEvolver Mobile

Placeholder workspace for the future React Native app.

## Planned layout

- UI: React Native (Expo or bare workflow TBD)
- Domain types: `@novelevolver/domain` (`packages/domain`) — DTOs, feed event shapes, pure helpers
- Backend access: mobile-specific API layer (local storage, HTTP, WebSocket — TBD; **not** capnweb RPC)

## Next steps (when starting mobile)

1. Initialize React Native / Expo in this directory
2. Add `@novelevolver/domain` as a workspace dependency
3. Introduce a mobile `api/` module that exposes domain-shaped operations for the chosen transport
4. Extract platform-agnostic UI logic (reducers, projectors) into shared packages as needed
