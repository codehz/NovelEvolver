import type { ProjectAiChatController } from "@novelevolver/ai-runtime";
import type { AiChatEvent } from "@novelevolver/domain/ai";

import { nativeAiExecution } from "../../../native/NativeAiExecution";

function eventPending(event: AiChatEvent): boolean | null {
  if (event.kind === "snapshot") {
    return event.snapshot.pending;
  }
  for (const operation of event.ops) {
    if (operation.type === "state.updated" && operation.patch.pending !== undefined) {
      return operation.patch.pending;
    }
  }
  return null;
}

function setNativeExecution(active: boolean): void {
  try {
    if (active) {
      nativeAiExecution?.start();
    } else {
      nativeAiExecution?.stop();
    }
  } catch {
    // Background execution is best effort and must not interrupt an AI request.
  }
}

export function trackAiExecution(chat: ProjectAiChatController): () => void {
  let active = chat.getSnapshot().pending;
  if (active) setNativeExecution(true);

  const removeListener = chat.addEventListener((event) => {
    const pending = eventPending(event);
    if (pending === null || pending === active) return;
    active = pending;
    setNativeExecution(active);
  });

  return () => {
    removeListener();
    if (!active) return;
    active = false;
    setNativeExecution(false);
  };
}
