import { useState } from "react";

import { settingsErrorMessage } from "./settings-error";

export function useSettingsMutation(refresh: () => Promise<void>) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearActionError = () => {
    setActionError(null);
  };

  const runMutation = async <T>(
    action: () => PromiseLike<T>,
    fallback: string,
  ): Promise<T | null> => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (error) {
      setActionError(settingsErrorMessage(error, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { actionError, busy, clearActionError, runMutation };
}
