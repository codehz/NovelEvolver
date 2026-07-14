import { Button } from "#app/shared/ui";

import { settingsSubpageHeaderClass, settingsSubpageTitleClass } from "./settings-chrome";

type SettingsSubpageHeaderProps = {
  title: string;
  onBack: () => void;
  backLabel?: string;
};

export function SettingsSubpageHeader({
  title,
  onBack,
  backLabel = "返回",
}: SettingsSubpageHeaderProps) {
  return (
    <header className={settingsSubpageHeaderClass}>
      <Button aria-label={backLabel} variant="ghost" size="icon-md" onClick={onBack}>
        <span aria-hidden="true" className="icon-[codicon--arrow-left] text-base" />
      </Button>
      <h3 className={settingsSubpageTitleClass}>{title}</h3>
    </header>
  );
}
