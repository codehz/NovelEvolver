`shared/rpc` is organized by contract layer:

- `transport/`: renderer-main bridge protocol, stream helpers, transport bridge types
- `root/`: app-level RPC root entrypoint
- `services/`: top-level application services exposed from the root
- `session/`: long-lived project and branch-scoped live handles
- `worktree/`: branch worktree domain contracts and DTOs
- `ai/`: AI chat contracts and snapshot reducers

Use the nearest domain barrel (`#shared/rpc/transport`, `#shared/rpc/worktree`, etc.) for
cross-package imports. Leaf files stay inside each domain for local maintenance.
