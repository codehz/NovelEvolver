import type {
  AiChatAssistantPart,
  AiChatMessagePart,
  AiChatReasoningPart,
  AiChatToolCall,
} from "#shared/rpc/ai/index";

/** Tool names that never join a Work segment — rendered as elevated cards. */
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
  if (part.type === "reasoning") {
    return true;
  }
  return part.type === "tool_call" && !ELEVATED_TOOL_NAMES.has(part.name);
}

/**
 * Project flat assistant `parts` into ordered UI segments.
 *
 * - Continuous reasoning + ordinary tools → one `work` segment
 * - Prose (`message`) breaks work and becomes `prose`
 * - `run_subagent` / `ask_user` are elevated and never join work
 */
export function projectAssistantSegments(
  parts: readonly AiChatAssistantPart[],
): AssistantSegment[] {
  const segments: AssistantSegment[] = [];
  let workBuffer: AssistantWorkStep[] = [];

  function flushWork(): void {
    if (workBuffer.length === 0) {
      return;
    }
    const first = workBuffer[0]!;
    segments.push({
      kind: "work",
      id: `work:${first.id}`,
      steps: workBuffer,
    });
    workBuffer = [];
  }

  for (const part of parts) {
    if (part.type === "message") {
      flushWork();
      segments.push({
        kind: "prose",
        id: part.id,
        part,
      });
      continue;
    }

    if (part.type === "tool_call" && ELEVATED_TOOL_NAMES.has(part.name)) {
      flushWork();
      if (part.name === "run_subagent") {
        segments.push({
          kind: "subagent",
          id: part.id,
          part,
        });
      } else {
        segments.push({
          kind: "ask_user",
          id: part.id,
          part,
        });
      }
      continue;
    }

    if (isWorkStep(part)) {
      workBuffer.push(part);
    }
  }

  flushWork();
  return segments;
}

/** Step count for Work summaries: each reasoning + ordinary tool counts as 1. */
export function countWorkSteps(steps: readonly AssistantWorkStep[]): number {
  return steps.length;
}

export function isWorkSegmentLive(steps: readonly AssistantWorkStep[]): boolean {
  return steps.some((step) => {
    if (step.type === "reasoning") {
      return step.status === "streaming";
    }
    return (
      step.status === "pending" || step.status === "running" || step.status === "awaiting_user"
    );
  });
}

/**
 * Whether the Work collapsible should stay expanded (feeds useAutoCollapseExpand).
 *
 * - Any step live → expand
 * - Message still streaming and this work is the trailing segment → hold open
 *   (covers tool gaps where all steps finished but the model has not yet
 *   emitted the next tool / prose / elevated card)
 * - Otherwise → allow auto-collapse
 */
export function shouldKeepWorkExpanded(options: {
  isStepsLive: boolean;
  messageStreaming: boolean;
  isLastSegment: boolean;
}): boolean {
  return options.isStepsLive || (options.messageStreaming && options.isLastSegment);
}
