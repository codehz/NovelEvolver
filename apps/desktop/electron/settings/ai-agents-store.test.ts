import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
} from "@novelevolver/domain/settings/ai-settings";
import {
  BUILTIN_AI_AGENT_ID,
  BUILTIN_AI_AGENT_IDS,
  BUILTIN_BRAINSTORM_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  BUILTIN_ROLEPLAY_ID,
} from "@novelevolver/domain/settings/ai-settings";

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
    description: agent.description,
    systemPrompt,
    defaultModelId: agent.defaultModelId,
    availableToolNames: agent.availableToolNames,
    userSelectable: agent.userSelectable,
    subagentEligible: agent.subagentEligible,
    textOnlyMode: agent.textOnlyMode,
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
      description: "按风格写作的自定义助手",
      systemPrompt: "按指定风格写作。",
      defaultModelId: null,
      availableToolNames: ["read_document"],
      userSelectable: true,
      subagentEligible: false,
      textOnlyMode: false,
    });
    const custom = snapshot.agents.find((agent) => !agent.builtin)!;

    expect(custom.defaultSystemPrompt).toBeNull();
    expect(custom.defaultDescription).toBeNull();
    expect(custom.description).toBe("按风格写作的自定义助手");
    expect(createStore(filePath).store.findRuntimeConfig(custom.id)).toEqual(custom);
  });
});

describe("AiAgentsStore description", () => {
  test("returns code defaults for builtin agent descriptions", () => {
    const { store } = createStore();
    const writing = store.findRuntimeConfig(BUILTIN_AI_AGENT_ID)!;
    const reviewer = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    expect(writing.defaultDescription).not.toBeNull();
    expect(writing.description).toBe(writing.defaultDescription!);
    expect(writing.description.length).toBeGreaterThan(0);
    expect(reviewer.description).toBe(reviewer.defaultDescription!);
  });

  test("persists builtin description override and reloads", () => {
    const { filePath, store } = createStore();
    const reviewer = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert({
      ...toWrite(reviewer),
      description: "  自定义简介文案。  ",
    });

    expect(store.getRuntimeConfig(reviewer.id).description).toBe("自定义简介文案。");
    expect(store.findRuntimeConfig(reviewer.id)?.defaultDescription).toBe(
      reviewer.defaultDescription,
    );

    const reloaded = createStore(filePath).store;
    expect(reloaded.getRuntimeConfig(reviewer.id).description).toBe("自定义简介文案。");
  });

  test("allows clearing builtin description to empty string", () => {
    const { filePath, store } = createStore();
    const reviewer = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert({
      ...toWrite(reviewer),
      description: "",
    });

    expect(store.getRuntimeConfig(reviewer.id).description).toBe("");
    const reloaded = createStore(filePath).store.findRuntimeConfig(reviewer.id)!;
    expect(reloaded.description).toBe("");
  });

  test("removes description override when saving the code default", () => {
    const { filePath, store } = createStore();
    const reviewer = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert({
      ...toWrite(reviewer),
      description: "临时简介",
    });
    store.upsert({
      ...toWrite(reviewer),
      description: reviewer.defaultDescription!,
    });

    expect(store.getRuntimeConfig(reviewer.id).description).toBe(reviewer.defaultDescription!);
    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as {
      builtinDescriptionOverrides: Record<string, string>;
    };
    expect(persisted.builtinDescriptionOverrides[reviewer.id]).toBeUndefined();
  });

  test("persists multi-line custom description", () => {
    const { filePath, store } = createStore();
    const snapshot = store.upsert({
      name: "多行写手",
      description: "首行\n第二行细节\n  \n第三行  ",
      systemPrompt: "写",
      defaultModelId: null,
      availableToolNames: ["read_document"],
      userSelectable: true,
      subagentEligible: true,
      textOnlyMode: false,
    });
    const custom = snapshot.agents.find((agent) => agent.name === "多行写手")!;
    expect(custom.description).toBe("首行\n第二行细节\n\n第三行");
    expect(createStore(filePath).store.findRuntimeConfig(custom.id)?.description).toBe(
      "首行\n第二行细节\n\n第三行",
    );
  });

  test("loads legacy custom agents without description as empty string", () => {
    const directory = mkdtempSync(join(tmpdir(), "novelevolver-ai-agents-legacy-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "ai-agents.json");
    writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          version: 2,
          agents: [
            {
              id: "legacy-agent",
              name: "旧写手",
              systemPrompt: "写东西",
              defaultModelId: null,
              availableToolNames: ["read_document"],
              userSelectable: true,
              subagentEligible: true,
            },
          ],
          builtinDefaultModelIds: {},
          builtinSystemPromptOverrides: {},
          builtinChannelOverrides: {},
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const agent = createStore(filePath).store.findRuntimeConfig("legacy-agent")!;
    expect(agent.description).toBe("");
    expect(agent.defaultDescription).toBeNull();
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

describe("AiAgentsStore text-only subagents", () => {
  test("includes builtin brainstorm agent as text-only subagent", () => {
    const { store } = createStore();
    const brainstorm = store.findRuntimeConfig(BUILTIN_BRAINSTORM_ID)!;

    expect(brainstorm.name).toBe("头脑风暴");
    expect(brainstorm.subagentEligible).toBe(true);
    expect(brainstorm.textOnlyMode).toBe(true);
    expect(brainstorm.userSelectable).toBe(false);
  });

  test("includes builtin roleplay agent as text-only subagent", () => {
    const { store } = createStore();
    const roleplay = store.findRuntimeConfig(BUILTIN_ROLEPLAY_ID)!;

    expect(roleplay.name).toBe("角色扮演");
    expect(roleplay.subagentEligible).toBe(true);
    expect(roleplay.textOnlyMode).toBe(true);
    expect(roleplay.userSelectable).toBe(false);
  });

  test("persists custom textOnlyMode and clears it when subagentEligible is false", () => {
    const { filePath, store } = createStore();
    const snapshot = store.upsert({
      name: "纯文本人格",
      description: "测试",
      systemPrompt: "你是人格",
      defaultModelId: null,
      availableToolNames: ["read_document"],
      userSelectable: false,
      subagentEligible: true,
      textOnlyMode: true,
    });
    const custom = snapshot.agents.find((agent) => agent.name === "纯文本人格")!;
    expect(custom.textOnlyMode).toBe(true);

    store.upsert({
      ...toWrite(custom),
      subagentEligible: false,
      textOnlyMode: true,
    });
    expect(store.findRuntimeConfig(custom.id)?.textOnlyMode).toBe(false);

    expect(createStore(filePath).store.findRuntimeConfig(custom.id)?.textOnlyMode).toBe(false);
  });
});
