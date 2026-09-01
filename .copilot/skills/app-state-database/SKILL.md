---
name: app-state-database
description: 分析、查询和修改 NovelEvolver 的 app-state.db（SQLite）数据库。Use when: 需要查看数据库结构、查询表数据、分析存储内容、排查持久化问题、理解 worktree/manuscript/resource/AI 对话的存储模式，或修改数据库 schema/Repository。
---

# App-State 数据库分析

## 概述

NovelEvolver 的应用状态持久化由一个 **SQLite 数据库**（`app-state.db`）承担。物理文件位于 Electron `userData` 目录下，通过 `node:sqlite` 的 `DatabaseSync` API 进行同步读写，开启 WAL 模式 + 外键级联。

## 文件位置

| 文件           | 路径                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| 数据库容器     | `apps/desktop/electron/db/app-database.ts`                                                            |
| Schema + Repos | `packages/worktree/src/db/`（`schema.ts`、`projects-repo.ts`、`worktree-repo.ts`、`ai-chat-repo.ts`） |
| 数据库初始化   | `apps/desktop/electron/main.ts`（`new AppDatabase(join(userData, "app-state.db"))`)                   |
| 仓库记忆       | `/memories/repo/app-state-database.md`                                                                |

## 架构设计

### AppDatabase 容器

`apps/desktop/electron/db/app-database.ts`

- 封装单个 `DatabaseSync` 实例，全局共享一份连接。
- 启动时开启 `PRAGMA foreign_keys = ON`、`PRAGMA journal_mode = WAL`、`PRAGMA busy_timeout = 5000`。
- 调用 `@novelevolver/worktree` 的 `initAppState`（`initProjectsSchema` → `initWorktreeSchema` → `initAiChatSchema`）。
- 提供 `transaction<T>(operation: () => T)` 执行 `BEGIN IMMEDIATE` 事务，跨 repo 写入可放在同一事务中。

### Repository 模式

Schema DDL 在 `packages/worktree/src/db/schema.ts`；查询接口在同目录 `*-repo.ts`，构造时注入共享 `DatabasePort`，不自行 open 连接。

所有 SQL Row 类型用 `snake_case` 匹配数据库列名，Record 类型用 `camelCase` 匹配 JS/TS 约定，通过 `rowToRecord` 系列函数转换。

---

## 完整 Schema

### 1. projects — 项目注册表

```sql
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  last_opened_at INTEGER NOT NULL
);
```

| 列               | 类型        | 说明                                                  |
| ---------------- | ----------- | ----------------------------------------------------- |
| `id`             | INTEGER     | 自增主键，被 worktree 和 ai_conversation 通过 FK 引用 |
| `path`           | TEXT UNIQUE | 项目的绝对路径，唯一约束                              |
| `last_opened_at` | INTEGER     | Unix 时间戳，记录最后打开时间                         |

**被引用关系**：

- `worktree.project_id` → `projects(id)` ON DELETE CASCADE
- `ai_conversation.project_id` → `projects(id)` ON DELETE CASCADE

**Repository 操作**（`ProjectsRepository`）：

| 方法                               | 说明                                               |
| ---------------------------------- | -------------------------------------------------- |
| `list()`                           | 按 `last_opened_at DESC` 列出所有项目              |
| `getById(id)`                      | 按主键获取单条记录                                 |
| `upsertByPath(path, lastOpenedAt)` | INSERT OR UPDATE（path 冲突时更新 last_opened_at） |
| `touchById(id, lastOpenedAt)`      | 更新最后打开时间                                   |
| `removeById(id)`                   | 删除项目（级联删除关联 worktree/会话）             |

### 2. worktree — 工作树

