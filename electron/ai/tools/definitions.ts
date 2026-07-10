import type { ToolDefinition } from "@codehz/ai";

export const AI_TOOLS_MAP = {
  ask_user: {
    description:
      "当信息不足时向用户提出一个明确问题，并等待用户回答后再继续。可提供 choices 作为参考选项；用户始终可以自由输入答案。",
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
        choices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "选项标题，点击后可快速填入回答。",
              },
              description: {
                type: "string",
                description: "可选的补充解释，帮助用户理解该选项。",
              },
            },
            required: ["title"],
            additionalProperties: false,
          },
          description: "可选的参考选项列表，为用户提供快速填入；用户仍可自由输入其他答案。",
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
  read_resource_file: {
    description: "读取资源库中指定路径的文件内容。path 为相对资源库根目录的文件路径。",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: '相对资源库根目录的文件路径，例如 "设定/角色/主角.md"',
        },
      },
      required: ["path"],
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
