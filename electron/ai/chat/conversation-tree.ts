import type { InputItem } from "@codehz/ai";

import { cloneAiChatMessage } from "#shared/rpc/ai/index";
import type {
  AiChatAssistantMessage,
  AiChatMessage,
  AiChatMessageBranch,
  AiChatUserMessage,
} from "#shared/rpc/ai/index";

/** Tree node: UI message + structural links + model-history segment for this node. */
export type ConversationMessageNode = {
  id: string;
  parentId: string | null;
  /** Selected child on the active path; null means this node is the path leaf. */
  selectedChildId: string | null;
  role: "user" | "assistant";
  message: AiChatMessage;
  /** Model history items introduced by this node (user item / assistant replay+tools). */
  historyItems: InputItem[];
};

export type ConversationTree = {
  /** Selected root among root siblings (edit-first-user creates multiple roots). */
  rootSelectedId: string | null;
  nodes: Map<string, ConversationMessageNode>;
};

export type ConversationTreeDocumentV2 = {
  version: 2;
  rootSelectedId: string | null;
  nodes: Array<{
    id: string;
    parentId: string | null;
    selectedChildId: string | null;
    role: "user" | "assistant";
    message: AiChatMessage;
    historyItems: InputItem[];
  }>;
};

export function createEmptyConversationTree(): ConversationTree {
  return {
    rootSelectedId: null,
    nodes: new Map(),
  };
}

export function cloneInputItems(items: readonly InputItem[]): InputItem[] {
  // InputItem is a plain JSON-serializable union; structuredClone is safest for nested content.
  return structuredClone(items) as InputItem[];
}

export function getChildren(
  tree: ConversationTree,
  parentId: string | null,
): ConversationMessageNode[] {
  const children: ConversationMessageNode[] = [];
  for (const node of tree.nodes.values()) {
    if (node.parentId === parentId) {
      children.push(node);
    }
  }
  // Stable order by insertion is Map iteration order (append order).
  return children;
}

export function getSiblingMeta(tree: ConversationTree, nodeId: string): AiChatMessageBranch | null {
  const node = tree.nodes.get(nodeId);
  if (!node) {
    return null;
  }
  const siblings = getChildren(tree, node.parentId);
  if (siblings.length === 0) {
    return null;
  }
  const index = siblings.findIndex((sibling) => sibling.id === nodeId);
  if (index < 0) {
    return null;
  }
  return { index, count: siblings.length };
}

/** Active path from selected root to leaf following selectedChildId. */
export function projectActivePath(tree: ConversationTree): ConversationMessageNode[] {
  const path: ConversationMessageNode[] = [];
  let currentId = tree.rootSelectedId;
  const seen = new Set<string>();
  while (currentId) {
    if (seen.has(currentId)) {
      break;
    }
    seen.add(currentId);
    const node = tree.nodes.get(currentId);
    if (!node) {
      break;
    }
    path.push(node);
    currentId = node.selectedChildId;
  }
  return path;
}

export function concatPathHistory(path: readonly ConversationMessageNode[]): InputItem[] {
  const history: InputItem[] = [];
  for (const node of path) {
    history.push(...node.historyItems);
  }
  return history;
}

export function concatActiveHistory(tree: ConversationTree): InputItem[] {
  return concatPathHistory(projectActivePath(tree));
}

export function getPathLeaf(tree: ConversationTree): ConversationMessageNode | null {
  const path = projectActivePath(tree);
  return path.length === 0 ? null : (path[path.length - 1] ?? null);
}

export function projectActiveMessages(tree: ConversationTree): AiChatMessage[] {
  return projectActivePath(tree).map((node) => {
    const branch = getSiblingMeta(tree, node.id);
    const cloned = cloneAiChatMessage(node.message);
    if (branch && branch.count > 1) {
      return { ...cloned, branch };
    }
    // Always attach count=1 branch for a stable wire shape once UI lands; omit when alone.
    return cloned;
  });
}

export function listAllMessages(tree: ConversationTree): AiChatMessage[] {
  return [...tree.nodes.values()].map((node) => cloneAiChatMessage(node.message));
}

