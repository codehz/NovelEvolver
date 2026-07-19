import { Button } from "#app/shared/ui";

import {
  settingsEmptyStateClass,
  settingsPanelRootClass,
  settingsPanelScrollClass,
  settingsPanelSectionClass,
} from "./settings-chrome";

type SettingsPanelLoadingProps = {
  label?: string;
};

export function SettingsPanelLoading({ label = "加载中…" }: SettingsPanelLoadingProps) {
  return (
    <div className={settingsPanelRootClass}>
      <div className={settingsPanelScrollClass}>
        <div className={settingsEmptyStateClass}>{label}</div>
      </div>
    </div>
  );
}

type SettingsPanelLoadErrorProps = {
  message: string;
  onRetry: () => void;
};

export function SettingsPanelLoadError({ message, onRetry }: SettingsPanelLoadErrorProps) {
  return (
    <div className={settingsPanelRootClass}>
      <div className={settingsPanelScrollClass}>
        <div className={settingsPanelSectionClass}>
          <p className="text-xs text-ctp-red">{message}</p>
          <Button onClick={onRetry}>重试</Button>
        </div>
      </div>
    </div>
  );
}

type SettingsPanelEmptyProps = {
  children: string;
};

export function SettingsPanelEmpty({ children }: SettingsPanelEmptyProps) {
  return <div className={settingsEmptyStateClass}>{children}</div>;
}
