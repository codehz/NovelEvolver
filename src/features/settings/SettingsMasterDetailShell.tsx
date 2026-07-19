import type { ReactNode } from "react";

import { settingsDualPaneClass } from "./settings-chrome";

type SettingsMasterDetailShellProps = {
  children: ReactNode;
  className?: string;
};

/** Dual-pane shell: left rail + right detail. */
export function SettingsMasterDetailShell({ children, className }: SettingsMasterDetailShellProps) {
  return <div className={className ?? settingsDualPaneClass}>{children}</div>;
}
