import type { AiAgentTool } from "./ai-settings";

/**
 * Settings-facing tool catalog (name + description).
 * Implementations live in `@novelevolver/ai-runtime` (`src/tools`).
 * Spec names must stay aligned with this list.
 */
export const AI_SETTINGS_TOOL_NAMES = [
  "ask_user",
  "run_subagent",
  "read_structure",
  "read_document",
  "search_documents",
  "write_document",
  "replace_document_text",
  "create_folder",
  "create_document",
  "move_node",
  "rename_node",
  "delete_node",
  "read_changes",
  "read_change",
  "read_history",
  "read_history_entry",
] as const;

export type AiSettingsToolName = (typeof AI_SETTINGS_TOOL_NAMES)[number];

export const AI_SETTINGS_READ_TOOL_NAMES = [
  "read_structure",
  "read_document",
  "search_documents",
  "read_changes",
  "read_change",
  "read_history",
  "read_history_entry",
] as const satisfies readonly AiSettingsToolName[];

export const AI_SETTINGS_CHAPTER_WRITER_TOOL_NAMES = [
  ...AI_SETTINGS_READ_TOOL_NAMES,
  "write_document",
  "replace_document_text",
  "create_document",
  "create_folder",
] as const satisfies readonly AiSettingsToolName[];

export function isAiSettingsToolName(value: unknown): value is AiSettingsToolName {
  return typeof value === "string" && (AI_SETTINGS_TOOL_NAMES as readonly string[]).includes(value);
}

export const AI_TOOL_CATALOG: readonly AiAgentTool[] = [
  {
    name: "ask_user",
    description:
      "仅当继续执行所必需的信息缺失或需要用户确认时调用。一次只问一个明确问题；choices 仅作快捷建议，用户仍可自由输入。调用后等待回答，不要假设答案。",
  },
  {
    name: "run_subagent",
    description:
      "将一个独立子任务委派给指定专家 Agent（隔离上下文，不继承本会话完整历史）。适用于一致性审查、章节续写、设定检索等可拆分工作。子代理按自身工具白名单运行（不会再嵌套委派，也不能 ask_user）；完成后返回 report（可空）、steps_digest（执行要点）、artifacts 与（可选）output。需要用户澄清时先自行 ask_user，再委派。focus 只需节点 id：服务端会自动预载 chapter/file 正文（含 revision）或 folder 子节点摘要注入子代理，无需粘贴正文。纯文本/只读子代理产出长正文时，可设 output_target 让执行器自动落盘已有 chapter/file，父代理仅收到 output（节点 id 与 stats）而非全文 report。",
  },
  {
    name: "read_structure",
    description:
      "按固定预算获取项目结构摘要，不返回正文。首次无参数调用可同时浏览手稿和资源；结果会优先完整返回根的直接子级，并在预算内自动展开较小目录。目录 expanded=false 表示其子级未包含，可将该目录作为 target 继续读取。chapter/file 节点带 char_count（字符数），便于评估体量。",
  },
  {
    name: "read_document",
    description:
      "读取一个可编辑文本节点的当前全文与该文档 content revision。manuscript 仅支持 chapter，resource 仅支持 file；id 必须使用 read_structure 摘要或逐层展开返回的节点 ID。写回 write_document 时必须把返回的 revision 作为 expected_revision（按文档独立，写其他文档不会使其失效）。结果含 stats（char_count / line_count / word_count）。",
  },
  {
    name: "search_documents",
    description:
      "搜索章节和资源文件正文，用于定位内容所在节点；默认字面匹配，可开启 is_regex 使用 ECMAScript 正则。返回命中节点 ID、路径、1-based 行列号和片段。需要浏览目录结构时改用 read_structure。",
  },
  {
    name: "write_document",
    description:
      "将一个章节或资源文件的全文替换为 new_content。仅在大范围重写时使用；局部修改优先用 replace_document_text。必须先调用 read_document（或使用 focus 预载），并将**该文档**返回的 revision 作为 expected_revision；revision 按文档独立，写其他文档不会使其失效。若该文档正文已被他人/用户修改则失败，应重新读取后再写。成功时返回 stats / previous_stats / delta 与更新后的文档 revision。",
  },
  {
    name: "replace_document_text",
    description:
      "精确替换章节或资源文件中的一段文字，适合局部修订且无需回传完整全文。必须先读取当前正文；expected_text 必须在正文中恰好出现一次，否则失败且不修改。可用空 replacement_text 删除该段。多个互不依赖的替换应逐次调用。成功时返回 stats / previous_stats / delta 与更新后的该文档 content revision。",
  },
  {
    name: "create_folder",
    description:
      "在现有文件夹下创建文件夹。先用 read_structure 摘要或按 target 展开获取 parent_id；manuscript 可指定 index，resource 不得传 index。成功时返回新节点信息。",
  },
  {
    name: "create_document",
    description:
      "在现有文件夹下创建带完整初始正文的文本节点。先用 read_structure 摘要或按 target 展开获取 parent_id；manuscript 创建 chapter 且可指定 index，resource 创建 file 且不得传 index。content 必须提供，本次调用应直接写入最终正文，不要先创建空节点再读取或编辑。成功时返回新节点信息、stats / previous_stats / delta 与该文档 content revision。",
  },
  {
    name: "move_node",
    description:
      "将现有节点在同一 domain 内移动到现有文件夹下。domain 固定了树边界：manuscript 与 resource 互不相通，不能把 manuscript 节点移入 resource（或反向）。先用 read_structure 摘要或按 target 展开获取同域的 id 与 target_parent_id；不能移动根节点或移入自身后代。仅 manuscript 支持 index，resource 不得传 index。成功时返回移动后路径信息。",
  },
  {
    name: "rename_node",
    description:
      "重命名一个现有节点，不修改正文。先用 read_structure 获取节点 id；name 传新标题或新名称，而不是路径。成功时返回重命名后的路径信息。",
  },
  {
    name: "delete_node",
    description:
      "永久删除一个现有节点，文件夹会递归删除后代。先用 read_structure 获取并核对节点 id 及其后代后再删除。成功时返回被删节点信息。",
  },
  {
    name: "read_changes",
    description:
      "列出当前工作区相对分支基线的未提交变更及统计。用于发现哪些节点有新增、编辑、重命名、移动或删除；不会返回完整文本差异。",
  },
  {
    name: "read_change",
    description:
      "读取一个未提交文本变更的基线全文 original_content 与当前全文 current_content。先调用 read_changes，并仅对其中可预览的 chapter/file 文本变更使用 entity_id；结构变更不可读取正文差异。结果含 original_stats 与 current_stats。",
  },
  {
    name: "read_history",
    description:
      "列出一个章节或资源文件的历史元数据，不返回历史正文。id 使用 read_structure 返回的节点 ID；需要正文时再用返回条目的 id 调用 read_history_entry。",
  },
  {
    name: "read_history_entry",
    description:
      "读取一条历史记录保存的 content 和 before_content。entry_id 必须来自 read_history 返回的条目 id，不能传文档节点 id；无可用正文时字段为 null。结果含 content_stats / before_content_stats（正文为 null 时 stats 也为 null）。",
  },
];
