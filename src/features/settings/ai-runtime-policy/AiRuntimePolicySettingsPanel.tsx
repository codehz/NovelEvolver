import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  settingsDetailSurfaceClass,
  settingsGhostActionClass,
  settingsHeaderActionsClass,
  settingsPanelRootClass,
  settingsSubpageHeaderClass,
  settingsSubpageShellClass,
  settingsSubpageTitleClass,
} from "../settings-chrome";
import { SettingsFormActions } from "../SettingsFormActions";
import { SettingsPanelLoadError, SettingsPanelLoading } from "../SettingsPanelStatus";
import { AI_RUNTIME_POLICY_FORM_ID, AiRuntimePolicyForm } from "./AiRuntimePolicyForm";
import { useAiRuntimePolicySettings } from "./use-ai-runtime-policy-settings";

const policyDetailSurfaceClass = cn(settingsDetailSurfaceClass, "min-h-0 flex-1 overflow-y-auto");

type AiRuntimePolicySettingsPanelProps = {
  /** Whether the runtime-policy tab is currently active. */
  active?: boolean;
};

export function AiRuntimePolicySettingsPanel({ active = true }: AiRuntimePolicySettingsPanelProps) {
  const {
    actionError,
    busy,
    formKey,
    formRef,
    handleRestoreDefaults,
    handleSubmit,
    isLoading,
    loadError,
    onDirtyChange,
    refresh,
    snapshot,
  } = useAiRuntimePolicySettings({ active });

  if (isLoading && snapshot === undefined) {
    return <SettingsPanelLoading />;
  }

  if (loadError && snapshot === undefined) {
    return (
      <SettingsPanelLoadError
        message={loadError}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  if (snapshot === undefined) {
    return <SettingsPanelLoading />;
  }

  return (
    <div className={settingsPanelRootClass}>
      <div className={settingsSubpageShellClass}>
        <header className={settingsSubpageHeaderClass}>
          <h3 className={settingsSubpageTitleClass}>AI 运行策略</h3>
          <div className={settingsHeaderActionsClass}>
            <Button
              className={settingsGhostActionClass}
              disabled={busy}
              type="button"
              variant="ghost"
              onClick={() => {
                void handleRestoreDefaults();
              }}
            >
              恢复默认
            </Button>
            <SettingsFormActions busy={busy} form={AI_RUNTIME_POLICY_FORM_ID} submitLabel="保存" />
          </div>
        </header>

        <div className={policyDetailSurfaceClass}>
          <AiRuntimePolicyForm
            key={formKey}
            busy={busy}
            error={actionError}
            formRef={formRef}
            initial={snapshot}
            onDirtyChange={onDirtyChange}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
