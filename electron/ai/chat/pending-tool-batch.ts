import type { InputItem, ToolCallItem, ToolResultItem } from "@codehz/ai";

import type { AiChatMessageUsage, AiChatPendingUserInput } from "#shared/rpc/ai/index";

import {
  createPendingViewFromRequest,
  createPendingViewFromSerializable,
  type PendingUserInputSerializable,
  type UserInputRequest,
} from "../tools";

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
  usage: AiChatMessageUsage | null;
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
  usage?: AiChatMessageUsage | null;
};

function createResolver(): Pick<PendingUserInput, "resolverPromise" | "resolve"> {
  let resolve!: (result: ToolResultItem) => void;
  const resolverPromise = new Promise<ToolResultItem>((res) => {
    resolve = res;
  });
  return { resolverPromise, resolve };
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
  return {
    callId: call.id,
    pending: createPendingViewFromRequest(request, handle),
    resolverPromise: resolver.resolverPromise,
    resolve: resolver.resolve,
    serializable: request.serializable,
  };
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
      usage: parsed.usage ?? null,
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
    usage: batch.usage,
  };
  return JSON.stringify(payload);
}