```sql
CREATE TABLE IF NOT EXISTS worktree (
  project_id INTEGER NOT NULL,
  branch_name TEXT NOT NULL,
  base_commit_sha TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  warning TEXT,
  PRIMARY KEY (project_id, branch_name),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

| 列                | 类型      | 说明                               |
| ----------------- | --------- | ---------------------------------- |
| `project_id`      | INTEGER   | FK → projects(id)，级联删除        |
| `branch_name`     | TEXT      | 分支名，与 project_id 组成联合主键 |
| `base_commit_sha` | TEXT NULL | 基础提交 SHA                       |
| `revision`        | INTEGER   | 乐观锁/版本号，默认 0              |
| `warning`         | TEXT NULL | 警告信息                           |

### 3. manuscript_node_current — 稿件当前版（树节点）

```sql
CREATE TABLE IF NOT EXISTS manuscript_node_current (
  project_id INTEGER NOT NULL,
  branch_name TEXT NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  content BLOB,
  PRIMARY KEY (project_id, branch_name, id),
  FOREIGN KEY (project_id, branch_name)
    REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_manuscript_current_parent
  ON manuscript_node_current(project_id, branch_name, parent_id);
```

| 列                          | 类型      | 说明                      |
| --------------------------- | --------- | ------------------------- |
| `project_id`, `branch_name` | PK        | FK → worktree，级联删除   |
| `id`                        | TEXT PK   | 节点 ID（如 UUID）        |
| `parent_id`                 | TEXT NULL | 父节点 ID，NULL = 根节点  |
| `type`                      | TEXT      | `"folder"` 或 `"chapter"` |
| `title`                     | TEXT      | 节点标题                  |
| `sort_index`                | INTEGER   | 排序序号                  |
| `content`                   | BLOB NULL | 正文内容（二进制数据）    |

**查询模式**：配合 `ORDER BY parent_id IS NOT NULL, parent_id, sort_index, id` 返回层次化排序结果。

### 4. manuscript_node_committed — 稿件已提交版

```sql
CREATE TABLE IF NOT EXISTS manuscript_node_committed (
  project_id INTEGER NOT NULL,
  branch_name TEXT NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  content_sha TEXT,
  PRIMARY KEY (project_id, branch_name, id),
  FOREIGN KEY (project_id, branch_name)
    REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
);
```

与 `manuscript_node_current` 结构相同，但用 `content_sha`（TEXT）替代 `content`（BLOB），指向 `worktree_blob` 中的内容哈希。

### 5. resource_node_current — 资源当前版

```sql
CREATE TABLE IF NOT EXISTS resource_node_current (
  project_id INTEGER NOT NULL,
  branch_name TEXT NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content BLOB,
  PRIMARY KEY (project_id, branch_name, id),
  FOREIGN KEY (project_id, branch_name)
    REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
);
```

与 manuscript 类似，但用 `name` 替代 `title`，`type` 为 `"folder"` | `"file"`。

### 6. resource_node_committed — 资源已提交版

与 `resource_node_current` 结构相同，`content` (BLOB) → `content_sha` (TEXT)。

### 7. worktree_blob — 内容 Blob 存储

```sql
CREATE TABLE IF NOT EXISTS worktree_blob (
  project_id INTEGER NOT NULL,
  blob_id TEXT NOT NULL,
  content_sha TEXT NOT NULL,
  content BLOB NOT NULL,
  PRIMARY KEY (project_id, blob_id),
  UNIQUE (project_id, content_sha),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

| 列            | 类型        | 说明                             |
| ------------- | ----------- | -------------------------------- |
| `project_id`  | INTEGER     | FK → projects(id)                |
| `blob_id`     | TEXT PK     | Blob 唯一 ID                     |
| `content_sha` | TEXT UNIQUE | 内容哈希（同一项目内唯一，去重） |
| `content`     | BLOB        | 原始二进制内容                   |

**插入语义**：`ON CONFLICT(project_id, blob_id) DO NOTHING` — 相同 blob_id 不重复写入（幂等插入）。

### 8. worktree_journal_entry — 操作日志/变更记录

```sql
CREATE TABLE IF NOT EXISTS worktree_journal_entry (
  project_id INTEGER NOT NULL,
  branch_name TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  worktree_revision INTEGER NOT NULL,
  actor TEXT NOT NULL,           -- "user" | "system"
  source TEXT NOT NULL,          -- "autosave" | "manual-checkpoint" | "structure-edit" | "restore" | "commit" | "import"
  title TEXT NOT NULL,
  kind TEXT NOT NULL,            -- "create" | "delete" | "rename" | "move" | "reorder" | "content" | "restore"
  domain TEXT NOT NULL,          -- "manuscript" | "resource"
  entity_id TEXT NOT NULL,
  entity_kind TEXT NOT NULL,     -- "chapter" | "folder" | "file"
  label TEXT NOT NULL,
  display_path TEXT NOT NULL,
  previous_label TEXT,
  previous_path TEXT,
  before_blob_id TEXT,
  after_blob_id TEXT,
  stats_added INTEGER,
  stats_removed INTEGER,
  commit_hash TEXT,
  group_key TEXT,
  metadata_json TEXT,
  PRIMARY KEY (project_id, branch_name, entry_id),
  FOREIGN KEY (project_id, branch_name)
    REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
);
```

- `before_blob_id` / `after_blob_id` 指向 `worktree_blob.blob_id`，通过 LEFT JOIN 获取实际内容（`before_content` / `after_content`）。
- `group_key` 用于同组条目的合并去重逻辑（`getMergeableJournalEntry`）。

### 9. ai_conversation — AI 会话记录

```sql
CREATE TABLE IF NOT EXISTS ai_conversation (
  id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  adapter_kind TEXT NOT NULL,
  model TEXT NOT NULL,
  selected_model_id TEXT NOT NULL DEFAULT '',
  scenario_id TEXT,
  messages_json TEXT NOT NULL,
  history_json TEXT NOT NULL,
  pending_tool_batch_json TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  error_message TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_project_active
  ON ai_conversation(project_id, last_active_at DESC);
```

| 列                        | 类型       | 说明                       |
| ------------------------- | ---------- | -------------------------- |
| `id`                      | TEXT PK    | 会话 ID                    |
| `project_id`              | INTEGER FK | → projects(id)             |
| `title`                   | TEXT       | 会话标题                   |
| `status`                  | TEXT       | `"active"` 或 `"archived"` |
| `adapter_kind`            | TEXT       | AI 适配器类型              |
| `model`                   | TEXT       | 模型名称                   |
| `selected_model_id`       | TEXT       | 选中的模型 ID              |
| `scenario_id`             | TEXT NULL  | 场景 ID                    |
| `messages_json`           | TEXT       | 消息列表 JSON              |
| `history_json`            | TEXT       | 历史记录 JSON              |
| `pending_tool_batch_json` | TEXT NULL  | 待处理工具批次 JSON        |
| `warnings_json`           | TEXT       | 警告列表 JSON，默认 `"[]"` |
| `error_message`           | TEXT NULL  | 错误消息                   |

**兼容性补丁**：`initAiChatSchema` 启动时检测列是否存在，不存在则 `ALTER TABLE ADD COLUMN`（`scenario_id`、`warnings_json`、`selected_model_id`）。

**查询**：`listSummariesByProject` / `getLatestByProject` 过滤 `status = 'active'`，按 `updated_at DESC` 排序。

---

## 实体关系图（ER 概要）

```
projects (id)
  ├──< worktree (project_id, branch_name)
  │      ├──< manuscript_node_current (project_id, branch_name)
  │      ├──< manuscript_node_committed (project_id, branch_name)
  │      ├──< resource_node_current (project_id, branch_name)
  │      ├──< resource_node_committed (project_id, branch_name)
  │      └──< worktree_journal_entry (project_id, branch_name)
  ├──< ai_conversation (project_id)
  └──< worktree_blob (project_id)
```

- 所有 FK 均为 `ON DELETE CASCADE`，删除 project 时自动清理所有关联数据。
- `manuscript_node_current` / `manuscript_node_committed` 存储彼此独立的 current 和 committed 两份数据。
- `worktree_journal_entry.before_blob_id` / `after_blob_id` 可选 JOIN `worktree_blob` 获取内容快照。

---

## 分析数据库的常用操作

### 查询数据库文件物理路径

数据库文件为 `app-state.db`，位于 `app.getPath("userData")` 下，见 `electron/main.ts`：

```typescript
const userData = app.getPath("userData");
appDb = new AppDatabase(join(userData, "app-state.db"));
```

### 用 sqlite3 CLI 直接分析

```bash
sqlite3 ~/.config/NovelEvolver/app-state.db
# 或 macOS:
sqlite3 ~/Library/Application\ Support/NovelEvolver/app-state.db
```

常用 CLI 命令：

```sql
.tables                          -- 列出所有表
.schema projects                 -- 查看表结构
SELECT COUNT(*) FROM projects;   -- 项目数量
SELECT * FROM projects;          -- 所有项目
```

### 从代码中分析

所有 Repository 都接受共享 `DatabaseSync` 句柄：

```typescript
const repo = new ProjectsRepository(appDb.db);
const projects = repo.list();
```

### 跨表查询示例

```sql
-- 某项目的所有分支
SELECT branch_name, revision, warning FROM worktree WHERE project_id = 1;

-- 某分支的完整稿件树
SELECT id, parent_id, type, title, sort_index
FROM manuscript_node_current
WHERE project_id = 1 AND branch_name = 'main'
ORDER BY parent_id IS NOT NULL, parent_id, sort_index, id;

-- 某实体的变更历史（带前后内容）
SELECT entry.title, entry.kind, entry.source, before_blob.content, after_blob.content
FROM worktree_journal_entry entry
LEFT JOIN worktree_blob before_blob
  ON before_blob.project_id = entry.project_id AND before_blob.blob_id = entry.before_blob_id
LEFT JOIN worktree_blob after_blob
  ON after_blob.project_id = entry.project_id AND after_blob.blob_id = entry.after_blob_id
WHERE entry.project_id = 1 AND entry.branch_name = 'main'
  AND entry.domain = 'manuscript' AND entry.entity_id = ?
ORDER BY entry.updated_at DESC;

-- 某项目的活跃 AI 会话
SELECT id, title, adapter_kind, model, last_active_at
FROM ai_conversation
WHERE project_id = 1 AND status = 'active'
ORDER BY last_active_at DESC;
```

---

## 修改 Schema 指南

1. **Schema 变更**：修改 `packages/worktree/src/db/schema.ts` 中的 `CREATE TABLE` 语句（添加 `IF NOT EXISTS` 保证幂等）。
2. **新增列**：在 schema 文件中通过 `ALTER TABLE ADD COLUMN` 添加（参考 `initAiChatSchema` 中的兼容性补丁模式）。
3. **新增表**：在对应的 `init*Schema` 中添加 `CREATE TABLE IF NOT EXISTS`，并在 `initAppState` 中按 FK 依赖顺序调用。
4. **Repository 更新**：在对应 `packages/worktree/src/db/*-repo.ts` 中添加新方法和 SQL Row/Record 类型。
5. **命名约定**：SQL 列名用 `snake_case`，TS Record 属性用 `camelCase`，Row 类型用 `*SqlRow`，Record 类型用 `*Record`。
6. **原型阶段**：不需要 migration 路径，schema 可暴力变更（见 AGENTS.md 兼容性策略）。

---

## TypeScript 类型速查

### Worktree 相关枚举

```typescript
// 操作域
type WorktreeJournalDomain = "manuscript" | "resource";

// 变更来源
type WorktreeJournalSource =
  "autosave" | "manual-checkpoint" | "structure-edit" | "restore" | "commit" | "import";

// 操作角色
type WorktreeJournalActor = "user" | "system";

// 操作类型
type WorktreeJournalOperationKind =
  "create" | "delete" | "rename" | "move" | "reorder" | "content" | "restore";

// 实体类型
type WorktreeJournalEntityKind = "chapter" | "folder" | "file";
```

### AI 会话状态

```typescript
type AiConversationStatus = "active" | "archived";
```

### 节点类型

- Manuscript: `type: "folder" | "chapter"`，`title` 字段
- Resource: `type: "folder" | "file"`，`name` 字段
