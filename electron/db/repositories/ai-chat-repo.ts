import type { DatabaseSync } from "node:sqlite";

export type AiConversationStatus = "active" | "archived";

export type AiConversationSummaryRecord = {
  id: string;
  projectId: number;
  title: string;
  status: AiConversationStatus;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  adapterKind: string;
  model: string;
};

export type AiConversationRecord = AiConversationSummaryRecord & {
  messagesJson: string;
  historyJson: string;
  pendingToolBatchJson: string | null;
  errorMessage: string | null;
};

type AiConversationRow = {
  id: string;
  project_id: number;
  title: string;
  status: string;
  created_at: number;
  updated_at: number;
  last_active_at: number;
  adapter_kind: string;
  model: string;
  messages_json: string;
  history_json: string;
  pending_tool_batch_json: string | null;
  error_message: string | null;
};

function toStatus(value: string): AiConversationStatus {
  return value === "archived" ? "archived" : "active";
}

function rowToSummary(row: AiConversationRow): AiConversationSummaryRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: toStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
    adapterKind: row.adapter_kind,
    model: row.model,
  };
}

function rowToRecord(row: AiConversationRow): AiConversationRecord {
  return {
    ...rowToSummary(row),
    messagesJson: row.messages_json,
    historyJson: row.history_json,
    pendingToolBatchJson: row.pending_tool_batch_json,
    errorMessage: row.error_message,
  };
}

/**
 * ai_conversation 表的 query 接口。
 *
 * 不负责建表（schema 由 initAiChatSchema 在 AppDatabase 启动时执行），
 * 也不持有自己的连接，构造时注入共享 DatabaseSync 句柄。
 */
export class AiChatRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  listByProject(projectId: number): AiConversationRecord[] {
    const rows = this.#db
      .prepare(
        `
        SELECT
          id, project_id, title, status, created_at, updated_at, last_active_at,
          adapter_kind, model, messages_json, history_json, pending_tool_batch_json, error_message
        FROM ai_conversation
        WHERE project_id = ? AND status = 'active'
        ORDER BY last_active_at DESC
        `,
      )
      .all(projectId) as AiConversationRow[];

    return rows.map(rowToRecord);
  }

  getLatestByProject(projectId: number): AiConversationRecord | null {
    const row = this.#db
      .prepare(
        `
        SELECT
          id, project_id, title, status, created_at, updated_at, last_active_at,
          adapter_kind, model, messages_json, history_json, pending_tool_batch_json, error_message
        FROM ai_conversation
        WHERE project_id = ? AND status = 'active'
        ORDER BY last_active_at DESC
        LIMIT 1
        `,
      )
      .get(projectId) as AiConversationRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  getById(projectId: number, id: string): AiConversationRecord | null {
    const row = this.#db
      .prepare(
        `
        SELECT
          id, project_id, title, status, created_at, updated_at, last_active_at,
          adapter_kind, model, messages_json, history_json, pending_tool_batch_json, error_message
        FROM ai_conversation
        WHERE project_id = ? AND id = ?
        `,
      )
      .get(projectId, id) as AiConversationRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  upsert(record: AiConversationRecord): void {
    this.#db
      .prepare(
        `
        INSERT INTO ai_conversation (
          id, project_id, title, status, created_at, updated_at, last_active_at,
          adapter_kind, model, messages_json, history_json, pending_tool_batch_json, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          title = excluded.title,
          status = excluded.status,
          updated_at = excluded.updated_at,
          last_active_at = excluded.last_active_at,
          adapter_kind = excluded.adapter_kind,
          model = excluded.model,
          messages_json = excluded.messages_json,
          history_json = excluded.history_json,
          pending_tool_batch_json = excluded.pending_tool_batch_json,
          error_message = excluded.error_message
        `,
      )
      .run(
        record.id,
        record.projectId,
        record.title,
        record.status,
        record.createdAt,
        record.updatedAt,
        record.lastActiveAt,
        record.adapterKind,
        record.model,
        record.messagesJson,
        record.historyJson,
        record.pendingToolBatchJson,
        record.errorMessage,
      );
  }
}
