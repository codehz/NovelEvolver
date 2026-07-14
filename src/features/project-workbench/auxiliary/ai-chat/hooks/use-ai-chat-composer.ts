import { useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";

import type { ComposerEditorHandle } from "../composer/ComposerEditor";
import { useAiChatState } from "../state/use-ai-chat-state";

export function useAiChatComposer() {
  const { snapshot, loading, sendMessage, stopGeneration } = useAiChatState();
  const composerRef = useRef<ComposerEditorHandle | null>(null);
  const shouldRestoreComposerFocusRef = useRef(false);
  const [canSend, setCanSend] = useState(false);

  const hasPendingUserInputs = snapshot.pendingUserInputs.length > 0;
  const composerDisabled = loading || snapshot.pending;
  const canStop = !loading && snapshot.pending;

  const syncCanSend = useCallback(() => {
    const empty = composerRef.current?.isEmpty() ?? true;
    setCanSend(!empty && !composerDisabled);
  }, [composerDisabled]);

  useEffect(() => {
    syncCanSend();
  }, [syncCanSend]);

  useEffect(() => {
    if (composerDisabled || hasPendingUserInputs || !shouldRestoreComposerFocusRef.current) {
      return;
    }

    composerRef.current?.focus();
    shouldRestoreComposerFocusRef.current = false;
  }, [composerDisabled, hasPendingUserInputs]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const payload = composerRef.current?.getSendPayload() ?? {
      text: "",
      slash: null,
      mentions: [],
    };
    const submitted = await sendMessage(payload);
    if (submitted) {
      shouldRestoreComposerFocusRef.current = true;
      composerRef.current?.clear();
      setCanSend(false);
    }
  }, [sendMessage]);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (canStop) {
        return;
      }
      void submitDraft();
    },
    [canStop, submitDraft],
  );

  const handleSendClick = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  const handleStopClick = useCallback(() => {
    void stopGeneration();
  }, [stopGeneration]);

  /** Enter-to-send from the CodeMirror keymap (slash menu already filtered). */
  const handleComposerSubmitKey = useCallback((): boolean => {
    if (canStop || composerDisabled) {
      return true;
    }
    void submitDraft();
    return true;
  }, [canStop, composerDisabled, submitDraft]);

  const clearDraft = useCallback(() => {
    composerRef.current?.clear();
    setCanSend(false);
  }, []);

  return {
    composerRef,
    composerDisabled,
    hasPendingUserInputs,
    canSend,
    canStop,
    handleSubmit,
    handleSendClick,
    handleStopClick,
    handleComposerSubmitKey,
    handleDocChange: syncCanSend,
    clearDraft,
  };
}

export type AiChatComposerState = ReturnType<typeof useAiChatComposer>;
