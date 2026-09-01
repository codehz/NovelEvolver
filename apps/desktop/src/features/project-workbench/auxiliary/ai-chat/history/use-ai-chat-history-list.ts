import type { AiConversationSearchHit, AiConversationSummary } from "@novelevolver/domain/ai";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useAiConversations } from "#app/features/project-workbench/session/workspace-handles";
import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import { popupContextMenu } from "#app/shared/lib/shell/popup-context-menu";

import { useSelectorListNavigation } from "../selectors/use-selector-list-navigation";
import { useAiChatActions, useAiChatConversationId } from "../state/use-ai-chat-state";
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
  const activeConversationId = useAiChatConversationId();
  const conversations = useAiConversations();
  const {
    searchConversations,
    switchConversation,
    renameConversation,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
  } = useAiChatActions();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const suppressDismissRef = useRef(false);
  const requestSeqRef = useRef(0);

  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [directoryItems, setDirectoryItems] = useState<AiConversationSummary[]>([]);
  const [searchItems, setSearchItems] = useState<AiConversationSearchHit[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

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

  // Directory feed: always live while the history panel is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    setDirectoryLoading(true);
    return consumeRpcSubscription({
      subscribe: () => conversations.subscribe(),
      onValue: (event) => {
        setDirectoryItems(event.snapshot.conversations);
        setDirectoryLoading(false);
      },
      onError: () => {
        setDirectoryLoading(false);
      },
      cancelReason: "AI conversation directory subscription disposed.",
    });
  }, [conversations, open]);

  // Search remains pull-based.
  useEffect(() => {
    if (!open || !isSearching) {
      setSearchItems([]);
      setSearchLoading(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setSearchLoading(true);
    void searchConversations(debouncedQuery.trim(), { includeArchived })
      .then((nextItems) => {
        if (seq !== requestSeqRef.current) {
          return;
        }
        setSearchItems(nextItems);
      })
      .finally(() => {
        if (seq === requestSeqRef.current) {
          setSearchLoading(false);
        }
      });
  }, [debouncedQuery, includeArchived, isSearching, open, searchConversations]);

  const items = useMemo((): AiConversationSearchHit[] => {
    if (isSearching) {
      return searchItems;
    }
    const filtered = includeArchived
      ? directoryItems
      : directoryItems.filter((entry) => entry.status !== "archived");
    return toSearchHits(filtered);
  }, [directoryItems, includeArchived, isSearching, searchItems]);

  const loadingList = isSearching ? searchLoading : directoryLoading;

  // Keep list content mounted during the exit animation. Reset only after
  // Base UI reports the close transition finished (onOpenChangeComplete).
  const resetClosedState = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setDirectoryItems([]);
    setSearchItems([]);
    setIncludeArchived(false);
    setRenamingId(null);
    setRenameDraft("");
    setDirectoryLoading(true);
    setSearchLoading(false);
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
  }, [items, renameConversation, renameDraft, renamingId]);

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
          return;
        }
        if (actionId === "unarchive") {
          await unarchiveConversation(conversation.id);
          return;
        }
        if (actionId === "delete") {
          const title = conversationTitle(conversation);
          const confirmed = await confirmDialogApi.confirm({
            title: "删除会话",
            description: `确定删除会话「${title}」吗？此操作不可恢复。`,
            confirmLabel: "删除",
            tone: "danger",
          });
          if (!confirmed) {
            return;
          }
          await deleteConversation(conversation.id);
        }
      } finally {
        window.setTimeout(() => {
          suppressDismissRef.current = false;
        }, 0);
      }
    },
    [archiveConversation, deleteConversation, isRenaming, startRename, unarchiveConversation],
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
