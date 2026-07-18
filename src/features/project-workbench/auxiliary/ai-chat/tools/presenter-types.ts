import type { ReactNode } from "react";

import type { AiChatToolCall } from "#shared/rpc/ai/index";

export type JsonObject = Record<string, unknown>;

export type ToolPresentation = {
  label: string;
  summary: string;
  indicator?: string;
  detail: ReactNode;
};

export type ToolPresenter = (toolCall: AiChatToolCall) => ToolPresentation;
