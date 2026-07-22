import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AiAgentConfigPublic, AiAgentConfigWrite } from "#shared/rpc/services/index";
import {
  BUILTIN_AI_AGENT_ID,
  BUILTIN_AI_AGENT_IDS,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
} from "#shared/rpc/services/index";

import { AiAgentsStore } from "./ai-agents-store";
import type { AiModelsStore } from "./ai-models-store";

const temporaryDirectories: string[] = [];

function createStore(filePath?: string): { filePath: string; store: AiAgentsStore } {
  const directory = filePath ? null : mkdtempSync(join(tmpdir(), "novelevolver-ai-agents-"));
  if (directory) {
    temporaryDirectories.push(directory);
  }
  const resolvedFilePath = filePath ?? join(directory!, "ai-agents.json");
  const modelsStore = {
    getSnapshot: () => ({ models: [] }),
  } as unknown as AiModelsStore;
  return {
    filePath: resolvedFilePath,
    store: new AiAgentsStore(resolvedFilePath, () => modelsStore),
  };
}

function toWrite(
  agent: AiAgentConfigPublic,
  systemPrompt = agent.systemPrompt,
): AiAgentConfigWrite {
  return {
    id: agent.id,
    name: agent.name,
    systemPrompt,
    defaultModelId: agent.defaultModelId,
    availableToolNames: agent.availableToolNames,
    userSelectable: agent.userSelectable,
    subagentEligible: agent.subagentEligible,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("AiAgentsStore builtin system prompt overrides", () => {
  test("returns code defaults for all builtin agents", () => {
    const { store } = createStore();
    const builtinAgents = store.getSnapshot().agents.filter((agent) => agent.builtin);

    expect(builtinAgents.map((agent) => agent.id)).toEqual([...BUILTIN_AI_AGENT_IDS]);
    for (const agent of builtinAgents) {
      expect(agent.defaultSystemPrompt).not.toBeNull();
      expect(agent.systemPrompt).toBe(agent.defaultSystemPrompt!);
    }
  });

  test("persists an override and uses it for runtime resolution", () => {
    const { filePath, store } = createStore();
    const builtin = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert(toWrite(builtin, "  自定义一致性审查提示词。  "));

    expect(store.getRuntimeConfig(builtin.id).systemPrompt).toBe("自定义一致性审查提示词。");
    expect(store.findRuntimeConfig(builtin.id)?.defaultSystemPrompt).toBe(
      builtin.defaultSystemPrompt,
    );

    const reloaded = createStore(filePath).store;
    expect(reloaded.getRuntimeConfig(builtin.id).systemPrompt).toBe("自定义一致性审查提示词。");
  });

  test("removes the override when saving the code default", () => {
    const { filePath, store } = createStore();
    const builtin = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert(toWrite(builtin, "自定义一致性审查提示词。"));
    store.upsert(toWrite(builtin, builtin.defaultSystemPrompt!));

    expect(store.getRuntimeConfig(builtin.id).systemPrompt).toBe(builtin.defaultSystemPrompt!);
    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as {
      builtinSystemPromptOverrides: Record<string, string>;
    };
    expect(persisted.builtinSystemPromptOverrides[builtin.id]).toBeUndefined();
  });

  test("rejects a blank builtin system prompt", () => {
    const { store } = createStore();
    const builtin = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    expect(() => store.upsert(toWrite(builtin, "   \n"))).toThrow("系统提示词不能为空。");
  });

  test("keeps custom agent persistence unchanged", () => {
    const { filePath, store } = createStore();
    const snapshot = store.upsert({
      name: "自定义写手",
      systemPrompt: "按指定风格写作。",
      defaultModelId: null,
      availableToolNames: ["read_document"],
      userSelectable: true,
      subagentEligible: false,
    });
    const custom = snapshot.agents.find((agent) => !agent.builtin)!;

    expect(custom.defaultSystemPrompt).toBeNull();
    expect(createStore(filePath).store.findRuntimeConfig(custom.id)).toEqual(custom);
  });
});

describe("AiAgentsStore builtin channel overrides", () => {
  test("returns code-default channel flags for builtin agents", () => {
    const { store } = createStore();
    const writing = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;
    const reviewer = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    expect(writing.userSelectable).toBe(true);
    expect(writing.subagentEligible).toBe(false);
    expect(reviewer.userSelectable).toBe(false);
    expect(reviewer.subagentEligible).toBe(true);
  });

  test("persists channel overrides and reloads them", () => {
    const { filePath, store } = createStore();
    const writing = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;

    store.upsert({
      ...toWrite(writing),
      userSelectable: false,
      subagentEligible: true,
    });

    const updated = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;
    expect(updated.userSelectable).toBe(false);
    expect(updated.subagentEligible).toBe(true);

    const reloaded = createStore(filePath).store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;
    expect(reloaded.userSelectable).toBe(false);
    expect(reloaded.subagentEligible).toBe(true);
  });

  test("removes channel override when saving code defaults", () => {
    const { filePath, store } = createStore();
    const writing = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;

    store.upsert({
      ...toWrite(writing),
      userSelectable: false,
      subagentEligible: true,
    });
    store.upsert(toWrite(writing));

    const restored = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;
    expect(restored.userSelectable).toBe(true);
    expect(restored.subagentEligible).toBe(false);

    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as {
      builtinChannelOverrides: Record<string, unknown>;
    };
    expect(persisted.builtinChannelOverrides[writing.id]).toBeUndefined();
  });

  test("ignores name and tool list changes for builtin agents", () => {
    const { store } = createStore();
    const writing = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;

    store.upsert({
      ...toWrite(writing),
      name: "改名应被忽略",
      availableToolNames: ["read_document"],
      userSelectable: false,
    });

    const updated = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;
    expect(updated.name).toBe(writing.name);
    expect(updated.availableToolNames).toEqual(writing.availableToolNames);
    expect(updated.userSelectable).toBe(false);
  });
});
