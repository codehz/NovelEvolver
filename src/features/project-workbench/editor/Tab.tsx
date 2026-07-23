import type { KeyboardEvent, ReactNode, Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button, SlotText } from "#app/shared/ui";

import {
  editorTabActiveClass,
  editorTabClass,
  editorTabCloseButtonActiveClass,
  editorTabCloseButtonClass,
  editorTabInactiveClass,
} from "./editor-chrome";

export type TabItem = {
  id: string;
  label: string;
};

type TabProps = {
  label: string;
  active: boolean;
  transient?: boolean;
  onActivate: () => void;
  onClose?: () => void;
  onPin?: () => void;
  icon?: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

export function Tab({
  label,
  active,
  transient = false,
  onActivate,
  onClose,
  onPin,
  icon,
  ref,
}: TabProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      ref={ref}
      className={cn(editorTabClass, active ? editorTabActiveClass : editorTabInactiveClass)}
      role="tab"
      aria-selected={active}
      onClick={onActivate}
      onDoubleClick={onPin}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {icon ?? (
        <span
          aria-hidden="true"
          className={cn("icon-[codicon--file-text]", "mr-1.5 shrink-0 text-base text-ctp-blue")}
        />
      )}
      <SlotText className={cn("truncate pr-1", transient && "italic")} text={label} />
      {onClose && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`关闭 ${label}`}
          className={cn(editorTabCloseButtonClass, active && editorTabCloseButtonActiveClass)}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--close]" />
        </Button>
      )}
    </div>
  );
}
