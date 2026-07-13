import { useCallback, useId, useState } from "react";

import { modelSelectorButtonClass, modelSelectorLabelClass } from "../ui/ai-chat-ui";
import {
  modelSelectorAnchorClass,
  modelSelectorPopoverPanelClass,
} from "./ai-chat-selector-chrome";
import {
  AiChatSelectorPopoverProvider,
  useAiChatSelectorRequestClose,
} from "./ai-chat-selector-popover";
import { AnchoredSelectorPicker } from "./AnchoredSelectorPicker";
import type { AiChatSelectorItem } from "./selector-items";

function ModelSelectorTrigger({
  open,
  disabled,
  label,
  panelId,
  onClick,
}: {
  open: boolean;
  disabled: boolean;
  label: string;
  panelId: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-controls={panelId}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label="选择模型"
      className={modelSelectorButtonClass}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true" className="icon-[codicon--sparkle] shrink-0 text-xs" />
      <span className={modelSelectorLabelClass}>{label}</span>
    </button>
  );
}

function ModelSelectorOpenShell({
  label,
  disabled,
  panelId,
  items,
  onDismiss,
  onSelect,
}: {
  label: string;
  disabled: boolean;
  panelId: string;
  items: readonly AiChatSelectorItem[];
  onDismiss: () => void;
  onSelect: (id: string) => void;
}) {
  const requestClose = useAiChatSelectorRequestClose();

  return (
    <>
      <ModelSelectorTrigger
        open
        disabled={disabled}
        label={label}
        panelId={panelId}
        onClick={() => {
          requestClose(onDismiss);
        }}
      />
      <AnchoredSelectorPicker
        panelId={panelId}
        panelClassName={modelSelectorPopoverPanelClass}
        title="选择模型"
        searchLabel="搜索模型"
        searchPlaceholder="按名称或提供商筛选…"
        emptyMessage="没有可用模型，请先在设置中添加"
        items={items}
        onSelect={onSelect}
      />
    </>
  );
}

export function AiChatModelSelector({
  label,
  disabled,
  items,
  onOpen,
  onSelect,
}: {
  label: string;
  disabled: boolean;
  items: readonly AiChatSelectorItem[];
  onOpen?: () => void;
  onSelect: (id: string) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      setOpen(false);
      onSelect(id);
    },
    [onSelect],
  );

  return (
    <div className={modelSelectorAnchorClass}>
      {open ? (
        <AiChatSelectorPopoverProvider onDismiss={dismiss}>
          <ModelSelectorOpenShell
            label={label}
            disabled={disabled}
            panelId={panelId}
            items={items}
            onDismiss={dismiss}
            onSelect={handleSelect}
          />
        </AiChatSelectorPopoverProvider>
      ) : (
        <ModelSelectorTrigger
          open={false}
          disabled={disabled}
          label={label}
          panelId={panelId}
          onClick={() => {
            if (!disabled) {
              onOpen?.();
              setOpen(true);
            }
          }}
        />
      )}
    </div>
  );
}
