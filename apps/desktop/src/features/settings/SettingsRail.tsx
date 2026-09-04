import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  settingsDualPaneRailClass,
  settingsDualPaneRailFooterClass,
  settingsDualPaneRailLabelClass,
  settingsDualPaneRailListClass,
  settingsDualPaneRailScrollClass,
} from "./settings-chrome";

type SettingsRailProps = {
  label: string;
  listAriaLabel?: string;
  children: ReactNode;
  addLabel: string;
  addDisabled?: boolean;
  onAdd: () => void;
  importLabel?: string;
  onImport?: () => void;
};

/** Left master list rail with bottom primary add action. */
export function SettingsRail({
  label,
  listAriaLabel,
  children,
  addLabel,
  addDisabled = false,
  onAdd,
  importLabel,
  onImport,
}: SettingsRailProps) {
  return (
    <aside className={settingsDualPaneRailClass}>
      <div className={settingsDualPaneRailLabelClass}>{label}</div>
      <div className={settingsDualPaneRailScrollClass}>
        <ul className={settingsDualPaneRailListClass} aria-label={listAriaLabel ?? label}>
          {children}
        </ul>
      </div>
      <div
        className={cn(settingsDualPaneRailFooterClass, onImport != null && "flex flex-col gap-1")}
      >
        {onImport != null && importLabel != null ? (
          <Button className="w-full" disabled={addDisabled} variant="secondary" onClick={onImport}>
            <span aria-hidden="true" className="icon-[codicon--desktop-download] text-sm" />
            {importLabel}
          </Button>
        ) : null}
        <Button className="w-full" disabled={addDisabled} variant="primary" onClick={onAdd}>
          <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
          {addLabel}
        </Button>
      </div>
    </aside>
  );
}
