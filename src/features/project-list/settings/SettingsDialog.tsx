import { Dialog } from "@base-ui/react/dialog";
import { useId, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { AiAgentsSettingsPanel } from "./ai-agents/AiAgentsSettingsPanel";
import { AiModelsSettingsPanel } from "./ai-models/AiModelsSettingsPanel";
import {
  settingsBackdropClass,
  settingsBodyClass,
  settingsCategoryButtonActiveClass,
  settingsCategoryButtonClass,
  settingsContentClass,
  settingsHeaderClass,
  settingsIconButtonClass,
  settingsPanelClass,
  settingsPlaceholderClass,
  settingsSearchInputClass,
  settingsSearchWrapClass,
  settingsSidebarClass,
  settingsTitleClass,
} from "./settings-chrome";

const SETTINGS_CATEGORIES = [
  { id: "common", label: "常用" },
  { id: "ai-models", label: "AI 模型" },
  { id: "ai-agents", label: "AI Agent" },
  { id: "editor", label: "编辑器" },
  { id: "appearance", label: "外观" },
  { id: "extensions", label: "扩展" },
] as const;

type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];

type SettingsDialogProps = {
  open: boolean;
  onDismiss: () => void;
};

export function SettingsDialog({ open, onDismiss }: SettingsDialogProps) {
  const searchInputId = useId();
  const [activeCategoryId, setActiveCategoryId] = useState<SettingsCategoryId>("common");

  const activeCategory =
    SETTINGS_CATEGORIES.find((category) => category.id === activeCategoryId) ??
    SETTINGS_CATEGORIES[0];

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
            activeCategory={activeCategory}
            activeCategoryId={activeCategoryId}
            searchInputId={searchInputId}
            onSelectCategory={setActiveCategoryId}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsDialogChrome({
  searchInputId,
  activeCategoryId,
  activeCategory,
  onSelectCategory,
}: {
  searchInputId: string;
  activeCategoryId: SettingsCategoryId;
  activeCategory: (typeof SETTINGS_CATEGORIES)[number];
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

      <div className={settingsSearchWrapClass}>
        <label className="sr-only" htmlFor={searchInputId}>
          搜索设置
        </label>
        <input
          className={settingsSearchInputClass}
          disabled
          id={searchInputId}
          placeholder="搜索设置"
          type="search"
        />
      </div>

      <div className={settingsBodyClass}>
        <div className={settingsSidebarClass}>
          <nav aria-label="设置分类" className="flex flex-col">
            {SETTINGS_CATEGORIES.map((category) => {
              const active = category.id === activeCategoryId;
              return (
                <button
                  key={category.id}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    settingsCategoryButtonClass,
                    active && settingsCategoryButtonActiveClass,
                  )}
                  type="button"
                  onClick={() => {
                    onSelectCategory(category.id);
                  }}
                >
                  {category.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={settingsContentClass}>
          {activeCategoryId === "ai-models" ? (
            <AiModelsSettingsPanel />
          ) : activeCategoryId === "ai-agents" ? (
            <AiAgentsSettingsPanel />
          ) : (
            <div className={settingsPlaceholderClass}>「{activeCategory.label}」分类暂无设置项</div>
          )}
        </div>
      </div>
    </>
  );
}
