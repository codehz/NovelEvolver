import { useCallback, useId, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";

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
import {
  SettingsPopoverContent,
  SettingsPopoverProvider,
  SettingsPopoverTarget,
  useSettingsRequestClose,
} from "./settings-popover";

const SETTINGS_CATEGORIES = [
  { id: "common", label: "常用" },
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
  if (!open) {
    return null;
  }

  return (
    <SettingsPopoverProvider onDismiss={onDismiss}>
      <SettingsDialogShell onDismiss={onDismiss} />
    </SettingsPopoverProvider>
  );
}

function SettingsDialogShell({ onDismiss }: { onDismiss: () => void }) {
  const titleId = useId();
  const searchInputId = useId();
  const requestClose = useSettingsRequestClose();
  const [activeCategoryId, setActiveCategoryId] = useState<SettingsCategoryId>("common");

  const dismiss = useCallback(() => {
    requestClose(onDismiss);
  }, [onDismiss, requestClose]);

  const activeCategory =
    SETTINGS_CATEGORIES.find((category) => category.id === activeCategoryId) ??
    SETTINGS_CATEGORIES[0];

  return (
    <>
      <button
        aria-label="关闭设置"
        className={settingsBackdropClass}
        type="button"
        onClick={dismiss}
      />
      <SettingsPopoverTarget
        aria-labelledby={titleId}
        aria-modal="true"
        className={settingsPanelClass}
        popover="manual"
        role="dialog"
      >
        <SettingsPopoverContent>
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
            <ScrollArea fill className={settingsSidebarClass}>
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
                        setActiveCategoryId(category.id);
                      }}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>

            <ScrollArea fill className={settingsContentClass}>
              <div className={settingsPlaceholderClass}>
                「{activeCategory.label}」分类暂无设置项
              </div>
            </ScrollArea>
          </div>
        </SettingsPopoverContent>
      </SettingsPopoverTarget>
    </>
  );
}