export function addChildNode(
  tree: ConversationTree,
  parentId: string | null,
  message: AiChatMessage,
  options?: { select?: boolean; historyItems?: readonly InputItem[] },
): ConversationMessageNode {
  const select = options?.select !== false;
  if (parentId === null) {
    if (message.role !== "user") {
      throw new Error("根节点必须是用户消息。");
    }
  } else {
    const parent = tree.nodes.get(parentId);
    if (!parent) {
      throw new Error("找不到父消息节点。");
    }
    if (parent.role === "user" && message.role !== "assistant") {
      throw new Error("用户消息的子节点必须是助手消息。");
    }
    if (parent.role === "assistant" && message.role !== "user") {
      throw new Error("助手消息的子节点必须是用户消息。");
    }
  }

  const node: ConversationMessageNode = {
    id: message.id,
    parentId,
    selectedChildId: null,
    role: message.role,
    message: cloneAiChatMessage(message),
    historyItems: cloneInputItems(options?.historyItems ?? []),
  };
  tree.nodes.set(node.id, node);

  if (parentId === null) {
    if (select || tree.rootSelectedId === null) {
      tree.rootSelectedId = node.id;
    }
  } else if (select) {
    const parent = tree.nodes.get(parentId)!;
    parent.selectedChildId = node.id;
  }

  return node;
}

/**
 * Truncate the active selection at `nodeId` (must be on active path).
 * Keeps descendant nodes; only clears the selectedChildId chain from this node.
 */
export function truncateSelectionAt(tree: ConversationTree, nodeId: string): boolean {
  const path = projectActivePath(tree);
  const index = path.findIndex((node) => node.id === nodeId);
  if (index < 0) {
    return false;
  }
  const node = path[index]!;
  node.selectedChildId = null;
  return true;
}

/**
 * Select sibling at `index` among the siblings of `nodeId` (or of a node sharing parent).
 * `nodeId` identifies the sibling group via its parentId.
 */
export function selectSiblingByIndex(
  tree: ConversationTree,
  nodeId: string,
  index: number,
): boolean {
  const node = tree.nodes.get(nodeId);
  if (!node) {
    return false;
  }
  const siblings = getChildren(tree, node.parentId);
  if (index < 0 || index >= siblings.length) {
    return false;
  }
  const selected = siblings[index]!;
  if (node.parentId === null) {
    tree.rootSelectedId = selected.id;
  } else {
    const parent = tree.nodes.get(node.parentId);
    if (!parent) {
      return false;
    }
    parent.selectedChildId = selected.id;
  }
  return true;
}

/**
 * Rewrite historyItems on the active path so concat equals `history`.
 * User nodes take leading user message items; assistant nodes take until the next user item.
 */
export function distributeHistoryToActivePath(
  tree: ConversationTree,
  history: readonly InputItem[],
): void {
  const path = projectActivePath(tree);
  for (const node of path) {
    node.historyItems = [];
  }

  let pathIndex = 0;
  let historyIndex = 0;
  while (pathIndex < path.length && historyIndex < history.length) {
    const node = path[pathIndex]!;
    if (node.role === "user") {
      const item = history[historyIndex]!;
      if (item.type === "message" && item.role === "user") {
        node.historyItems.push(item);
        historyIndex += 1;
      }
      // Advance even on mismatch so we don't stick forever.
      pathIndex += 1;
      continue;
    }

    while (historyIndex < history.length) {
      const item = history[historyIndex]!;
      if (item.type === "message" && item.role === "user") {
        break;
      }
      node.historyItems.push(item);
      historyIndex += 1;
    }
    pathIndex += 1;
  }

  // Orphan trailing items attach to the last path node when present.
  if (historyIndex < history.length && path.length > 0) {
    const last = path[path.length - 1]!;
    while (historyIndex < history.length) {
      last.historyItems.push(history[historyIndex]!);
      historyIndex += 1;
    }
  }
}

/**
 * Build a single-path tree from a linear message list + flat history (v1 storage).
 */
export function migrateLinearToTree(
  messages: readonly AiChatMessage[],
  history: readonly InputItem[],
): ConversationTree {
  const tree = createEmptyConversationTree();
  let parentId: string | null = null;
  for (const message of messages) {
    const node = addChildNode(tree, parentId, message, { select: true });
    parentId = node.id;
  }
  distributeHistoryToActivePath(tree, history);
  return tree;
}

