/**
 * Parent-session system prompt injection: list currently available subagents
 * so the model can pick a real `agent_id` instead of hard-coded examples.
 */

const WRITE_TOOL_NAMES = new Set([
  "write_document",
  "replace_document_text",
  "create_document",
  "create_folder",
  "move_node",
  "rename_node",
  "delete_node",
]);

export type SubagentCapability = "只读" | "可写";

export type SubagentCatalogEntry = {
  id: string;
  name: string;
  capability: SubagentCapability;
  /** Optional short blurb shown after the capability label. */
  description: string;
};

export type SubagentCatalogAgent = {
  id: string;
  name: string;
  availableToolNames: readonly string[];
  subagentEligible: boolean;
  description?: string;
};

/** Builtin specialist ids preferred at the top of the catalog. */
const BUILTIN_ORDER = ["builtin-consistency-reviewer", "builtin-chapter-writer"] as const;

const AVAILABLE_SECTION_HEADING = "## 可用子代理";

/**
 * Derive a coarse capability label from the agent's tool whitelist.
 * Any structural/content write tool → 可写; otherwise 只读.
 */
export function summarizeSubagentCapability(toolNames: readonly string[]): SubagentCapability {
  for (const name of toolNames) {
    if (WRITE_TOOL_NAMES.has(name)) {
      return "可写";
    }
  }
  return "只读";
}

function catalogSortKey(id: string, name: string): [number, string, string] {
  const builtinIndex = (BUILTIN_ORDER as readonly string[]).indexOf(id);
  const rank = builtinIndex >= 0 ? builtinIndex : BUILTIN_ORDER.length;
  return [rank, name, id];
}

/**
 * Filter and sort agents that may be targeted by `run_subagent`.
 * Optionally exclude the current session agent (avoids self-delegation noise).
 */
export function listSubagentCatalog(
  agents: readonly SubagentCatalogAgent[],
  options?: { excludeAgentId?: string },
): SubagentCatalogEntry[] {
  const excludeId = options?.excludeAgentId?.trim() ?? "";
  const entries: SubagentCatalogEntry[] = [];

  for (const agent of agents) {
    if (!agent.subagentEligible) {
      continue;
    }
    if (excludeId !== "" && agent.id === excludeId) {
      continue;
    }
    entries.push({
      id: agent.id,
      name: agent.name,
      capability: summarizeSubagentCapability(agent.availableToolNames),
      description: agent.description?.trim() ?? "",
    });
  }

  entries.sort((a, b) => {
    const [rankA, nameA, idA] = catalogSortKey(a.id, a.name);
    const [rankB, nameB, idB] = catalogSortKey(b.id, b.name);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const byName = nameA.localeCompare(nameB, "zh-CN");
    if (byName !== 0) {
      return byName;
    }
    return idA.localeCompare(idB);
  });

  return entries;
}

/** Format the dynamic `## 可用子代理` section for system instructions. */
export function formatAvailableSubagentsSection(entries: readonly SubagentCatalogEntry[]): string {
  if (entries.length === 0) {
    return [AVAILABLE_SECTION_HEADING, "- 当前没有可用子代理，不要调用 `run_subagent`。"].join(
      "\n",
    );
  }

  const lines = [
    AVAILABLE_SECTION_HEADING,
    "- 调用 `run_subagent` 时，`agent_id` 必须从下列列表选取，不要臆造 id。",
  ];
  for (const entry of entries) {
    const base = `\`${entry.id}\`（${entry.name}，${entry.capability}）`;
    lines.push(entry.description === "" ? `- ${base}` : `- ${base}— ${entry.description}`);
  }
  return lines.join("\n");
}

/**
 * Append (or leave untouched) the available-subagents section on a base system prompt.
 * Only injects when the parent agent actually has the `run_subagent` tool.
 */
export function composeSystemPromptWithSubagents(
  basePrompt: string,
  entries: readonly SubagentCatalogEntry[],
  options: { hasRunSubagentTool: boolean },
): string {
  if (!options.hasRunSubagentTool) {
    return basePrompt;
  }

  const section = formatAvailableSubagentsSection(entries);
  const trimmed = basePrompt.replace(/\s+$/, "");
  if (trimmed === "") {
    return section;
  }
  return `${trimmed}\n\n${section}`;
}
