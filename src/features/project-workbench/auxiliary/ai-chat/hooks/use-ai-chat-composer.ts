import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";

import { useAiChatState } from "../state/use-ai-chat-state";

export function useAiChatComposer() {
  const { snapshot, loading, sendMessage } = useAiChatState();
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRestoreComposerFocusRef = useRef(false);

  const hasPendingUserInputs = snapshot.pendingUserInputs.length > 0;
  const composerDisabled = loading || snapshot.pending;

  useEffect(() => {
    if (composerDisabled || hasPendingUserInputs || !shouldRestoreComposerFocusRef.current) {
      return;
    }

    composerRef.current?.focus();
    shouldRestoreComposerFocusRef.current = false;
  }, [composerDisabled, hasPendingUserInputs]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const submitted = await sendMessage(draft);
    if (submitted) {
      shouldRestoreComposerFocusRef.current = true;
      setDraft("");
    }
  }, [draft, sendMessage]);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleSendClick = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const clearDraft = useCallback(() => {
    setDraft("");
  }, []);

  return {
    draft,
    setDraft,
    composerRef,
    composerDisabled,
    hasPendingUserInputs,
    canSend: draft.trim() !== "" && !composerDisabled,
    handleSubmit,
    handleSendClick,
    handleComposerKeyDown,
    clearDraft,
  };
}

export type AiChatComposerState = ReturnType<typeof useAiChatComposer>;