export function serializeConversationTree(tree: ConversationTree): ConversationTreeDocumentV2 {
  return {
    version: 2,
    rootSelectedId: tree.rootSelectedId,
    nodes: [...tree.nodes.values()].map((node) => ({
      id: node.id,
      parentId: node.parentId,
      selectedChildId: node.selectedChildId,
      role: node.role,
      message: cloneAiChatMessage(node.message),
      historyItems: cloneInputItems(node.historyItems),
    })),
  };
}

function isUserMessage(value: AiChatMessage): value is AiChatUserMessage {
  return value.role === "user";
}

function isAssistantMessage(value: AiChatMessage): value is AiChatAssistantMessage {
  return value.role === "assistant";
}

/**
 * Parse messages_json: v2 tree document or v1 linear array.
 * When v1, `historyJson` is used to segment history onto the path.
 */
export function parseConversationMessagesJson(
  messagesJson: string,
  historyJson: string,
  normalizeMessage: (entry: unknown) => AiChatMessage,
): ConversationTree {
  let parsed: unknown;
  try {
    parsed = JSON.parse(messagesJson) as unknown;
  } catch {
    return createEmptyConversationTree();
  }

  if (Array.isArray(parsed)) {
    const messages = parsed.map((entry) => normalizeMessage(entry));
    let history: InputItem[] = [];
    try {
      const historyParsed = JSON.parse(historyJson) as unknown;
      if (Array.isArray(historyParsed)) {
        history = historyParsed as InputItem[];
      }
    } catch {
      history = [];
    }
    return migrateLinearToTree(messages, history);
  }

  if (parsed == null || typeof parsed !== "object") {
    return createEmptyConversationTree();
  }

  const doc = parsed as Record<string, unknown>;
  if (doc.version !== 2 || !Array.isArray(doc.nodes)) {
    return createEmptyConversationTree();
  }

  const tree = createEmptyConversationTree();
  tree.rootSelectedId = typeof doc.rootSelectedId === "string" ? doc.rootSelectedId : null;

  for (const entry of doc.nodes) {
    if (entry == null || typeof entry !== "object") {
      continue;
    }
    const raw = entry as Record<string, unknown>;
    if (typeof raw.id !== "string") {
      continue;
    }
    const message = normalizeMessage(raw.message ?? raw);
    if (message.id !== raw.id) {
      // Prefer stored structural id.
      message.id = raw.id;
    }
    const role = message.role;
    if (role !== "user" && role !== "assistant") {
      continue;
    }
    if (role === "user" && !isUserMessage(message)) {
      continue;
    }
    if (role === "assistant" && !isAssistantMessage(message)) {
      continue;
    }
    const historyItems = Array.isArray(raw.historyItems) ? (raw.historyItems as InputItem[]) : [];
    const node: ConversationMessageNode = {
      id: raw.id,
      parentId: typeof raw.parentId === "string" ? raw.parentId : null,
      selectedChildId: typeof raw.selectedChildId === "string" ? raw.selectedChildId : null,
      role,
      message: cloneAiChatMessage(message),
      historyItems: cloneInputItems(historyItems),
    };
    tree.nodes.set(node.id, node);
  }

  // Drop dangling root selection.
  if (tree.rootSelectedId && !tree.nodes.has(tree.rootSelectedId)) {
    tree.rootSelectedId = null;
  }
  // Prefer a root user if selection missing.
  if (tree.rootSelectedId === null) {
    for (const node of tree.nodes.values()) {
      if (node.parentId === null && node.role === "user") {
        tree.rootSelectedId = node.id;
        break;
      }
    }
  }

  return tree;
}

export function getNodeMessage(tree: ConversationTree, id: string): AiChatMessage | null {
  return tree.nodes.get(id)?.message ?? null;
}

export function setNodeMessage(
  tree: ConversationTree,
  id: string,
  message: AiChatMessage,
): boolean {
  const node = tree.nodes.get(id);
  if (!node) {
    return false;
  }
  node.message = cloneAiChatMessage(message);
  node.role = message.role;
  return true;
}
