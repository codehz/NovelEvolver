import type { InputItem } from "@codehz/ai";
import { cloneAiChatMessage } from "@novelevolver/domain/ai";
import type {
  AiChatAssistantMessage,
  AiChatMessage,
  AiChatMessageBranch,
  AiChatUserMessage,
} from "@novelevolver/domain/ai";

/** Tree node: UI message + structural links + model-history segment for this node. */
export type ConversationMessageNode = {
  id: string;
  parentId: string | null;
  /** Selected child on the active path; null means this node is a leaf (no children). */
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

export type ConversationTreeDocumentV3 = {
  version: 3;
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
 * Hard invariants for sibling-tree single-axis model.
 * Throws when the tree is corrupt or violates "children ⇒ selectedChildId".
 */
export function assertTreeInvariants(tree: ConversationTree): void {
  if (tree.rootSelectedId != null) {
    const root = tree.nodes.get(tree.rootSelectedId);
    if (!root) {
      throw new Error("会话树根选择指向不存在的节点。");
    }
    if (root.parentId !== null) {
      throw new Error("会话树根选择必须是根节点。");
    }
    if (root.role !== "user") {
      throw new Error("会话树根节点必须是用户消息。");
    }
  }

  for (const node of tree.nodes.values()) {
    if (node.role !== "user" && node.role !== "assistant") {
      throw new Error(`会话树节点角色非法：${node.id}`);
    }
    if (node.parentId === null) {
      if (node.role !== "user") {
        throw new Error(`根节点必须是用户消息：${node.id}`);
      }
    } else {
      const parent = tree.nodes.get(node.parentId);
      if (!parent) {
        throw new Error(`会话树节点父引用无效：${node.id}`);
      }
      if (parent.role === "user" && node.role !== "assistant") {
        throw new Error(`用户消息的子节点必须是助手：${node.id}`);
      }
      if (parent.role === "assistant" && node.role !== "user") {
        throw new Error(`助手消息的子节点必须是用户：${node.id}`);
      }
    }

    const children = getChildren(tree, node.id);
    if (children.length === 0) {
      if (node.selectedChildId != null) {
        throw new Error(`无子节点时 selectedChildId 必须为空：${node.id}`);
      }
    } else {
      if (node.selectedChildId == null) {
        throw new Error(`有子节点时必须选中其中一个：${node.id}`);
      }
      const selected = tree.nodes.get(node.selectedChildId);
      if (!selected || selected.parentId !== node.id) {
        throw new Error(`selectedChildId 必须指向直接子节点：${node.id}`);
      }
    }
  }
}

export function serializeConversationTree(tree: ConversationTree): ConversationTreeDocumentV3 {
  return {
    version: 3,
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
 * Parse messages_json as v3 tree document only.
 * v1 arrays / v2 docs / corrupt data throw (no silent migration).
 * `historyJson` is ignored (kept for call-site stability).
 */
export function parseConversationMessagesJson(
  messagesJson: string,
  _historyJson: string,
  normalizeMessage: (entry: unknown) => AiChatMessage,
): ConversationTree {
  let parsed: unknown;
  try {
    parsed = JSON.parse(messagesJson) as unknown;
  } catch {
    throw new Error("会话消息 JSON 无法解析。");
  }

  if (Array.isArray(parsed)) {
    throw new Error("不支持的会话消息格式（线性 v1）。");
  }
  if (parsed == null || typeof parsed !== "object") {
    throw new Error("不支持的会话消息格式。");
  }

  const doc = parsed as Record<string, unknown>;
  if (doc.version !== 3 || !Array.isArray(doc.nodes)) {
    throw new Error("不支持的会话消息格式（需要 version: 3）。");
  }

  const tree = createEmptyConversationTree();
  tree.rootSelectedId = typeof doc.rootSelectedId === "string" ? doc.rootSelectedId : null;

  for (const entry of doc.nodes) {
    if (entry == null || typeof entry !== "object") {
      throw new Error("会话树节点条目非法。");
    }
    const raw = entry as Record<string, unknown>;
    if (typeof raw.id !== "string") {
      throw new Error("会话树节点缺少 id。");
    }
    const message = normalizeMessage(raw.message ?? raw);
    if (message.id !== raw.id) {
      message.id = raw.id;
    }
    const role = message.role;
    if (role !== "user" && role !== "assistant") {
      throw new Error(`会话树节点角色非法：${raw.id}`);
    }
    if (role === "user" && !isUserMessage(message)) {
      throw new Error(`用户消息结构非法：${raw.id}`);
    }
    if (role === "assistant" && !isAssistantMessage(message)) {
      throw new Error(`助手消息结构非法：${raw.id}`);
    }
    const historyItems = Array.isArray(raw.historyItems) ? (raw.historyItems as InputItem[]) : [];
    const selectedChildId = typeof raw.selectedChildId === "string" ? raw.selectedChildId : null;
    const node: ConversationMessageNode = {
      id: raw.id,
      parentId: typeof raw.parentId === "string" ? raw.parentId : null,
      selectedChildId,
      role,
      message: cloneAiChatMessage(message),
      historyItems: cloneInputItems(historyItems),
    };
    tree.nodes.set(node.id, node);
  }

  assertTreeInvariants(tree);
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
