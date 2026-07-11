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
  get_project_structure: {
    description:
      "读取当前项目的手稿树和资源树结构，返回节点 ID、类型、标题或名称、父子关系与展示路径。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource", "all"],
          description: '可选，限制返回的结构范围；默认 "all"。',
        },
      },
      additionalProperties: false,
    },
  },
  read_text_document: {
    description: "读取指定章节或资源文件的全文内容。",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["manuscript", "resource"],
            },
            id: {
              type: "string",
              description: "章节或资源文件的节点 ID。",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  search_project: {
    description: "全文搜索手稿和资源库，返回命中的节点 ID、路径、行号和片段。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词。",
        },
        scope: {
          type: "string",
          enum: ["manuscript", "resource", "all"],
          description: '可选，限制搜索范围；默认 "all"。',
        },
        max_results: {
          type: "integer",
          description: "可选，每个域最多返回多少条命中。",
          minimum: 1,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  edit_text_document: {
    description: "编辑章节或资源文件，要求 expected_content 与当前内容完全一致，避免覆盖并发修改。",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["manuscript", "resource"],
            },
            id: {
              type: "string",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
        expected_content: {
          type: "string",
          description: "调用方预期的当前全文内容。",
        },
        new_content: {
          type: "string",
          description: "要写入的新全文内容。",
        },
      },
      required: ["target", "expected_content", "new_content"],
      additionalProperties: false,
    },
  },
  create_document: {
    description: "创建章节、手稿文件夹、资源文件或资源文件夹。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        kind: {
          type: "string",
          enum: ["chapter", "file", "folder"],
        },
        parent_id: {
          type: "string",
        },
        name: {
          type: "string",
        },
        index: {
          type: "integer",
          description: "可选，仅手稿节点支持。",
        },
        content: {
          type: "string",
          description: "可选，仅资源文件支持。",
        },
      },
      required: ["domain", "kind", "parent_id", "name"],
      additionalProperties: false,
    },
  },
  move_document: {
    description: "移动章节、手稿文件夹或资源节点到新的父节点下。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
        },
        target_parent_id: {
          type: "string",
        },
        index: {
          type: "integer",
          description: "可选，仅手稿域支持，表示在目标父节点子列表中的插入位置。",
        },
      },
      required: ["domain", "id", "target_parent_id"],
      additionalProperties: false,
    },
  },
  rename_document: {
    description: "重命名手稿节点（章节或文件夹）或资源节点（文件或文件夹）。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
        },
        name: {
          type: "string",
          description: "新标题（手稿）或新名称（资源）。",
        },
      },
      required: ["domain", "id", "name"],
      additionalProperties: false,
    },
  },
  delete_document: {
    description:
      "删除手稿或资源节点。执行前须先通过 ask_user 获得用户明确同意，尤其是会递归删除子节点的文件夹。要求 expected_name 与当前节点标题或名称一致。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
        },
        expected_name: {
          type: "string",
          description: "调用方预期的当前节点标题或名称。",
        },
      },
      required: ["domain", "id", "expected_name"],
      additionalProperties: false,
    },
  },
  get_worktree_changes: {
    description: "返回当前工作区相对分支基线的未提交变更列表及统计。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource", "all"],
          description: '可选，限制返回的变更域；默认 "all"。',
        },
      },
      additionalProperties: false,
    },
  },
  read_document_diff: {
    description:
      "读取某章节或资源文件相对当前未提交变更的文本差异（基线正文 vs 当前正文）。仅当该节点存在可预览的未提交文本变更时可用。",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["manuscript", "resource"],
            },
            id: {
              type: "string",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  list_document_history: {
    description: "获取指定章节或资源文件的编辑历史记录。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
        },
        limit: {
          type: "integer",
          description: "可选，最多返回条数，默认 50，最大 200。",
          minimum: 1,
        },
      },
      required: ["domain", "id"],
      additionalProperties: false,
    },
  },
  read_history_version: {
    description: "读取某条历史记录保存的正文及变更前正文（若有）。",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "string",
        },
      },
      required: ["entry_id"],
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
