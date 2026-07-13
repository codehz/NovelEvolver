import { useCallback, useId, useState } from "react";

import { agentSelectorButtonClass, modelSelectorLabelClass } from "../ui/ai-chat-ui";
import {
  agentSelectorAnchorClass,
  agentSelectorPopoverPanelClass,
} from "./ai-chat-selector-chrome";
import { AiChatSelectorPopoverProvider } from "./ai-chat-selector-popover";
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
      popoverTarget={panelId}
      title={label}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true" className="icon-[codicon--hubot] shrink-0 text-xs" />
      <span className={modelSelectorLabelClass}>{label}</span>
    </button>
  );
}

function AgentSelectorShell({
  open,
  label,
  disabled,
  panelId,
  items,
  onDismiss,
  onSelect,
}: {
  open: boolean;
  label: string;
  disabled: boolean;
  panelId: string;
  items: readonly AiChatSelectorItem[];
  onDismiss: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <AgentSelectorTrigger
        open={open}
        disabled={disabled}
        label={label}
        panelId={panelId}
        onClick={() => {
          if (!open) {
            onDismiss();
          }
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
      <AiChatSelectorPopoverProvider onDismiss={dismiss} openOnMount={false}>
        <AgentSelectorShell
          open={open}
          disabled={disabled}
          label={label}
          panelId={panelId}
          items={items}
          onDismiss={() => {
            if (!disabled) {
              onOpen?.();
              setOpen(true);
            }
          }}
          onSelect={handleSelect}
        />
      </AiChatSelectorPopoverProvider>
    </div>
  );
}
