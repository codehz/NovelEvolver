import { Popover } from "@base-ui/react/popover";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { ContextMenuItem } from "#app/shared/lib/context-menu";
import { popupContextMenu } from "#app/shared/lib/shell/popup-context-menu";
import { cn } from "#app/shared/lib/ui/cn";
import { IconTooltip } from "#app/shared/ui/IconTooltip";
import type { AiConversationSearchHit, AiConversationSummary } from "#shared/rpc/ai/index";
import {
  sidebarHeaderActionClass,
  sidebarHeaderIconClass,
} from "#workbench/chrome/sidebar/sidebar-chrome";

import {
  SELECTOR_OPTION_INDEX_ATTR,
  useSelectorListNavigation,
} from "../selectors/use-selector-list-navigation";
import { useAiChatState } from "../state/use-ai-chat-state";
import {
  historyBadgeClass,
  historyEmptyClass,
  historyFooterClass,
  historyFooterToggleClass,
  historyGroupLabelClass,
  historyListClass,
  historyPanelContentClass,
  historyPopoverPanelClass,
  historyPositionerClass,
  historyRenameInputClass,
  historyRowButtonClass,
  historyRowDetailClass,
  historyRowEmphasisClass,
  historyRowHighlightedClass,
  historyRowLabelClass,
  historyRowMetaClass,
  historyRowMutedClass,
  historySearchInputClass,
  historySearchWrapClass,
} from "./ai-chat-history-chrome";
import { formatAbsoluteActivityTime, formatRelativeActivityTime } from "./format-relative-time";
import { groupConversationsByActivity } from "./group-conversations";

const SEARCH_DEBOUNCE_MS = 180;

type HistoryListEntry =
  | { kind: "group"; id: string; label: string }
  | {
      kind: "item";
      conversation: AiConversationSummary;
      snippet: string | null;
      optionIndex: number;
    };

function activityLabel(conversation: AiConversationSummary): string | null {
  switch (conversation.activity) {
    case "streaming":
      return "生成中";
    case "awaiting_user":
      return "等待回答";
    case "idle":
      return conversation.persisted ? null : "未保存草稿";
  }
}

function conversationTitle(conversation: AiConversationSummary): string {
  const title = conversation.title.trim();
  return title === "" ? "未命名会话" : title;
}

function buildContextMenuItems(conversation: AiConversationSummary): ContextMenuItem[] {
  const items: ContextMenuItem[] = [{ id: "rename", label: "重命名" }];
  if (conversation.status === "archived") {
    items.push({ id: "unarchive", label: "取消归档" });
  } else {
    items.push({ id: "archive", label: "归档" });
  }
  items.push({ type: "separator" }, { id: "delete", label: "删除" });
  return items;
}

