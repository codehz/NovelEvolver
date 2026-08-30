import { describe, expect, test } from "bun:test";

import type { InputItem } from "@codehz/ai";

import type { AiChatAssistantMessage, AiChatUserMessage } from "#domain/ai";

import {
  addChildNode,
  assertTreeInvariants,
  concatActiveHistory,
  createEmptyConversationTree,
  distributeHistoryToActivePath,
  getSiblingMeta,
  parseConversationMessagesJson,
  projectActiveMessages,
  projectActivePath,
  selectSiblingByIndex,
  serializeConversationTree,
} from "./conversation-tree";

function userMessage(id: string, text: string): AiChatUserMessage {
  return {
    id,
    role: "user",
    text,
    slash: null,
    mentions: [],
    status: "complete",
  };
}

function assistantMessage(id: string, text: string): AiChatAssistantMessage {
  return {
    id,
    role: "assistant",
    status: "complete",
    modelName: "mock",
    usage: null,
    parts: [{ id: `${id}-p`, type: "message", text, status: "complete" }],
  };
}

function userItem(text: string): InputItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "text", text }],
  };
}

function assistantItem(text: string): InputItem {
  return {
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
  };
}

function buildLinearPath(): ReturnType<typeof createEmptyConversationTree> {
  const tree = createEmptyConversationTree();
  addChildNode(tree, null, userMessage("u1", "hi"), { historyItems: [userItem("hi")] });
  addChildNode(tree, "u1", assistantMessage("a1", "hello"), {
    historyItems: [assistantItem("hello")],
  });
  addChildNode(tree, "a1", userMessage("u2", "next"), { historyItems: [userItem("next")] });
  addChildNode(tree, "u2", assistantMessage("a2", "ok"), { historyItems: [assistantItem("ok")] });
  return tree;
}

describe("sibling tree navigation", () => {
  test("selectSiblingByIndex switches assistant versions", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"));
    addChildNode(tree, "u1", assistantMessage("a1", "v1"));
    addChildNode(tree, "u1", assistantMessage("a1b", "v2"), { select: true });
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1b"]);
    expect(getSiblingMeta(tree, "a1b")).toEqual({ index: 1, count: 2 });

    expect(selectSiblingByIndex(tree, "a1b", 0)).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1"]);
    expect(getSiblingMeta(tree, "a1")).toEqual({ index: 0, count: 2 });
  });

  test("projectActiveMessages attaches branch only when count > 1", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"));
    addChildNode(tree, "u1", assistantMessage("a1", "v1"));
    addChildNode(tree, "u1", assistantMessage("a1b", "v2"), { select: true });
    const projected = projectActiveMessages(tree);
    expect(projected[0]?.branch).toBeUndefined();
    expect(projected[1]?.branch).toEqual({ index: 1, count: 2 });
    expect((projected[1] as { continuation?: unknown }).continuation).toBeUndefined();
  });

  test("user sibling edit path switches with selectSiblingByIndex", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"));
    addChildNode(tree, "u1", assistantMessage("a1", "hello"));
    addChildNode(tree, "a1", userMessage("u2", "old"));
    addChildNode(tree, "u2", assistantMessage("a2", "old reply"));
    addChildNode(tree, "a1", userMessage("u3", "new"), { select: true });
    addChildNode(tree, "u3", assistantMessage("a3", "new reply"), { select: true });
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1", "u3", "a3"]);
    expect(getSiblingMeta(tree, "u3")).toEqual({ index: 1, count: 2 });
    expect(selectSiblingByIndex(tree, "u3", 0)).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });
});

describe("distributeHistoryToActivePath", () => {
  test("rewrites segments on replaceHistory semantics", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"), { historyItems: [userItem("hi")] });
    addChildNode(tree, "u1", assistantMessage("a1", "old"), {
      historyItems: [assistantItem("old")],
    });
    distributeHistoryToActivePath(tree, [userItem("hi"), assistantItem("new")]);
    expect(concatActiveHistory(tree)).toEqual([userItem("hi"), assistantItem("new")]);
    expect(projectActivePath(tree)[1]!.historyItems).toEqual([assistantItem("new")]);
  });
});

describe("serialize / parse v3", () => {
  test("round-trips tree document", () => {
    const tree = buildLinearPath();
    const doc = serializeConversationTree(tree);
    expect(doc.version).toBe(3);
    const json = JSON.stringify(doc);
    const restored = parseConversationMessagesJson(json, "[]", (entry) => {
      if (entry && typeof entry === "object" && "role" in entry) {
        return entry as AiChatUserMessage | AiChatAssistantMessage;
      }
      throw new Error("bad");
    });
    expect(projectActivePath(restored).map((node) => node.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(concatActiveHistory(restored)).toEqual([
      userItem("hi"),
      assistantItem("hello"),
      userItem("next"),
      assistantItem("ok"),
    ]);
  });

  test("rejects v1 linear array", () => {
    expect(() =>
      parseConversationMessagesJson(
        JSON.stringify([userMessage("u1", "hi")]),
        "[]",
        (entry) => entry as AiChatUserMessage,
      ),
    ).toThrow(/不支持的会话消息格式/);
  });

  test("rejects v2 document", () => {
    const payload = {
      version: 2,
      rootSelectedId: "u1",
      nodes: [
        {
          id: "u1",
          parentId: null,
          selectedChildId: null,
          role: "user",
          message: userMessage("u1", "hi"),
          historyItems: [],
        },
      ],
    };
    expect(() =>
      parseConversationMessagesJson(JSON.stringify(payload), "[]", (entry) => {
        return (entry as { message?: AiChatUserMessage }).message ?? (entry as AiChatUserMessage);
      }),
    ).toThrow(/version: 3/);
  });

  test("rejects truncated selectedChildId invariant", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"));
    addChildNode(tree, "u1", assistantMessage("a1", "hello"));
    // Force illegal truncate: has child but selectedChildId null.
    tree.nodes.get("u1")!.selectedChildId = null;
    expect(() => assertTreeInvariants(tree)).toThrow(/有子节点时必须选中/);
  });
});
