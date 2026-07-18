import { describe, expect, test } from "bun:test";

import type { InputItem } from "@codehz/ai";

import type { AiChatAssistantMessage, AiChatUserMessage } from "#shared/rpc/ai/index";

import {
  addChildNode,
  concatActiveHistory,
  createEmptyConversationTree,
  distributeHistoryToActivePath,
  getContinuationMeta,
  getSiblingMeta,
  migrateLinearToTree,
  parseConversationMessagesJson,
  projectActiveMessages,
  projectActivePath,
  selectChildByIndex,
  selectSiblingByIndex,
  serializeConversationTree,
  truncateSelectionAt,
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

describe("migrateLinearToTree", () => {
  test("chains messages and segments history", () => {
    const messages = [
      userMessage("u1", "hi"),
      assistantMessage("a1", "hello"),
      userMessage("u2", "next"),
      assistantMessage("a2", "ok"),
    ];
    const history: InputItem[] = [
      userItem("hi"),
      assistantItem("hello"),
      userItem("next"),
      assistantItem("ok"),
    ];
    const tree = migrateLinearToTree(messages, history);
    const path = projectActivePath(tree);
    expect(path.map((node) => node.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(path[0]!.historyItems).toEqual([userItem("hi")]);
    expect(path[1]!.historyItems).toEqual([assistantItem("hello")]);
    expect(path[2]!.historyItems).toEqual([userItem("next")]);
    expect(path[3]!.historyItems).toEqual([assistantItem("ok")]);
    expect(concatActiveHistory(tree)).toEqual(history);
  });
});

describe("fork and branch navigation", () => {
  test("truncateSelectionAt clears chain without deleting nodes", () => {
    const tree = migrateLinearToTree(
      [userMessage("u1", "hi"), assistantMessage("a1", "hello"), userMessage("u2", "next")],
      [userItem("hi"), assistantItem("hello"), userItem("next")],
    );
    expect(truncateSelectionAt(tree, "a1")).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1"]);
    expect(tree.nodes.has("u2")).toBe(true);
  });

  test("send-style sibling + selectSiblingByIndex switches path", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"));
    addChildNode(tree, "u1", assistantMessage("a1", "v1"));
    // New sibling assistant under same user (regen-style).
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
  });

  test("fork projects continuation; selectChildByIndex restores preferred path", () => {
    const tree = migrateLinearToTree(
      [
        userMessage("u1", "hi"),
        assistantMessage("a1", "hello"),
        userMessage("u2", "next"),
        assistantMessage("a2", "ok"),
      ],
      [userItem("hi"), assistantItem("hello"), userItem("next"), assistantItem("ok")],
    );
    expect(truncateSelectionAt(tree, "a1")).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1"]);
    expect(getContinuationMeta(tree, "a1")).toEqual({ count: 1, preferredIndex: 0 });
    const afterFork = projectActiveMessages(tree);
    expect(afterFork[1]?.continuation).toEqual({ count: 1, preferredIndex: 0 });
    expect(afterFork[1]?.branch).toBeUndefined();

    expect(selectChildByIndex(tree, "a1", 0)).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(getContinuationMeta(tree, "a1")).toBeNull();
    expect(projectActiveMessages(tree)[1]?.continuation).toBeUndefined();
  });

  test("multi continuation preferredIndex tracks lastSelectedChildId", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"));
    addChildNode(tree, "u1", assistantMessage("a1", "hello"));
    addChildNode(tree, "a1", userMessage("u2", "old"));
    addChildNode(tree, "u2", assistantMessage("a2", "old reply"));
    // Fork at a1 then send alternate path.
    expect(truncateSelectionAt(tree, "a1")).toBe(true);
    addChildNode(tree, "a1", userMessage("u3", "new"), { select: true });
    addChildNode(tree, "u3", assistantMessage("a3", "new reply"), { select: true });
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1", "u3", "a3"]);
    // Fork again: preferred should be the last selected child u3 (index 1).
    expect(truncateSelectionAt(tree, "a1")).toBe(true);
    expect(getContinuationMeta(tree, "a1")).toEqual({ count: 2, preferredIndex: 1 });
    expect(selectChildByIndex(tree, "a1", 1)).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1", "u3", "a3"]);
    expect(selectChildByIndex(tree, "a1", 0)).toBe(true);
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });
});

describe("distributeHistoryToActivePath", () => {
  test("rewrites segments on replaceHistory semantics", () => {
    const tree = migrateLinearToTree(
      [userMessage("u1", "hi"), assistantMessage("a1", "old")],
      [userItem("hi"), assistantItem("old")],
    );
    distributeHistoryToActivePath(tree, [userItem("hi"), assistantItem("new")]);
    expect(concatActiveHistory(tree)).toEqual([userItem("hi"), assistantItem("new")]);
    expect(projectActivePath(tree)[1]!.historyItems).toEqual([assistantItem("new")]);
  });
});

describe("serialize / parse v2", () => {
  test("round-trips tree document", () => {
    const tree = createEmptyConversationTree();
    addChildNode(tree, null, userMessage("u1", "hi"), {
      historyItems: [userItem("hi")],
    });
    addChildNode(tree, "u1", assistantMessage("a1", "hello"), {
      historyItems: [assistantItem("hello")],
    });
    const doc = serializeConversationTree(tree);
    const json = JSON.stringify(doc);
    const restored = parseConversationMessagesJson(json, "[]", (entry) => {
      if (entry && typeof entry === "object" && "role" in entry) {
        return entry as AiChatUserMessage | AiChatAssistantMessage;
      }
      throw new Error("bad");
    });
    expect(projectActivePath(restored).map((node) => node.id)).toEqual(["u1", "a1"]);
    expect(concatActiveHistory(restored)).toEqual([userItem("hi"), assistantItem("hello")]);
  });

  test("parses v1 linear array with history", () => {
    const messages = [userMessage("u1", "hi"), assistantMessage("a1", "hello")];
    const history = [userItem("hi"), assistantItem("hello")];
    const tree = parseConversationMessagesJson(
      JSON.stringify(messages),
      JSON.stringify(history),
      (entry) => entry as AiChatUserMessage | AiChatAssistantMessage,
    );
    expect(projectActivePath(tree).map((node) => node.id)).toEqual(["u1", "a1"]);
    expect(concatActiveHistory(tree)).toEqual(history);
  });
});
