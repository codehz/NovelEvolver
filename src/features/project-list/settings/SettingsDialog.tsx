import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { useState } from "react";

import { AiAgentsSettingsPanel } from "./ai-agents/AiAgentsSettingsPanel";
import { AiModelsSettingsPanel } from "./ai-models/AiModelsSettingsPanel";
import { AiPromptsSettingsPanel } from "./ai-prompts/AiPromptsSettingsPanel";
import {
  settingsBackdropClass,
  settingsBodyClass,
  settingsContentClass,
  settingsHeaderClass,
  settingsIconButtonClass,
  settingsPanelClass,
  settingsTabChipClass,
  settingsTabListClass,
  settingsTabsRootClass,
  settingsTitleClass,
} from "./settings-chrome";

const SETTINGS_CATEGORIES = [
  { id: "ai-models", label: "AI 模型" },
  { id: "ai-agents", label: "AI Agent" },
  { id: "ai-prompts", label: "AI 提示词" },
] as const;

type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];

function isSettingsCategoryId(value: unknown): value is SettingsCategoryId {
  return SETTINGS_CATEGORIES.some((category) => category.id === value);
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
          onDismiss();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={settingsBackdropClass} />
        <Dialog.Popup className={settingsPanelClass}>
          <header className={settingsHeaderClass}>
            <Dialog.Title className={settingsTitleClass}>
              <span aria-hidden="true" className="icon-[codicon--settings-gear] text-base" />
              设置
            </Dialog.Title>
            <Dialog.Close aria-label="关闭" className={settingsIconButtonClass}>
              <span aria-hidden="true" className="icon-[codicon--close] text-base" />
            </Dialog.Close>
          </header>

          <Tabs.Root
            className={settingsTabsRootClass}
            value={activeCategoryId}
            onValueChange={(next) => {
              if (isSettingsCategoryId(next)) {
                setActiveCategoryId(next);
              }
            }}
          >
            <Tabs.List aria-label="设置分类" className={settingsTabListClass}>
              {SETTINGS_CATEGORIES.map((category) => (
                <Tabs.Tab key={category.id} className={settingsTabChipClass} value={category.id}>
                  {category.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            <div className={settingsBodyClass}>
              <Tabs.Panel className={settingsContentClass} value="ai-models">
                <AiModelsSettingsPanel />
              </Tabs.Panel>
              <Tabs.Panel className={settingsContentClass} value="ai-agents">
                <AiAgentsSettingsPanel />
              </Tabs.Panel>
              <Tabs.Panel className={settingsContentClass} value="ai-prompts">
                <AiPromptsSettingsPanel />
              </Tabs.Panel>
            </div>
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
