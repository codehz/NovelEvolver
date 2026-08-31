import type { DatabaseSync } from "node:sqlite";

/**
 * AI 会话历史 schema。
 *
 * 依赖 projects 表已存在（由 `@novelevolver/worktree` initAppState 先建），ai_conversation.project_id
 * 通过 FK + ON DELETE CASCADE 引用 projects(id)，删项目时会话记录原子级联清理。
 */
export function initAiChatSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_conversation (
      id TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      title_customized INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      adapter_kind TEXT NOT NULL,
      model TEXT NOT NULL,
      selected_model_id TEXT NOT NULL DEFAULT '',
      selected_agent_id TEXT NOT NULL DEFAULT 'builtin-writing-assistant',
      selected_reasoning_level TEXT,
      scenario_id TEXT,
      messages_json TEXT NOT NULL,
      history_json TEXT NOT NULL,
      pending_tool_batch_json TEXT,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      error_message TEXT,
      continue_assistant_id TEXT,
      PRIMARY KEY (id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Prototype: list/search order by content update time, not open/view time.
  db.exec(`DROP INDEX IF EXISTS idx_ai_conversation_project_active`);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_conversation_project_updated
      ON ai_conversation(project_id, updated_at DESC);
  `);

  const columns = db.prepare("PRAGMA table_info(ai_conversation)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "scenario_id")) {
    db.exec("ALTER TABLE ai_conversation ADD COLUMN scenario_id TEXT");
  }
  if (!columns.some((column) => column.name === "warnings_json")) {
    db.exec("ALTER TABLE ai_conversation ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.some((column) => column.name === "selected_model_id")) {
    db.exec("ALTER TABLE ai_conversation ADD COLUMN selected_model_id TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.some((column) => column.name === "selected_agent_id")) {
    db.exec(
      "ALTER TABLE ai_conversation ADD COLUMN selected_agent_id TEXT NOT NULL DEFAULT 'builtin-writing-assistant'",
    );
  }
  if (!columns.some((column) => column.name === "title_customized")) {
    db.exec("ALTER TABLE ai_conversation ADD COLUMN title_customized INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.some((column) => column.name === "selected_reasoning_level")) {
    db.exec("ALTER TABLE ai_conversation ADD COLUMN selected_reasoning_level TEXT");
  }
  if (!columns.some((column) => column.name === "continue_assistant_id")) {
    db.exec("ALTER TABLE ai_conversation ADD COLUMN continue_assistant_id TEXT");
  }
}
