import type { ToolDefinition } from "@codehz/ai";

export const LIST_RESOURCE_FILES_TOOL_NAME = "list_resource_files";

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: LIST_RESOURCE_FILES_TOOL_NAME,
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
];
