import { useId } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  historyEmptyClass,
  historyFooterClass,
  historyFooterToggleClass,
  historyGroupLabelClass,
  historyListClass,
  historyPickerBodyClass,
  historyPickerShellClass,
  historySearchInputClass,
  historySearchWrapClass,
} from "./ai-chat-history-chrome";
import { AiChatHistoryRow } from "./AiChatHistoryRow";
import type { AiChatHistoryListController } from "./use-ai-chat-history-list";

type AiChatHistoryPanelProps = { list: AiChatHistoryListController };

export function AiChatHistoryPanel({ list }: AiChatHistoryPanelProps) {
  const titleId = useId();
  const listboxId = useId();
  const searchInputId = useId();

  return (
    <>
      <p className="sr-only" id={titleId}>
        历史会话
      </p>
      <div className={historyPickerShellClass}>
        <div className={historySearchWrapClass}>
          <label className="sr-only" htmlFor={searchInputId}>
            搜索会话
          </label>
          <input
            ref={list.searchInputRef}
            id={searchInputId}
            className={historySearchInputClass}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="搜索标题或消息内容…"
            value={list.query}
            onChange={(event) => {
              list.setQuery(event.target.value);
            }}
            onKeyDown={list.handleSearchKeyDown}
          />
        </div>
        <div className={historyPickerBodyClass}>
          <ul
            ref={list.listRef}
            id={listboxId}
            className={historyListClass}
            role="listbox"
            aria-label="历史会话"
          >
            {list.selectableCount === 0 ? (
              <li className={historyEmptyClass}>{list.emptyMessage}</li>
            ) : (
              list.listEntries.map((entry) => {
                if (entry.kind === "group") {
                  return (
                    <li
                      key={`group-${entry.id}`}
                      className={historyGroupLabelClass}
                      role="presentation"
                    >
                      {entry.label}
                    </li>
                  );
                }

                const { conversation, snippet, optionIndex } = entry;
                return (
                  <AiChatHistoryRow
                    key={conversation.id}
                    conversation={conversation}
                    snippet={snippet}
                    optionIndex={optionIndex}
                    active={conversation.id === list.activeConversationId}
                    highlighted={list.highlightIndex === optionIndex}
                    isRenaming={list.renamingId === conversation.id}
                    renameDraft={list.renameDraft}
                    renameInputRef={list.renameInputRef}
                    onHighlight={() => {
                      list.setHighlightIndex(optionIndex);
                    }}
                    onSelect={() => {
                      void list.handleSelect(conversation.id);
                    }}
                    onContextMenu={(event) => {
                      void list.handleContextMenu(event, conversation);
                    }}
                    onRenameDraftChange={list.setRenameDraft}
                    onCommitRename={() => {
                      void list.commitRename();
                    }}
                    onCancelRename={list.cancelRename}
                  />
                );
              })
            )}
          </ul>
        </div>
        <div className={historyFooterClass}>
          <Button
            variant="ghost"
            className={historyFooterToggleClass}
            onClick={list.toggleIncludeArchived}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 rounded-sm border border-badge-background",
                list.includeArchived
                  ? "icon-[codicon--check] bg-ctp-mauve text-app-background"
                  : "bg-app-background",
              )}
            />
            显示已归档
          </Button>
          <span className="text-2xs text-app-muted">
            {list.loadingList ? "刷新中" : `${list.selectableCount} 条`}
          </span>
        </div>
      </div>
    </>
  );
}
