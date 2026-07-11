import type { AIClient } from "@codehz/ai";

import type { AiChatSelectableModelKind } from "#shared/rpc/ai/index";

export type AiBackendSession = {
  adapterKind: AiChatSelectableModelKind;
  model: string;
  instructions: string;
  client: AIClient;
  scenarioId: string | null;
  /** Omitted for mock backends (no provider limit). */
  maxOutputTokens?: number;
};
