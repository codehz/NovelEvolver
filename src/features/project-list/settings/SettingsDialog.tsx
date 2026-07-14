import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { AiAgentsSettingsPanel } from "./ai-agents/AiAgentsSettingsPanel";
import { AiModelsSettingsPanel } from "./ai-models/AiModelsSettingsPanel";
import {
  settingsBackdropClass,
  settingsBodyClass,
  settingsContentClass,
  settingsHeaderClass,
  settingsIconButtonClass,
  settingsPanelClass,
  settingsTabChipActiveClass,
  settingsTabChipClass,
  settingsTabListClass,
  settingsTitleClass,
} from "./settings-chrome";

const SETTINGS_CATEGORIES = [
  { id: "ai-models", label: "AI 模型" },
  { id: "ai-agents", label: "AI Agent" },
] as const;

type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];

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
          <SettingsDialogChrome
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsDialogChrome({
  activeCategoryId,
  onSelectCategory,
}: {
  activeCategoryId: SettingsCategoryId;
  onSelectCategory: (id: SettingsCategoryId) => void;
}) {
  return (
    <>
      <header className={settingsHeaderClass}>
        <Dialog.Title className={settingsTitleClass}>
          <span aria-hidden="true" className="icon-[codicon--settings-gear] text-base" />
          设置
        </Dialog.Title>
        <Dialog.Close aria-label="关闭" className={settingsIconButtonClass}>
          <span aria-hidden="true" className="icon-[codicon--close] text-base" />
        </Dialog.Close>
      </header>

      <div aria-label="设置分类" className={settingsTabListClass} role="tablist">
        {SETTINGS_CATEGORIES.map((category) => {
          const active = category.id === activeCategoryId;
          return (
            <button
              key={category.id}
              aria-selected={active}
              className={cn(settingsTabChipClass, active && settingsTabChipActiveClass)}
              role="tab"
              type="button"
              onClick={() => {
                onSelectCategory(category.id);
              }}
            >
              {category.label}
            </button>
          );
        })}
      </div>

      <div className={settingsBodyClass}>
        <div className={settingsContentClass} role="tabpanel">
          {activeCategoryId === "ai-models" ? <AiModelsSettingsPanel /> : <AiAgentsSettingsPanel />}
        </div>
      </div>
    </>
  );
}
