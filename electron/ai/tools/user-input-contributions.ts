import type { ToolCallItem } from "@codehz/ai";

import type {
  AiChatPendingUserInput,
  AskUserRequestHandle,
  UserInputRequestHandle,
} from "#shared/rpc/ai/index";

import {
  AskUserRequestHandleImpl,
  parseAskUserArgs,
  toAskUserPendingInput,
  type AskUserArgs,
} from "./ask-user";
import type { UserInputRequest, UserInputResolver } from "./user-input-types";

export type PendingUserInputSerializable = {
  toolName: string;
  args: unknown;
};

type UserInputContribution = {
  createFromSerializable(
    callId: string,
    serializable: PendingUserInputSerializable,
    resolver: UserInputResolver,
  ): AiChatPendingUserInput;
  createFromRequest(
    request: UserInputRequest,
    handle: UserInputRequestHandle,
  ): AiChatPendingUserInput;
};

const contributions: Record<string, UserInputContribution> = {
  ask_user: {
    createFromSerializable(callId, serializable, resolver) {
      const call: ToolCallItem = {
        type: "tool_call",
        id: callId,
        name: "ask_user",
        argumentsText: JSON.stringify(serializable.args),
        argumentsJson: serializable.args,
      };
      return toAskUserPendingInput(
        parseAskUserArgs(call),
        new AskUserRequestHandleImpl(call, resolver),
      );
    },
    createFromRequest(request, handle) {
      return toAskUserPendingInput(
        request.serializable.args as AskUserArgs,
        handle as AskUserRequestHandle,
      );
    },
  },
};

function getContribution(toolName: string): UserInputContribution {
  const contribution = contributions[toolName];
  if (!contribution) {
    throw new Error(`未知的用户输入工具贡献: ${toolName}`);
  }
  return contribution;
}

export function createPendingViewFromSerializable(
  callId: string,
  serializable: PendingUserInputSerializable,
  resolver: UserInputResolver,
): AiChatPendingUserInput {
  return getContribution(serializable.toolName).createFromSerializable(
    callId,
    serializable,
    resolver,
  );
}

export function createPendingViewFromRequest(
  request: UserInputRequest,
  handle: UserInputRequestHandle,
): AiChatPendingUserInput {
  return getContribution(request.toolName).createFromRequest(request, handle);
}
