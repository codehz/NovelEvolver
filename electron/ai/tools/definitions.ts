import type { ToolDefinition } from "@codehz/ai";

export const AI_TOOLS_MAP = {
  ask_user: {
    description:
      "仅当继续执行所必需的信息缺失或需要用户确认时调用。一次只问一个明确问题；choices 仅作快捷建议，用户仍可自由输入。调用后等待回答，不要假设答案。",
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
      "获取节点 ID 和层级关系。需要按名称或路径定位节点，或为读取、创建、移动、重命名、删除操作获取 ID 时先调用；返回 root_id、节点类型、父子关系和 display_path，不返回文件正文。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource", "all"],
          description: '要读取的树；省略时为 "all"。',
        },
      },
      additionalProperties: false,
    },
  },
  read_text_document: {
    description:
      "读取一个可编辑文本节点的当前全文。manuscript 仅支持 chapter，resource 仅支持 file；id 必须使用 get_project_structure 返回的节点 ID。编辑前必须先调用以取得 expected_content。",
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
              description: "get_project_structure 返回的 chapter 或 file 节点 ID，不是名称或路径。",
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
    description:
      "按字面关键词搜索章节和资源文件正文，用于定位内容所在节点；返回命中节点 ID、路径、1-based 行列号和片段。需要浏览目录结构时改用 get_project_structure。",
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
          description: '搜索域；省略时为 "all"。',
        },
        max_results: {
          type: "integer",
          description: "每个域的最大命中数；省略时使用系统默认值。",
          minimum: 1,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  edit_text_document: {
    description:
      "将一个章节或资源文件的全文替换为 new_content。仅在大范围重写时使用；局部修改优先用 replace_text_document。必须先调用 read_text_document，并将其完整、原样返回值作为 expected_content；若内容已变化则调用失败，应重新读取后再编辑。",
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
              description: "此前读取的 chapter 或 file 节点 ID。",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
        expected_content: {
          type: "string",
          description: "最近一次 read_text_document 返回的完整原文，不得摘要、省略或改写。",
        },
        new_content: {
          type: "string",
          description: "替换后的完整全文；不是补丁或局部片段。允许空字符串。",
        },
      },
      required: ["target", "expected_content", "new_content"],
      additionalProperties: false,
    },
  },
  replace_text_document: {
    description:
      "精确替换章节或资源文件中的一段文字，适合局部修订且无需回传完整全文。必须先读取当前正文；expected_text 必须在正文中恰好出现一次，否则失败且不修改。可用空 replacement_text 删除该段。多个互不依赖的替换应逐次调用。",
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
              description: "此前读取的 chapter 或 file 节点 ID。",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
        expected_text: {
          type: "string",
          description: "当前正文中恰好出现一次的非空原文片段；应包含足够上下文以保证唯一。",
        },
        replacement_text: {
          type: "string",
          description: "替换片段，允许空字符串。",
        },
      },
      required: ["target", "expected_text", "replacement_text"],
      additionalProperties: false,
    },
  },
  create_document: {
    description:
      "在现有文件夹下创建节点。先用 get_project_structure 获取 parent_id。manuscript 可创建 chapter/folder 并可指定 index；resource 可创建 file/folder，只有 file 可带初始 content。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
          description: "节点所属树。",
        },
        kind: {
          type: "string",
          enum: ["chapter", "file", "folder"],
          description:
            'manuscript 仅可用 "chapter" 或 "folder"；resource 仅可用 "file" 或 "folder"。',
        },
        parent_id: {
          type: "string",
          description:
            "对应树中现有 folder 的 ID；根级创建使用 get_project_structure 返回的对应 root_id。",
        },
        name: {
          type: "string",
          description: "新节点的标题或名称。",
        },
        index: {
          type: "integer",
          minimum: 0,
          description:
            "仅 manuscript 节点可用；在父节点 children 中的 0-based 插入位置，省略时追加。resource 节点不得传入。",
        },
        content: {
          type: "string",
          description:
            '仅 domain="resource" 且 kind="file" 时可用，表示初始全文；省略时创建空文件。其他组合不得传入。',
        },
      },
      required: ["domain", "kind", "parent_id", "name"],
      additionalProperties: false,
    },
  },
  move_document: {
    description:
      "将现有节点移动到现有文件夹下。先用 get_project_structure 获取 id 和 target_parent_id；不能移动根节点或移入自身后代。仅 manuscript 支持 index，resource 不得传 index。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
          description: "要移动的节点 ID。",
        },
        target_parent_id: {
          type: "string",
          description: "目标 folder 的节点 ID；移动到根级时使用对应树的 root_id。",
        },
        index: {
          type: "integer",
          description: "仅 manuscript 可用；目标 children 中的 0-based 插入位置，省略时追加。",
          minimum: 0,
        },
      },
      required: ["domain", "id", "target_parent_id"],
      additionalProperties: false,
    },
  },
  rename_document: {
    description:
      "重命名一个现有节点，不修改正文。先用 get_project_structure 获取节点 id；name 传新标题或新名称，而不是路径。",
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
      "永久删除一个现有节点，文件夹会递归删除后代。必须先用 get_project_structure 核对节点及其后代，再通过 ask_user 获得本次删除的明确同意；之后将结构中当前完整标题/名称原样作为 expected_name。",
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
          description:
            "最近一次 get_project_structure 返回的当前完整 title（手稿）或 name（资源）。",
        },
      },
      required: ["domain", "id", "expected_name"],
      additionalProperties: false,
    },
  },
  get_worktree_changes: {
    description:
      "列出当前工作区相对分支基线的未提交变更及统计。用于发现哪些节点有新增、编辑、重命名、移动或删除；不会返回完整文本差异。",
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
      "读取一个未提交文本变更的基线全文 original_content 与当前全文 current_content。先调用 get_worktree_changes，并仅对其中可预览的 chapter/file 文本变更使用 entity_id；结构变更不可读取正文差异。",
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
    description:
      "列出一个章节或资源文件的历史元数据，不返回历史正文。id 使用 get_project_structure 返回的节点 ID；需要正文时再用返回条目的 id 调用 read_history_version。",
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
          maximum: 200,
        },
      },
      required: ["domain", "id"],
      additionalProperties: false,
    },
  },
  read_history_version: {
    description:
      "读取一条历史记录保存的 content 和 before_content。entry_id 必须来自 list_document_history 返回的条目 id，不能传文档节点 id；无可用正文时字段为 null。",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "string",
          description: "list_document_history 返回的历史条目 id。",
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
