import type { InputItem, ToolCallItem, ToolResultItem } from "@codehz/ai";

import type { AiChatPendingUserInput, AskUserRequestHandle } from "#shared/rpc/ai-rpc";

import {
  AskUserRequestHandleImpl,
  parseAskUserArgs,
  toAskUserPendingInput,
  type AskUserArgs,
} from "../tools/ask-user";
import type { UserInputRequest, UserInputResolver } from "../tools/user-input-types";

type PendingUserInputSerializable = {
  toolName: string;
  args: unknown;
};

export type PendingUserInput = {
  callId: string;
  pending: AiChatPendingUserInput;
  resolverPromise: Promise<ToolResultItem>;
  resolve: (result: ToolResultItem) => void;
  serializable: PendingUserInputSerializable;
};

export type PendingToolBatch = {
  assistantMessageId: string;
  calls: ToolCallItem[];
  input: InputItem[];
  transcript: InputItem[];
  resolvedResultsByCallId: Map<string, ToolResultItem>;
  pendingInputs: PendingUserInput[];
};

type SerializedPendingToolBatch = {
  assistantMessageId: string;
  calls: ToolCallItem[];
  input: InputItem[];
  transcript: InputItem[];
  resolvedResultsByCallId: [string, ToolResultItem][];
  pendingInputs: {
    callId: string;
    serializable: PendingUserInputSerializable;
  }[];
};

function createResolver(): Pick<PendingUserInput, "resolverPromise" | "resolve"> {
  let resolve!: (result: ToolResultItem) => void;
  const resolverPromise = new Promise<ToolResultItem>((res) => {
    resolve = res;
  });
  return { resolverPromise, resolve };
}

function createPendingViewFromSerializable(
  callId: string,
  serializable: PendingUserInputSerializable,
  resolver: UserInputResolver,
): AiChatPendingUserInput {
  if (serializable.toolName === "ask_user") {
    const call = {
      type: "tool_call" as const,
      id: callId,
      name: "ask_user",
      argumentsText: JSON.stringify(serializable.args),
      argumentsJson: serializable.args,
    };
    const args = parseAskUserArgs(call);
    const handle = new AskUserRequestHandleImpl(call, resolver);
    return toAskUserPendingInput(args, handle);
  }

  throw new Error(`无法重建未知工具的用户输入 handle: ${serializable.toolName}`);
}

export function createPendingUserInputFromSerializable(
  callId: string,
  serializable: PendingUserInputSerializable,
): PendingUserInput {
  const resolver = createResolver();
  return {
    callId,
    pending: createPendingViewFromSerializable(callId, serializable, {
      resolve: resolver.resolve,
    }),
    resolverPromise: resolver.resolverPromise,
    resolve: resolver.resolve,
    serializable,
  };
}

export function createPendingUserInputFromRequest(
  call: ToolCallItem,
  request: UserInputRequest,
): PendingUserInput {
  const resolver = createResolver();
  const handle = request.createHandle({ resolve: resolver.resolve });

  if (request.serializable.toolName === "ask_user") {
    return {
      callId: call.id,
      pending: toAskUserPendingInput(
        request.serializable.args as AskUserArgs,
        handle as AskUserRequestHandle,
      ),
      resolverPromise: resolver.resolverPromise,
      resolve: resolver.resolve,
      serializable: request.serializable,
    };
  }

  throw new Error(`未知工具的用户输入请求: ${request.serializable.toolName}`);
}

export function parsePendingToolBatch(json: string | null): PendingToolBatch | null {
  if (json === null || json === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(json) as SerializedPendingToolBatch;
    return {
      assistantMessageId: parsed.assistantMessageId,
      calls: parsed.calls,
      input: parsed.input,
      transcript: parsed.transcript,
      resolvedResultsByCallId: new Map(parsed.resolvedResultsByCallId),
      pendingInputs: parsed.pendingInputs.map((entry) =>
        createPendingUserInputFromSerializable(entry.callId, entry.serializable),
      ),
    };
  } catch {
    return null;
  }
}

export function serializePendingToolBatch(batch: PendingToolBatch | null): string | null {
  if (batch === null) {
    return null;
  }

  const payload: SerializedPendingToolBatch = {
    assistantMessageId: batch.assistantMessageId,
    calls: batch.calls,
    input: batch.input,
    transcript: batch.transcript,
    resolvedResultsByCallId: [...batch.resolvedResultsByCallId.entries()],
    pendingInputs: batch.pendingInputs.map((input) => ({
      callId: input.callId,
      serializable: input.serializable,
    })),
  };
  return JSON.stringify(payload);
}
