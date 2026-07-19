import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { AutoTransition } from "@codehz/auto-transition";
import { useState } from "react";

import { AiAgentsSettingsPanel } from "./ai-agents/AiAgentsSettingsPanel";
import { AiModelsSettingsPanel } from "./ai-models/AiModelsSettingsPanel";
import { AiPromptsSettingsPanel } from "./ai-prompts/AiPromptsSettingsPanel";
import { AiRuntimePolicySettingsPanel } from "./ai-runtime-policy/AiRuntimePolicySettingsPanel";
import {
  settingsBackdropClass,
  settingsBodyClass,
  settingsContentClass,
  settingsHeaderClass,
  settingsIconButtonClass,
  settingsPanelClass,
  settingsTabChipClass,
  settingsTabIndicatorClass,
  settingsTabListClass,
  settingsTabsRootClass,
  settingsTitleClass,
} from "./settings-chrome";
import { requestSettingsLeave } from "./settings-leave-guard";
import {
  settingsPageFadeTransition,
  settingsPageTransitionHostClass,
} from "./settings-page-transition";

const SETTINGS_CATEGORIES = [
  { id: "ai-models", label: "AI 模型" },
  { id: "ai-agents", label: "AI Agent" },
  { id: "ai-prompts", label: "AI 提示词" },
  { id: "ai-runtime-policy", label: "AI 运行策略" },
] as const;

type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];

function isSettingsCategoryId(value: unknown): value is SettingsCategoryId {
  return SETTINGS_CATEGORIES.some((category) => category.id === value);
}

function settingsCategoryLabel(id: SettingsCategoryId): string {
  return SETTINGS_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

type SettingsDialogProps = {
  open: boolean;
  onDismiss: () => void;
};

export function SettingsDialog({ open, onDismiss }: SettingsDialogProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<SettingsCategoryId>("ai-models");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void requestSettingsLeave().then((ok) => {
            if (ok) {
              onDismiss();
            }
          });
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={settingsBackdropClass} />
        <Dialog.Popup className={settingsPanelClass}>
          <Tabs.Root
            className={settingsTabsRootClass}
            value={activeCategoryId}
            onValueChange={(next) => {
              if (!isSettingsCategoryId(next) || next === activeCategoryId) {
                return;
              }
              void requestSettingsLeave().then((ok) => {
                if (ok) {
                  setActiveCategoryId(next);
                }
              });
            }}
          >
            <header className={settingsHeaderClass}>
              <Dialog.Title className={settingsTitleClass}>
                <span aria-hidden="true" className="icon-[codicon--settings-gear] text-sm" />
                设置
              </Dialog.Title>

              <Tabs.List aria-label="设置分类" className={settingsTabListClass}>
                {SETTINGS_CATEGORIES.map((category) => (
                  <Tabs.Tab key={category.id} className={settingsTabChipClass} value={category.id}>
                    {category.label}
                  </Tabs.Tab>
                ))}
                <Tabs.Indicator className={settingsTabIndicatorClass} />
              </Tabs.List>

              <Dialog.Close aria-label="关闭" className={settingsIconButtonClass}>
                <span aria-hidden="true" className="icon-[codicon--close] text-sm" />
              </Dialog.Close>
            </header>

            <div className={settingsBodyClass}>
              <AutoTransition
                as="div"
                className={settingsPageTransitionHostClass}
                exitLayout="absolute"
                transition={settingsPageFadeTransition}
              >
                <div
                  key={activeCategoryId}
                  role="tabpanel"
                  aria-label={settingsCategoryLabel(activeCategoryId)}
                  className={settingsContentClass}
                >
                  {activeCategoryId === "ai-models" ? <AiModelsSettingsPanel /> : null}
                  {activeCategoryId === "ai-agents" ? <AiAgentsSettingsPanel /> : null}
                  {activeCategoryId === "ai-prompts" ? <AiPromptsSettingsPanel /> : null}
                  {activeCategoryId === "ai-runtime-policy" ? (
                    <AiRuntimePolicySettingsPanel />
                  ) : null}
                </div>
              </AutoTransition>
            </div>
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
