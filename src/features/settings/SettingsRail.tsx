import type { ReactNode } from "react";

import { Button } from "#app/shared/ui";

import {
  settingsDualPaneRailClass,
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
};

/** Left master list rail with bottom primary add action. */
export function SettingsRail({
  label,
  listAriaLabel,
  children,
  addLabel,
  addDisabled = false,
  onAdd,
}: SettingsRailProps) {
  return (
    <aside className={settingsDualPaneRailClass}>
      <div className={settingsDualPaneRailLabelClass}>{label}</div>
      <div className={settingsDualPaneRailScrollClass}>
        <ul className={settingsDualPaneRailListClass} aria-label={listAriaLabel ?? label}>
          {children}
        </ul>
      </div>
      <div className="shrink-0 p-2">
        <Button className="w-full" disabled={addDisabled} variant="primary" onClick={onAdd}>
          <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
          {addLabel}
        </Button>
      </div>
    </aside>
  );
}
