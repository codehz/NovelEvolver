import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { popupContextMenu } from "#app/shared/lib/shell/popup-context-menu";
import type { AiConversationSearchHit, AiConversationSummary } from "#shared/rpc/ai/index";

import { useSelectorListNavigation } from "../selectors/use-selector-list-navigation";
import { useAiChatState } from "../state/use-ai-chat-state";
import {
  buildContextMenuItems,
  buildHistoryListEntries,
  conversationTitle,
  historyEmptyMessage,
  toSearchHits,
  type HistoryListItemEntry,
} from "./history-list-model";

const SEARCH_DEBOUNCE_MS = 180;

export function useAiChatHistoryList({
  open,
  onClose,
  onClearDraft,
}: {
  open: boolean;
  onClose: () => void;
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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const suppressDismissRef = useRef(false);
  const requestSeqRef = useRef(0);

  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<AiConversationSearchHit[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const activeConversationId = snapshot.conversationId;
  const isSearching = debouncedQuery.trim() !== "";
  const isRenaming = renamingId != null;

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
          ? toSearchHits(await listConversations({ includeArchived }))
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

  const listEntries = useMemo(
    () => buildHistoryListEntries(items, isSearching),
    [isSearching, items],
  );

  const selectableItems = useMemo(
    () => listEntries.filter((entry): entry is HistoryListItemEntry => entry.kind === "item"),
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

  const startRename = useCallback((conversation: AiConversationSummary) => {
    setRenamingId(conversation.id);
    setRenameDraft(conversationTitle(conversation));
  }, []);

  const handleSelect = useCallback(
    async (conversationId: string) => {
      if (isRenaming) {
        return;
      }
      onClose();
      if (conversationId === activeConversationId) {
        return;
      }
      onClearDraft();
      await switchConversation(conversationId);
    },
    [activeConversationId, isRenaming, onClearDraft, onClose, switchConversation],
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

  const handleContextMenu = useCallback(
    async (event: ReactMouseEvent, conversation: AiConversationSummary) => {
      event.preventDefault();
      event.stopPropagation();
      if (isRenaming) {
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
          startRename(conversation);
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
    [
      archiveConversation,
      deleteConversation,
      isRenaming,
      refreshList,
      startRename,
      unarchiveConversation,
    ],
  );

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (isRenaming) {
        return;
      }
      onSearchKeyDown(event);
    },
    [isRenaming, onSearchKeyDown],
  );

  const emptyMessage = useMemo(
    () => historyEmptyMessage({ loadingList, isSearching, includeArchived }),
    [includeArchived, isSearching, loadingList],
  );

  const shouldSuppressDismiss = useCallback(() => suppressDismissRef.current, []);

  const toggleIncludeArchived = useCallback(() => {
    setIncludeArchived((current) => !current);
  }, []);

  return {
    activeConversationId,
    query,
    setQuery,
    includeArchived,
    toggleIncludeArchived,
    listEntries,
    selectableCount: selectableItems.length,
    loadingList,
    emptyMessage,
    renamingId,
    renameDraft,
    setRenameDraft,
    searchInputRef,
    renameInputRef,
    listRef,
    highlightIndex,
    setHighlightIndex,
    handleSearchKeyDown,
    handleSelect,
    handleContextMenu,
    commitRename,
    cancelRename,
    shouldSuppressDismiss,
    resetClosedState,
  };
}

export type AiChatHistoryListController = ReturnType<typeof useAiChatHistoryList>;
