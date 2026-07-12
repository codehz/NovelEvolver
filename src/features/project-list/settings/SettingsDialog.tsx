import { useCallback, useId, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { NativeDialog, useNativeDialogRequestClose } from "#app/shared/ui/dialog";
import { ScrollArea } from "#app/shared/ui/ScrollArea";

import { AiAgentsSettingsPanel } from "./ai-agents/AiAgentsSettingsPanel";
import { AiModelsSettingsPanel } from "./ai-models/AiModelsSettingsPanel";
import {
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
  const titleId = useId();
  const searchInputId = useId();
  const [activeCategoryId, setActiveCategoryId] = useState<SettingsCategoryId>("common");

  const activeCategory =
    SETTINGS_CATEGORIES.find((category) => category.id === activeCategoryId) ??
    SETTINGS_CATEGORIES[0];

  return (
    <NativeDialog
      aria-labelledby={titleId}
      className={settingsPanelClass}
      open={open}
      onDismiss={onDismiss}
    >
      <SettingsDialogChrome
        activeCategory={activeCategory}
        activeCategoryId={activeCategoryId}
        searchInputId={searchInputId}
        titleId={titleId}
        onDismiss={onDismiss}
        onSelectCategory={setActiveCategoryId}
      />
    </NativeDialog>
  );
}

function SettingsDialogChrome({
  titleId,
  searchInputId,
  activeCategoryId,
  activeCategory,
  onDismiss,
  onSelectCategory,
}: {
  titleId: string;
  searchInputId: string;
  activeCategoryId: SettingsCategoryId;
  activeCategory: (typeof SETTINGS_CATEGORIES)[number];
  onDismiss: () => void;
  onSelectCategory: (id: SettingsCategoryId) => void;
}) {
  const requestClose = useNativeDialogRequestClose();

  const dismiss = useCallback(() => {
    requestClose(onDismiss);
  }, [onDismiss, requestClose]);

  return (
    <>
      <header className={settingsHeaderClass}>
        <h2 className={settingsTitleClass} id={titleId}>
          <span aria-hidden="true" className="icon-[codicon--settings-gear] text-base" />
          设置
        </h2>
        <button
          aria-label="关闭"
          className={settingsIconButtonClass}
          type="button"
          onClick={dismiss}
        >
          <span aria-hidden="true" className="icon-[codicon--close] text-base" />
        </button>
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
        <ScrollArea className={settingsSidebarClass}>
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
        </ScrollArea>

        <ScrollArea className={settingsContentClass}>
          {activeCategoryId === "ai-models" ? (
            <AiModelsSettingsPanel />
          ) : activeCategoryId === "ai-agents" ? (
            <AiAgentsSettingsPanel />
          ) : (
            <div className={settingsPlaceholderClass}>「{activeCategory.label}」分类暂无设置项</div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
