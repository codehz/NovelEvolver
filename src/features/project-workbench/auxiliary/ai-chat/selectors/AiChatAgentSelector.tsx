import { useCallback, useId, useState } from "react";

import { agentSelectorButtonClass, modelSelectorLabelClass } from "../ui/ai-chat-ui";
import {
  agentSelectorAnchorClass,
  agentSelectorPopoverPanelClass,
} from "./ai-chat-selector-chrome";
import {
  AiChatSelectorPopoverProvider,
  useAiChatSelectorRequestClose,
} from "./ai-chat-selector-popover";
import { AnchoredSelectorPicker } from "./AnchoredSelectorPicker";
import type { AiChatSelectorItem } from "./selector-items";

function AgentSelectorTrigger({
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
      aria-label="选择 Agent"
      className={agentSelectorButtonClass}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true" className="icon-[codicon--hubot] shrink-0 text-xs" />
      <span className={modelSelectorLabelClass}>{label}</span>
    </button>
  );
}

function AgentSelectorOpenShell({
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
      <AgentSelectorTrigger
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
        panelClassName={agentSelectorPopoverPanelClass}
        title="选择 Agent"
        searchLabel="搜索 Agent"
        searchPlaceholder="按名称筛选…"
        emptyMessage="没有可用 Agent"
        items={items}
        onSelect={onSelect}
      />
    </>
  );
}

export function AiChatAgentSelector({
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
    <div className={agentSelectorAnchorClass}>
      {open ? (
        <AiChatSelectorPopoverProvider onDismiss={dismiss}>
          <AgentSelectorOpenShell
            label={label}
            disabled={disabled}
            panelId={panelId}
            items={items}
            onDismiss={dismiss}
            onSelect={handleSelect}
          />
        </AiChatSelectorPopoverProvider>
      ) : (
        <AgentSelectorTrigger
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
