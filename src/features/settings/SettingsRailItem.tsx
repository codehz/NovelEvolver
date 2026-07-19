import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass } from "#app/shared/lib/ui/interaction-chrome";

import {
  settingsListItemTitleClass,
  settingsRailItemClass,
  settingsRailItemSelectedClass,
  settingsStatusBadgeClass,
} from "./settings-chrome";

const metaLineClass = cn("truncate text-2xs text-app-muted");

type SettingsRailItemProps = {
  title: string;
  selected?: boolean;
  badge?: ReactNode;
  meta?: ReactNode;
  onSelect: () => void;
};

/** Selectable master-list row for settings dual-pane rails. */
export function SettingsRailItem({
  title,
  selected = false,
  badge,
  meta,
  onSelect,
}: SettingsRailItemProps) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      className={cn(
        settingsRailItemClass,
        controlFocusVisibleClass,
        selected && settingsRailItemSelectedClass,
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn(settingsListItemTitleClass, "min-w-0 flex-1")} title={title}>
          {title}
        </span>
        {badge != null && badge !== false ? (
          typeof badge === "string" || typeof badge === "number" ? (
            <span className={settingsStatusBadgeClass}>{badge}</span>
          ) : (
            badge
          )
        ) : null}
      </div>
      {meta != null ? (
        typeof meta === "string" ? (
          <div className={metaLineClass} title={meta}>
            {meta}
          </div>
        ) : (
          meta
        )
      ) : null}
    </button>
  );
}

export { metaLineClass as settingsRailItemMetaLineClass };
