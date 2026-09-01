import type { AiPromptConfigPublic } from "@novelevolver/domain/settings/ai-settings";
import { useCallback, useEffect, useRef, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";

import { toPromptSlashItems, type PromptSlashItem } from "./slash-query";

/**
 * Loads user prompt templates for slash-command completion.
 * Refreshes on mount and whenever `refresh()` is called (e.g. when `/` menu opens).
 */
export function usePromptCatalog() {
  const [prompts, setPrompts] = useState<readonly AiPromptConfigPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;

  const refresh = useCallback(async (): Promise<readonly PromptSlashItem[]> => {
    try {
      const snapshot = await Promise.resolve(settingsService.getAiPrompts());
      const next = snapshot.prompts;
      setPrompts(next);
      setError(null);
      setLoading(false);
      return toPromptSlashItems(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLoading(false);
      return toPromptSlashItems(promptsRef.current);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    prompts,
    items: toPromptSlashItems(prompts),
    loading,
    error,
    refresh,
  };
}
