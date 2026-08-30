import type { AIClient, ReasoningLevel } from "@codehz/ai";

import type { AiChatSelectableModelKind } from "#domain/ai";

export type AiBackendSession = {
  adapterKind: AiChatSelectableModelKind;
  model: string;
  instructions: string;
  client: AIClient;
  scenarioId: string | null;
  /** Omitted for mock backends (no provider limit). */
  maxOutputTokens?: number;
  /**
   * Default reasoning effort from model config.
   * Omitted when unset / mock (request does not send reasoningLevel).
   */
  defaultReasoningLevel?: ReasoningLevel;
};
