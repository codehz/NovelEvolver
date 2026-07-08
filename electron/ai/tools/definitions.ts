import type { ToolDefinition } from "@codehz/ai";

export const AI_TOOLS_MAP = {
  ask_user: {
    description: "当信息不足时向用户提出一个明确问题，并等待用户回答后再继续。",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "展示给用户的问题文本，应该简洁明确。",
        },
        context: {
          type: "string",
          description: "可选的补充说明，帮助用户理解为什么需要这个信息。",
        },
        placeholder: {
          type: "string",
          description: "可选的输入框占位提示。",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  list_resource_files: {
    description:
      "递归列出资源库指定目录下的所有文件（不含文件夹）。path 为空字符串时表示整个资源库。",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: '相对资源库根目录的路径，例如 "" 或 "设定/角色"',
        },
      },
      additionalProperties: false,
    },
  },
} as const satisfies Record<string, Omit<ToolDefinition, "name">>;

export type AI_TOOL_NAMES = keyof typeof AI_TOOLS_MAP;
export const AI_TOOL_NAMES: { [key in AI_TOOL_NAMES]: key } = Object.fromEntries(
  Object.keys(AI_TOOLS_MAP).map((name) => [name, name]),
) as { [key in AI_TOOL_NAMES]: key };

export const AI_TOOLS: ToolDefinition[] = Object.entries(AI_TOOLS_MAP).map(([name, def]) => ({
  name,
  ...def,
}));