export function AiChatHistorySelector({
  disabled,
  onClearDraft,
}: {
  disabled: boolean;
  onClearDraft: () => void;
}) {
  const {
    snapshot,
    listConversations,
    searchConversations,
    switchConversation,
    renameConversation,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
  } = useAiChatState();

  const titleId = useId();
  const listboxId = useId();
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<AiConversationSearchHit[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const suppressDismissRef = useRef(false);
  const requestSeqRef = useRef(0);

  const activeConversationId = snapshot.conversationId;
  const isSearching = debouncedQuery.trim() !== "";

  useEffect(() => {
    if (!open) {
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [open, query]);

  const refreshList = useCallback(async () => {
    if (!open) {
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoadingList(true);
    try {
      const nextQuery = debouncedQuery.trim();
      const nextItems =
        nextQuery === ""
          ? ((await listConversations({ includeArchived })) as AiConversationSearchHit[]).map(
              (entry) => ({ ...entry, snippet: null }),
            )
          : await searchConversations(nextQuery, { includeArchived });
      if (seq !== requestSeqRef.current) {
        return;
      }
      setItems(nextItems);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoadingList(false);
      }
    }
  }, [debouncedQuery, includeArchived, listConversations, open, searchConversations]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Keep list content mounted during the exit animation. Reset only after
  // Base UI reports the close transition finished (onOpenChangeComplete).
  const resetClosedState = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setItems([]);
    setIncludeArchived(false);
    setRenamingId(null);
    setRenameDraft("");
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (renamingId == null) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [renamingId]);

  const listEntries = useMemo((): HistoryListEntry[] => {
    if (isSearching) {
      return items.map((conversation, optionIndex) => ({
        kind: "item" as const,
        conversation,
        snippet: conversation.snippet,
        optionIndex,
      }));
    }

    const groups = groupConversationsByActivity(items);
    const entries: HistoryListEntry[] = [];
    let optionIndex = 0;
    for (const group of groups) {
      entries.push({ kind: "group", id: group.id, label: group.label });
      for (const conversation of group.items) {
        entries.push({
          kind: "item",
          conversation,
          snippet: null,
          optionIndex,
        });
        optionIndex += 1;
      }
    }
    return entries;
  }, [isSearching, items]);

  const selectableItems = useMemo(
    () =>
      listEntries.filter(
        (entry): entry is Extract<HistoryListEntry, { kind: "item" }> => entry.kind === "item",
      ),
    [listEntries],
  );

  const commitRename = useCallback(async () => {
    if (renamingId == null) {
      return;
    }
    const nextTitle = renameDraft.trim();
    const conversationId = renamingId;
    setRenamingId(null);
    setRenameDraft("");
    if (nextTitle === "") {
      return;
    }
    const current = items.find((entry) => entry.id === conversationId);
    if (current && conversationTitle(current) === nextTitle) {
      return;
    }
    await renameConversation(conversationId, nextTitle);
    await refreshList();
  }, [items, refreshList, renameConversation, renameDraft, renamingId]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameDraft("");
  }, []);

  const handleSelect = useCallback(
    async (conversationId: string) => {
      if (renamingId != null) {
        return;
      }
      setOpen(false);
      if (conversationId === activeConversationId) {
        return;
      }
      onClearDraft();
      await switchConversation(conversationId);
    },
    [activeConversationId, onClearDraft, renamingId, switchConversation],
  );

  const { highlightIndex, setHighlightIndex, listRef, onSearchKeyDown, resetHighlight } =
    useSelectorListNavigation({
      itemCount: selectableItems.length,
      onActivate: (index) => {
        const item = selectableItems[index];
        if (item != null) {
          void handleSelect(item.conversation.id);
          resetHighlight();
        }
      },
    });

  useEffect(() => {
    resetHighlight();
  }, [debouncedQuery, includeArchived, items, resetHighlight]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && disabled) {
        return;
      }
      if (!next && suppressDismissRef.current) {
        return;
      }
      if (!next && renamingId != null) {
        void commitRename();
      }
      setOpen(next);
    },
    [commitRename, disabled, renamingId],
  );

  const handleOpenChangeComplete = useCallback(
    (next: boolean) => {
      if (!next) {
        resetClosedState();
      }
    },
    [resetClosedState],
  );

  const handleContextMenu = useCallback(
    async (event: ReactMouseEvent, conversation: AiConversationSummary) => {
      event.preventDefault();
      event.stopPropagation();
      if (renamingId != null) {
        return;
      }

      suppressDismissRef.current = true;
      try {
        const actionId = await popupContextMenu(buildContextMenuItems(conversation), {
          x: event.clientX,
          y: event.clientY,
        });
        if (actionId == null) {
          return;
        }
        if (actionId === "rename") {
          setRenamingId(conversation.id);
          setRenameDraft(conversationTitle(conversation));
          return;
        }
        if (actionId === "archive") {
          await archiveConversation(conversation.id);
          await refreshList();
          return;
        }
        if (actionId === "unarchive") {
          await unarchiveConversation(conversation.id);
          await refreshList();
          return;
        }
        if (actionId === "delete") {
          const title = conversationTitle(conversation);
          if (!window.confirm(`确定删除会话「${title}」吗？此操作不可恢复。`)) {
            return;
          }
          await deleteConversation(conversation.id);
          await refreshList();
        }
      } finally {
        window.setTimeout(() => {
          suppressDismissRef.current = false;
        }, 0);
      }
    },
    [archiveConversation, deleteConversation, refreshList, renamingId, unarchiveConversation],
  );

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (renamingId != null) {
        return;
      }
      onSearchKeyDown(event);
    },
    [onSearchKeyDown, renamingId],
  );

  const emptyMessage = useMemo(() => {
    if (loadingList) {
      return "加载中…";
    }
    if (isSearching) {
      return "无匹配会话";
    }
    if (!includeArchived) {
      return "暂无历史会话";
    }
    return "暂无会话";
  }, [includeArchived, isSearching, loadingList]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <IconTooltip label="历史会话" side="bottom">
        <Popover.Trigger
          className={sidebarHeaderActionClass}
          disabled={disabled}
          aria-label="历史会话"
          type="button"
        >
          <span
            aria-hidden="true"
            className={cn(sidebarHeaderIconClass, "icon-[codicon--history]")}
          />
        </Popover.Trigger>
      </IconTooltip>
      <Popover.Portal>
        <Popover.Positioner
          className={historyPositionerClass}
          side="bottom"
          align="end"
          sideOffset={6}
          positionMethod="fixed"
        >
          <Popover.Popup
            className={historyPopoverPanelClass}
            initialFocus={false}
            finalFocus={false}
          >
            <div className={historyPanelContentClass} aria-labelledby={titleId}>
              <p className="sr-only" id={titleId}>
                历史会话
              </p>
              <div className={historySearchWrapClass}>
                <label className="sr-only" htmlFor={searchInputId}>
                  搜索会话
                </label>
                <input
                  ref={searchInputRef}
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
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <ul
                ref={listRef}
                id={listboxId}
                className={historyListClass}
                role="listbox"
                aria-label="历史会话"
              >
                {selectableItems.length === 0 ? (
                  <li className={historyEmptyClass}>{emptyMessage}</li>
                ) : (
                  listEntries.map((entry) => {
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
                    const emphasized = conversation.id === activeConversationId;
                    const highlighted = highlightIndex === optionIndex;
                    const badges: string[] = [];
                    const activity = activityLabel(conversation);
                    if (activity) {
                      badges.push(activity);
                    }
                    if (conversation.status === "archived") {
                      badges.push("已归档");
                    }
                    if (conversation.scenarioId) {
                      badges.push("场景");
                    }
                    const relativeTime = formatRelativeActivityTime(conversation.lastActiveAt);
                    const absoluteTime = formatAbsoluteActivityTime(conversation.lastActiveAt);
                    const isRenaming = renamingId === conversation.id;

                    return (
                      <li
                        key={conversation.id}
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
                                setRenameDraft(event.target.value);
                              }}
                              onBlur={() => {
                                void commitRename();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void commitRename();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRename();
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
                              emphasized && historyRowEmphasisClass,
                              conversation.status === "archived" && historyRowMutedClass,
                            )}
                            onMouseEnter={() => {
                              setHighlightIndex(optionIndex);
                            }}
                            onClick={() => {
                              void handleSelect(conversation.id);
                            }}
                            onContextMenu={(event) => {
                              void handleContextMenu(event, conversation);
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "icon-[codicon--check] size-3.5 shrink-0",
                                  emphasized ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className={historyRowLabelClass}>
                                {conversationTitle(conversation)}
                              </span>
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
                                <span className={historyRowDetailClass} title={absoluteTime}>
                                  {relativeTime}
                                </span>
                              )}
                            </span>
                          </button>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
              <div className={historyFooterClass}>
                <button
                  type="button"
                  className={historyFooterToggleClass}
                  onClick={() => {
                    setIncludeArchived((current) => !current);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0 rounded-sm border border-badge-background",
                      includeArchived
                        ? "icon-[codicon--check] bg-ctp-mauve text-app-background"
                        : "bg-app-background",
                    )}
                  />
                  显示已归档
                </button>
                <span className="text-2xs text-app-muted">
                  {loadingList ? "刷新中" : `${selectableItems.length} 条`}
                </span>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
