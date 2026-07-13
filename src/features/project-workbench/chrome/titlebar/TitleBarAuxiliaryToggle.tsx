import { TitleBarActionsPortalContent } from "#app/shared/lib/shell/titlebar-portal";
import { cn } from "#app/shared/lib/ui/cn";
import { IconTooltip } from "#app/shared/ui/IconTooltip";

const toggleButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0",
  "text-titlebar-foreground transition-colors duration-150",
  "hover:bg-ctp-text/8",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

export function TitleBarAuxiliaryToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <TitleBarActionsPortalContent>
      <IconTooltip label="AI 助手面板" side="bottom">
        <button
          aria-label={visible ? "隐藏 AI 侧边栏" : "显示 AI 侧边栏"}
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
                ? "icon-[codicon--layout-sidebar-right]"
                : "icon-[codicon--layout-sidebar-right-off]",
            )}
          />
        </button>
      </IconTooltip>
    </TitleBarActionsPortalContent>
  );
}
