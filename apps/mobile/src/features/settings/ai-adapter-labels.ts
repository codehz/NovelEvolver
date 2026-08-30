import type { AiAdapterKind } from "@novelevolver/domain/settings/ai-settings";
import { AI_ADAPTER_KINDS } from "@novelevolver/domain/settings/ai-settings";

export const AI_ADAPTER_OPTIONS: readonly {
  value: AiAdapterKind;
  label: string;
}[] = [
  { value: "responses", label: "OpenAI Responses" },
  { value: "chat-completions", label: "Chat Completions" },
  { value: "delta-completions", label: "Delta Completions" },
  { value: "messages", label: "Anthropic Messages" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Google Gemini" },
];

export { AI_ADAPTER_KINDS };
