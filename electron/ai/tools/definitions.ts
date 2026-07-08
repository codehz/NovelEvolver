import type { ToolDefinition } from "@codehz/ai";

export const AI_TOOLS_MAP = {
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
