import { TitleBarActionsPortalContent } from "#app/shared/lib/shell/titlebar-portal";
import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import { Button, IconTooltip } from "#app/shared/ui";

const toggleButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0",
  "text-titlebar-foreground transition-colors duration-150",
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

type TitleBarAuxiliaryToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

export function TitleBarAuxiliaryToggle({ visible, onToggle }: TitleBarAuxiliaryToggleProps) {
  return (
    <TitleBarActionsPortalContent>
      <IconTooltip label="AI 助手面板" side="bottom">
        <Button
          variant="ghost"
          size="icon-md"
          aria-label={visible ? "隐藏 AI 侧边栏" : "显示 AI 侧边栏"}
          aria-pressed={visible}
          className={toggleButtonClass}
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
        </Button>
      </IconTooltip>
    </TitleBarActionsPortalContent>
  );
}
