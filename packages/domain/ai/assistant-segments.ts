import type {
  AiChatAssistantPart,
  AiChatMessagePart,
  AiChatReasoningPart,
  AiChatToolCall,
} from "./chat";

export const ELEVATED_TOOL_NAMES = new Set(["run_subagent", "ask_user"]);

export type AssistantWorkStep = AiChatReasoningPart | AiChatToolCall;

export type AssistantProseSegment = {
  kind: "prose";
  id: string;
  part: AiChatMessagePart;
};

export type AssistantWorkSegment = {
  kind: "work";
  id: string;
  steps: AssistantWorkStep[];
};

export type AssistantSubagentSegment = {
  kind: "subagent";
  id: string;
  part: AiChatToolCall;
};

export type AssistantAskUserSegment = {
  kind: "ask_user";
  id: string;
  part: AiChatToolCall;
};

export type AssistantSegment =
  | AssistantProseSegment
  | AssistantWorkSegment
  | AssistantSubagentSegment
  | AssistantAskUserSegment;

export function isElevatedToolCall(part: AiChatAssistantPart): part is AiChatToolCall {
  return part.type === "tool_call" && ELEVATED_TOOL_NAMES.has(part.name);
}

function isWorkStep(part: AiChatAssistantPart): part is AssistantWorkStep {
  return part.type === "reasoning" || (part.type === "tool_call" && !isElevatedToolCall(part));
}

export function projectAssistantSegments(
  parts: readonly AiChatAssistantPart[],
): AssistantSegment[] {
  const segments: AssistantSegment[] = [];
  let workBuffer: AssistantWorkStep[] = [];

  function flushWork(): void {
    if (workBuffer.length === 0) return;
    segments.push({ kind: "work", id: `work:${workBuffer[0]!.id}`, steps: workBuffer });
    workBuffer = [];
  }

  for (const part of parts) {
    if (part.type === "message") {
      flushWork();
      segments.push({ kind: "prose", id: part.id, part });
    } else if (isElevatedToolCall(part)) {
      flushWork();
      segments.push({
        kind: part.name === "run_subagent" ? "subagent" : "ask_user",
        id: part.id,
        part,
      });
    } else if (isWorkStep(part)) {
      workBuffer.push(part);
    }
  }
  flushWork();
  return segments;
}

export function countWorkSteps(steps: readonly AssistantWorkStep[]): number {
  return steps.length;
}

export function isWorkSegmentLive(steps: readonly AssistantWorkStep[]): boolean {
  return steps.some((step) =>
    step.type === "reasoning"
      ? step.status === "streaming"
      : step.status === "pending" || step.status === "running" || step.status === "awaiting_user",
  );
}

export function shouldKeepWorkExpanded(options: {
  isStepsLive: boolean;
  messageStreaming: boolean;
  isLastSegment: boolean;
}): boolean {
  return options.isStepsLive || (options.messageStreaming && options.isLastSegment);
}
