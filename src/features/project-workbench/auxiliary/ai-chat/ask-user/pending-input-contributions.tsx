import type { ComponentType } from "react";

import type { AiChatPendingUserInput, AskUserPendingInput } from "#shared/rpc/ai/index";

import { AskUserComposer } from "./AskUserComposer";

export type PendingInputComposerProps<TInput extends AiChatPendingUserInput> = {
  input: TInput;
  loading: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmitted: () => void;
};

const pendingInputContributions: {
  [Kind in AiChatPendingUserInput["kind"]]: ComponentType<
    PendingInputComposerProps<Extract<AiChatPendingUserInput, { kind: Kind }>>
  >;
} = {
  ask_user: AskUserComposer as ComponentType<PendingInputComposerProps<AskUserPendingInput>>,
};

export function PendingInputComposer(props: PendingInputComposerProps<AiChatPendingUserInput>) {
  const Composer = pendingInputContributions[props.input.kind] as ComponentType<
    PendingInputComposerProps<AiChatPendingUserInput>
  >;
  return <Composer {...props} />;
}
