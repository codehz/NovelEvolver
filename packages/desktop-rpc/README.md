# desktop-rpc

`desktop-rpc` is organized by contract layer:

- `transport/`: renderer-main bridge protocol, stream helpers, transport bridge types
- `root/`: app-level RPC root entrypoint
- `services/`: top-level application services exposed from the root
- `session/`: long-lived project and branch-scoped live handles
- `worktree/`: branch worktree domain contracts and DTOs
- `ai/`: AI chat contracts and snapshot reducers

Use the nearest domain barrel (`@novelevolver/desktop-rpc/transport`, `@novelevolver/desktop-rpc/worktree`, etc.) for
cross-package imports. Leaf files stay inside each domain for local maintenance.

## 用户态协议约定

以下约束面向 **用户态契约与实现分层**（`desktop-rpc` + `electron/rpc` + renderer 消费），**不含**
capnweb 传输层本身。

### 分层

```
AppRpcRoot
  → Services (window / projectLibrary / workspace / settings)
    → Session / Handle (ProjectSession, BranchWorkspace, ProjectAi, …)
      → DTO / Event (纯数据，无 stub)
```

- 仅 **live remote object** `extends RpcTarget`（root、service、session、handle）。
- Snapshot、delta、query/result 等一律为 **plain interface / type**，禁止嵌入 `RpcTarget` / stub。
- Stream event 里同样禁止 stub（先例：AI `openInteractions` 用可序列化 id 回传）。

### 依赖方向

- Renderer 只依赖 `@novelevolver/desktop-rpc/*` 契约与 DTO。
- 实现放在 `electron/rpc/{server,services,session,handles}/`；domain 逻辑在 `@novelevolver/worktree`、
  `electron/ai/` 等，**不进** handle（handle 只做薄委托）。
- `@novelevolver/worktree` 不得 import `electron/rpc/`；共享流工具在 `electron/lib/`（AI/window）或包内 publisher（worktree 变更流）。

### 同步优先

- 默认同步方法签名。
- 仅在以下情况使用 `Promise`：系统对话框、真实异步 I/O、或返回 `RpcSubscriptionResult` 的订阅。

### 订阅三类（用户态）

| 类型               | 形态                                                               | 适用                                                                                               |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **State feed**     | 首包 `{ kind: "snapshot"; snapshot }`，后续 `{ kind: "delta"; … }` | 高频 / 大体量（AI active chat、changes）                                                           |
| **Directory feed** | 始终 `{ kind: "snapshot"; snapshot }` 全量替换                     | 中小列表（AI conversations 目录）                                                                  |
| **Value feed**     | 直接推 `T`（无 kind 标签）                                         | 极小状态；**新代码优先用带 kind 的形态**。现状 `WindowService.subscribeState` 为 legacy value feed |

公共原语见 `domain/sync/feed.ts 的 SnapshotEvent` / `RpcDeltaEvent`。

规则：

- 订阅方法返回 `RpcSubscriptionResult<T>`（`PromiseLike` + cancelable stream）。
- State / Directory feed **首包必须是当前完整 snapshot**，消费者只订一条通道。
- Delta 的 payload 形状由域自定（`ops[]` 或 structured patch）；目录体量小时用 snapshot-only，不必硬加 delta。

### Handle 粒度

- 单一能力 / 单一主 feed → 独立 handle。
- 多个子能力用 **facade + `readonly` 子 handle 属性** 暴露（参考 `BranchWorkspace`、`ProjectAi`）。
- 单 feed handle 方法名为 `subscribe()`；service 级或多 feed 用 `subscribeXxx()`。

### 命名

| 角色                     | 约定                                               |
| ------------------------ | -------------------------------------------------- |
| 单 feed 订阅             | `subscribe()`                                      |
| 多 feed / service 级订阅 | `subscribeXxx()`                                   |
| 列表 / 搜索              | `list*` / `search*`                                |
| 内容读写                 | `read*` / `write*`                                 |
| 结构变更                 | `create*` / `rename*` / `move*` / `delete*` 等动词 |

### 共享域字面量

跨 worktree 表面重复的域字面量（如 `"manuscript" | "resource"`）应收敛为 **单一导出类型**
（如 `WorktreeDomain`），其余 `ChangeDomain` / `HistoryDomain` / `WorktreeSearchDomain` 用 alias，
避免三处漂移。

### 生命周期

- Server 侧缓存的 session/workspace handle **由 server 拥有**（如 `ProjectSession` 的 branch workspace map）。
- Renderer **不得**在 scope unmount 时 dispose 这类缓存句柄，否则会得到 zombie（例如 `subscribeChanges` 空流结束、UI 永久 loading）。
- 仅对「本次 RPC 会话根打开、且明确由客户端持有」的对象使用 `wrapDisposable`（如 `openProject` 返回的 `ProjectSession`）。

### 范例：`ProjectAi` 三子 handle

```ts
// ProjectSession.ai
interface ProjectAi extends RpcTarget {
  readonly active: AiActiveChatHandle; // State feed: subscribe() → AiChatEvent
  readonly conversations: AiConversationsHandle; // Directory feed: subscribe() → snapshot-only
  readonly catalog: AiCatalogHandle; // pull listModels / listAgents
}
```

- 活跃会话回合与选择写入在 `active`；目录 CRUD/search 在 `conversations`；模型/Agent 只读目录在 `catalog`。
- 会话目录 **不含** `activeConversationId`（避免与 active snapshot 双源）。
- 搜索保持 pull（`conversations.search`），不把 query 塞进订阅状态。
