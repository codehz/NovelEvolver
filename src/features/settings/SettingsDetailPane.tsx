import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  settingsDetailInsetClass,
  settingsDetailSurfaceClass,
  settingsDualPaneDetailClass,
  settingsDualPaneDetailHeaderClass,
  settingsDualPaneDetailScrollClass,
} from "./settings-chrome";

type SettingsDetailPaneProps = {
  /** Optional fixed header above the scroll body. */
  header?: ReactNode;
  /** Banner above header/body (e.g. action error). */
  banner?: ReactNode;
  children: ReactNode;
  /** When false, children are not wrapped in the default detail scrollport. */
  scrollBody?: boolean;
};

/** Right detail column for master-detail settings — editor-style inset card. */
export function SettingsDetailPane({
  header,
  banner,
  children,
  scrollBody = true,
}: SettingsDetailPaneProps) {
  return (
    <section className={cn(settingsDualPaneDetailClass, settingsDetailInsetClass)}>
      <div className={cn(settingsDetailSurfaceClass, "flex min-h-0 flex-1 flex-col")}>
        {banner}
        {header ? <div className={settingsDualPaneDetailHeaderClass}>{header}</div> : null}
        {scrollBody ? (
          <div className={settingsDualPaneDetailScrollClass}>{children}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
