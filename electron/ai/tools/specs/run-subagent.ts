import type { ToolSpec } from "../types";

/**
 * Orchestrator-only tool: schema is registered for model discovery / settings.
 * Execution is hosted by `AiConversationRuntime` + `SubagentExecutor` (not sync worktree run).
 */
export const runSubagentSpec: ToolSpec<"run_subagent"> = {
  name: "run_subagent",
  definition: {
    description:
      "将一个独立子任务委派给指定专家 Agent（隔离上下文，不继承本会话完整历史）。适用于一致性审查、章节续写、设定检索等可拆分工作。子代理按自身工具白名单运行（不会再嵌套委派，也不能 ask_user）；完成后返回 summary 与 artifacts。需要用户澄清时先自行 ask_user，再委派。focus 只需节点 id：服务端会自动预载 chapter/file 正文（含 revision）或 folder 子节点摘要注入子代理，无需粘贴正文。",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description:
            "目标 Agent 的 id（如 builtin-consistency-reviewer、builtin-chapter-writer，或用户自定义 Agent）。",
        },
        task: {
          type: "string",
          description: "子任务目标与验收标准；写清要读什么、产出什么、是否允许写回。",
        },
        constraints: {
          type: "string",
          description: "可选约束：文风、不要改人设、只读等。",
        },
        focus: {
          type: "array",
          description:
            "可选焦点节点列表（最多 8 个）。只需 domain+id；服务端自动注入正文/结构，不要粘贴全文。",
          items: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                enum: ["manuscript", "resource"],
              },
              id: {
                type: "string",
                description: "节点 id（来自 read_structure / mention，不是名称）。",
              },
            },
            required: ["domain", "id"],
            additionalProperties: false,
          },
        },
        parent_summary: {
          type: "string",
          description: "可选的极短背景（服务端会截断）；不要粘贴大段正文或完整对话。",
        },
      },
      required: ["agent_id", "task"],
      additionalProperties: false,
    },
  },
  run() {
    throw new Error("run_subagent 必须由会话 runtime 执行，不能直接作为 worktree 工具运行。");
  },
};
