import type { AiConversationSummary } from "@novelevolver/domain/ai";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { RelativeTime } from "#app/shared/ui";

import { SELECTOR_OPTION_INDEX_ATTR } from "../selectors/use-selector-list-navigation";
import {
  historyBadgeClass,
  historyRenameInputClass,
  historyRowButtonClass,
  historyRowDetailClass,
  historyRowEmphasisClass,
  historyRowHighlightedClass,
  historyRowLabelClass,
  historyRowMetaClass,
  historyRowMutedClass,
} from "./ai-chat-history-chrome";
import { conversationBadges, conversationTitle } from "./history-list-model";

type AiChatHistoryRowProps = {
  conversation: AiConversationSummary;
  snippet: string | null;
  optionIndex: number;
  active: boolean;
  highlighted: boolean;
  isRenaming: boolean;
  renameDraft: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  onHighlight: () => void;
  onSelect: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
};

export function AiChatHistoryRow({
  conversation,
  snippet,
  optionIndex,
  active,
  highlighted,
  isRenaming,
  renameDraft,
  renameInputRef,
  onHighlight,
  onSelect,
  onContextMenu,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
}: AiChatHistoryRowProps) {
  const badges = conversationBadges(conversation);

  return (
    <li
      role="option"
      aria-selected={highlighted}
      {...{ [SELECTOR_OPTION_INDEX_ATTR]: optionIndex }}
    >
      {isRenaming ? (
        <div className={cn(historyRowButtonClass, historyRowHighlightedClass)}>
          <input
            ref={renameInputRef}
            className={historyRenameInputClass}
            value={renameDraft}
            onChange={(event) => {
              onRenameDraftChange(event.target.value);
            }}
            onBlur={() => {
              onCommitRename();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            historyRowButtonClass,
            highlighted && historyRowHighlightedClass,
            active && historyRowEmphasisClass,
            conversation.status === "archived" && historyRowMutedClass,
          )}
          onMouseEnter={onHighlight}
          onClick={onSelect}
          onContextMenu={onContextMenu}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "icon-[codicon--check] size-3.5 shrink-0",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <span className={historyRowLabelClass}>{conversationTitle(conversation)}</span>
          </span>
          <span className={historyRowMetaClass}>
            {badges.map((badge) => (
              <span key={badge} className={historyBadgeClass}>
                {badge}
              </span>
            ))}
            {snippet ? (
              <span className={historyRowDetailClass} title={snippet}>
                {snippet}
              </span>
            ) : (
              <RelativeTime
                timestampMs={conversation.updatedAt}
                className={historyRowDetailClass}
              />
            )}
          </span>
        </button>
      )}
    </li>
  );
}
