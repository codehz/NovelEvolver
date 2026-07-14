import { TitleBarActionsPortalContent } from "#app/shared/lib/shell/titlebar-portal";
import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import { IconTooltip } from "#app/shared/ui";

const toggleButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0",
  "text-titlebar-foreground transition-colors duration-150",
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

export function TitleBarPrimarySidebarToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <TitleBarActionsPortalContent>
      <IconTooltip label="主侧边栏" side="bottom">
        <button
          aria-label={visible ? "隐藏主侧边栏" : "显示主侧边栏"}
          aria-pressed={visible}
          className={toggleButtonClass}
          type="button"
          onClick={onToggle}
        >
          <span
            aria-hidden="true"
            className={cn(
              "text-sm",
              visible
                ? "icon-[codicon--layout-sidebar-left]"
                : "icon-[codicon--layout-sidebar-left-off]",
            )}
          />
        </button>
      </IconTooltip>
    </TitleBarActionsPortalContent>
  );
}
