import { useEffect, type ReactNode } from "react";

import { useConfirm } from "../../shared/ui/OverlayHost";
import { setSettingsLeaveConfirm } from "./settings-leave-guard";

type SettingsLeaveBinderProps = {
  children: ReactNode;
};

export function SettingsLeaveBinder({ children }: SettingsLeaveBinderProps): ReactNode {
  const confirm = useConfirm();

  useEffect(() => {
    setSettingsLeaveConfirm(() => confirm());
    return () => {
      setSettingsLeaveConfirm(null);
    };
  }, [confirm]);

  return children;
}

export function useSettingsLeaveGuard(options?: { editor?: boolean }): void {
  void options;
  // Back navigation and dirty confirmation are owned by SettingsNavigator.
}
