import { cn } from "../../lib/cn";
import { TitleBarActionsPortalContent } from "../../lib/titlebar-portal";

const toggleButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0",
  "text-titlebar-foreground transition-colors duration-150",
  "hover:bg-window-button-hover",
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
      <button
        aria-label={visible ? "隐藏 AI 侧边栏" : "显示 AI 侧边栏"}
        aria-pressed={visible}
        className={toggleButtonClass}
        title="AI 助手面板"
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
    </TitleBarActionsPortalContent>
  );
}
