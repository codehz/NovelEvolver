import { useState } from "react";

import { settingsErrorMessage } from "./settings-error";

export function useSettingsMutation(refresh: () => Promise<void>) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearActionError = () => {
    setActionError(null);
  };

  const runMutation = async (action: () => PromiseLike<unknown>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (error) {
      setActionError(settingsErrorMessage(error, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { actionError, busy, clearActionError, runMutation };
}
