/**
 * UI-only projection of a tool call. Produced by the AI runtime tool runner /
 * subagent executor — never forwarded to the model as tool output.
 *
 * Collapsed activity row reads verb + subject + outcome; expand body is
 * kind-specific. Full document content must not appear here.
 */

export type AiToolViewFocus = {
  domain: "manuscript" | "resource";
  id: string;
  label?: string | null;
  displayPath?: string | null;
};

export type AiSubagentViewStep = {
  id: string;
  name: string;
  status: "running" | "complete" | "error";
  /** Human-readable target (path, query, node name). */
  subject: string | null;
  /** Human-readable outcome chip ("12 命中", "+120 字", "失败"). */
  outcome: string | null;
  errorMessage?: string | null;
};

export type AiSubagentToolView = {
  kind: "subagent";
  agentId: string;
  agentName: string;
  task: string;
  constraints: string | null;
  focus: AiToolViewFocus[];
  phase: "starting" | "thinking" | "tool" | "finalizing" | "done";
  round: number;
  maxRounds: number;
  /** Full execution timeline — grows live and is retained after completion. */
  steps: AiSubagentViewStep[];
  /** Optional prose report; not a success gate. */
  report: string | null;
  runStatus: "completed" | "failed" | "aborted" | "needs_user" | null;
  artifacts: {
    wrote: boolean;
    touched: Array<{
      id: string;
      domain?: "manuscript" | "resource" | null;
      label?: string | null;
      displayPath?: string | null;
    }>;
  };
};

export type AiSearchToolView = {
  kind: "search";
  query: string;
  isRegex: boolean;
  scopeLabel: string;
  hits: Array<{
    path: string;
    line: number | null;
    snippet: string | null;
  }>;
  hitCount: number;
};

export type AiReadToolView = {
  kind: "read";
  domainLabel: string;
  documentName: string;
  scale: string | null;
};

export type AiStructureToolView = {
  kind: "structure";
  scopeLabel: string;
  nodeCount: number;
  textNodeCount: number | null;
  textCharTotal: number | null;
  collapsedCount: number | null;
};

export type AiWriteToolView = {
  kind: "write";
  domainLabel: string;
  documentName: string;
  mode: "rewrite" | "replace" | "create" | "delete-span";
  previousScale: string | null;
  nextScale: string | null;
  delta: string | null;
  previews: Array<{ label: string; text: string }> | null;
};

export type AiMutationToolView = {
  kind: "mutation";
  actionLabel: string;
  domainLabel: string;
  display: string;
  previousDisplay: string | null;
};

export type AiChangesToolView = {
  kind: "changes";
  scopeLabel: string;
  paths: string[];
  count: number;
};

export type AiChangeToolView = {
  kind: "change";
  domainLabel: string;
  documentName: string;
  originalScale: string | null;
  currentScale: string | null;
};

export type AiHistoryToolView = {
  kind: "history";
  domainLabel: string;
  documentName: string;
  entryCount: number;
};

export type AiHistoryEntryToolView = {
  kind: "history_entry";
  domainLabel: string;
  documentName: string;
  contentScale: string | null;
  beforeScale: string | null;
};

export type AiAskUserToolView = {
  kind: "ask_user";
  question: string;
  context: string | null;
  choices: Array<{ title: string; description?: string }> | null;
  answer: string | null;
};

export type AiGenericToolView = {
  kind: "generic";
  label: string;
  subject: string;
  outcome: string | null;
  detailLines: string[] | null;
};

export type AiToolView =
  | AiSubagentToolView
  | AiSearchToolView
  | AiReadToolView
  | AiStructureToolView
  | AiWriteToolView
  | AiMutationToolView
  | AiChangesToolView
  | AiChangeToolView
  | AiHistoryToolView
  | AiHistoryEntryToolView
  | AiAskUserToolView
  | AiGenericToolView;

/** Deep clone for snapshot/event isolation. */
export function cloneAiToolView(view: AiToolView): AiToolView {
  return structuredClone(view);
}
