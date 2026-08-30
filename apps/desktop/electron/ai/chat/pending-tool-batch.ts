import type { InputItem, ToolCallItem, ToolResultItem } from "@codehz/ai";

import type {
  AiChatInteractionAnswer,
  AiChatMessageUsage,
  AiChatOpenInteraction,
} from "#domain/ai";

import {
  createOpenInteractionFromSerializable,
  resolveUserInputAnswer,
  resolveUserInputCancel,
  type PendingUserInputSerializable,
  type UserInputRequest,
} from "../tools";

export type PendingUserInput = {
  /** 稳定 id（= tool call id），供 DTO / 命令回传。 */
  id: string;
  view: AiChatOpenInteraction;
  resolverPromise: Promise<ToolResultItem>;
  resolve: (result: ToolResultItem) => void;
  serializable: PendingUserInputSerializable;
  settled: boolean;
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
    id?: string;
    callId?: string;
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

export function listOpenInteractions(batch: PendingToolBatch | null): AiChatOpenInteraction[] {
  if (batch === null) {
    return [];
  }
  return batch.pendingInputs.filter((entry) => !entry.settled).map((entry) => entry.view);
}

export function createPendingUserInputFromSerializable(
  id: string,
  serializable: PendingUserInputSerializable,
): PendingUserInput {
  const resolver = createResolver();
  return {
    id,
    view: createOpenInteractionFromSerializable(id, serializable),
    resolverPromise: resolver.resolverPromise,
    resolve: resolver.resolve,
    serializable,
    settled: false,
  };
}

export function createPendingUserInputFromRequest(
  call: ToolCallItem,
  request: UserInputRequest,
): PendingUserInput {
  const resolver = createResolver();
  return {
    id: call.id,
    view: createOpenInteractionFromSerializable(call.id, request.serializable),
    resolverPromise: resolver.resolverPromise,
    resolve: resolver.resolve,
    serializable: request.serializable,
    settled: false,
  };
}

/** 幂等 settle：已 settle / 未知 id / kind 不匹配时返回 null。 */
export function settlePendingUserInputAnswer(
  batch: PendingToolBatch,
  id: string,
  answer: AiChatInteractionAnswer,
): ToolResultItem | null {
  const entry = batch.pendingInputs.find((item) => item.id === id);
  if (!entry || entry.settled) {
    return null;
  }
  const result = resolveUserInputAnswer(entry.serializable.toolName, id, answer);
  if (result === null) {
    return null;
  }
  entry.settled = true;
  entry.resolve(result);
  return result;
}

/** 幂等 cancel。 */
export function settlePendingUserInputCancel(
  batch: PendingToolBatch,
  id: string,
): ToolResultItem | null {
  const entry = batch.pendingInputs.find((item) => item.id === id);
  if (!entry || entry.settled) {
    return null;
  }
  const result = resolveUserInputCancel(entry.serializable.toolName, id);
  entry.settled = true;
  entry.resolve(result);
  return result;
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
      pendingInputs: parsed.pendingInputs.map((entry) => {
        // Legacy rows used `callId`; prefer `id`.
        const id =
          typeof entry.id === "string" && entry.id !== "" ? entry.id : (entry.callId ?? "");
        return createPendingUserInputFromSerializable(id, entry.serializable);
      }),
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
      id: input.id,
      serializable: input.serializable,
    })),
    usage: batch.usage,
  };
  return JSON.stringify(payload);
}
