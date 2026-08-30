import type { ReactNode } from "react";

import { Button } from "#app/shared/ui";

import {
  settingsGhostActionClass,
  settingsHeaderActionsClass,
  settingsSubpageHeaderClass,
  settingsSubpageTitleClass,
} from "./settings-chrome";

type SettingsSubpageHeaderProps = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  /** Optional trailing actions (e.g. save) pinned to the header. */
  actions?: ReactNode;
};

export function SettingsSubpageHeader({
  title,
  onBack,
  backLabel = "返回",
  actions,
}: SettingsSubpageHeaderProps) {
  return (
    <header className={settingsSubpageHeaderClass}>
      <Button
        aria-label={backLabel}
        className={settingsGhostActionClass}
        variant="ghost"
        size="icon-md"
        onClick={onBack}
      >
        <span aria-hidden="true" className="icon-[codicon--arrow-left] text-base" />
      </Button>
      <h3 className={settingsSubpageTitleClass}>{title}</h3>
      {actions ? <div className={settingsHeaderActionsClass}>{actions}</div> : null}
    </header>
  );
}
