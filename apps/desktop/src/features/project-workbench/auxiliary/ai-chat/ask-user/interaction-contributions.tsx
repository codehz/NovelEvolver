import type { ComponentType } from "react";

import type { AiChatOpenInteraction, AskUserOpenInteraction } from "#shared/rpc/ai/index";

import { AskUserComposer } from "./AskUserComposer";

export type InteractionBodyProps<TInput extends AiChatOpenInteraction> = {
  input: TInput;
  disabled: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onRequestCommit?: () => void;
};

const interactionBodyContributions: {
  [Kind in AiChatOpenInteraction["kind"]]: ComponentType<
    InteractionBodyProps<Extract<AiChatOpenInteraction, { kind: Kind }>>
  >;
} = {
  ask_user: AskUserComposer as ComponentType<InteractionBodyProps<AskUserOpenInteraction>>,
};

/** 按 kind 渲染交互题干/草稿区；提交栏在 shell 统一，不绑死 ask_user。 */
export function InteractionBody(props: InteractionBodyProps<AiChatOpenInteraction>) {
  const Body = interactionBodyContributions[props.input.kind] as ComponentType<
    InteractionBodyProps<AiChatOpenInteraction>
  >;
  return <Body {...props} />;
}

export function isInteractionDraftReady(input: AiChatOpenInteraction, draft: string): boolean {
  switch (input.kind) {
    case "ask_user":
      return draft.trim() !== "";
  }
}

export function summarizeInteraction(input: AiChatOpenInteraction, fallbackIndex: number): string {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    return `问题 ${fallbackIndex + 1}`;
  }
  return prompt.length > 24 ? `${prompt.slice(0, 24)}…` : prompt;
}
