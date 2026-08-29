import type { AiAdapterKind } from "#shared/rpc/services/index";
import { AI_ADAPTER_KINDS } from "#shared/rpc/services/index";

export const AI_ADAPTER_OPTIONS: readonly {
  value: AiAdapterKind;
  label: string;
  endpointPlaceholder: string;
}[] = [
  {
    value: "responses",
    label: "OpenAI Responses",
    endpointPlaceholder: "https://api.openai.com/v1",
  },
  {
    value: "chat-completions",
    label: "Chat Completions",
    endpointPlaceholder: "https://api.openai.com/v1",
  },
  {
    value: "messages",
    label: "Anthropic Messages",
    endpointPlaceholder: "https://api.anthropic.com/v1",
  },
  {
    value: "ollama",
    label: "Ollama",
    endpointPlaceholder: "http://localhost:11434",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    endpointPlaceholder: "https://generativelanguage.googleapis.com/v1beta",
  },
] as const;

const LABEL_BY_KIND = Object.fromEntries(
  AI_ADAPTER_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AiAdapterKind, string>;

const ENDPOINT_BY_KIND = Object.fromEntries(
  AI_ADAPTER_OPTIONS.map((option) => [option.value, option.endpointPlaceholder]),
) as Record<AiAdapterKind, string>;

export function aiAdapterLabel(kind: AiAdapterKind): string {
  return LABEL_BY_KIND[kind] ?? kind;
}

export function aiAdapterEndpointPlaceholder(kind: AiAdapterKind): string {
  return ENDPOINT_BY_KIND[kind] ?? "";
}

export { AI_ADAPTER_KINDS };
