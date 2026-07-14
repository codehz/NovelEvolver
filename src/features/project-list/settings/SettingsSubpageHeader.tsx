import {
  settingsIconButtonClass,
  settingsSubpageHeaderClass,
  settingsSubpageTitleClass,
} from "./settings-chrome";

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
      <button
        aria-label={backLabel}
        className={settingsIconButtonClass}
        type="button"
        onClick={onBack}
      >
        <span aria-hidden="true" className="icon-[codicon--arrow-left] text-base" />
      </button>
      <h3 className={settingsSubpageTitleClass}>{title}</h3>
    </header>
  );
}
