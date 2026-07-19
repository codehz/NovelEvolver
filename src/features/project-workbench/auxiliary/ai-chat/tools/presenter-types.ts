import type { ReactNode } from "react";

import type { AiChatToolCall } from "#shared/rpc/ai/index";

export type JsonObject = Record<string, unknown>;

export type ToolPresentation = {
  /** Codicon utility class, e.g. `icon-[codicon--search]`. Filled by presentToolCall if omitted. */
  icon?: string;
  /** Short product action, e.g. 读取 / 搜索. */
  label: string;
  /** Target / subject, e.g. path or query. */
  summary: string;
  /** Result chip on the trailing edge; omit when summary already carries the outcome. */
  indicator?: string;
  /** Expand body; `null` means the shell should not render a collapsible. */
  detail: ReactNode | null;
};

export type ToolPresenter = (toolCall: AiChatToolCall) => ToolPresentation;

export type TechnicalField = {
  label: string;
  value: string;
};
