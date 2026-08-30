import { describe, expect, test } from "bun:test";

import type { AiAgentConfigPublic, AiAgentConfigWrite } from "../ai-settings";
import {
  BUILTIN_AI_AGENT_ID,
  BUILTIN_AI_AGENT_IDS,
  BUILTIN_BRAINSTORM_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  BUILTIN_ROLEPLAY_ID,
} from "../ai-settings";
import { AiAgentsState, parseAiAgentsState } from "./ai-agents-state";

let nextId = 0;

function createState(data?: Parameters<typeof parseAiAgentsState>[0]): AiAgentsState {
  return new AiAgentsState({
    createId: () => `id-${++nextId}`,
    knownModelIds: () => [],
    data: data === undefined ? undefined : parseAiAgentsState(data),
  });
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

describe("AiAgentsState builtin system prompt overrides", () => {
  test("returns code defaults for all builtin agents", () => {
    const store = createState();
    const builtinAgents = store.getSnapshot().agents.filter((agent) => agent.builtin);

    expect(builtinAgents.map((agent) => agent.id)).toEqual([...BUILTIN_AI_AGENT_IDS]);
    for (const agent of builtinAgents) {
      expect(agent.defaultSystemPrompt).not.toBeNull();
      expect(agent.systemPrompt).toBe(agent.defaultSystemPrompt!);
    }
  });

  test("keeps an override in serialized state", () => {
    const store = createState();
    const builtin = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert(toWrite(builtin, "  自定义一致性审查提示词。  "));

    expect(store.getRuntimeConfig(builtin.id).systemPrompt).toBe("自定义一致性审查提示词。");
    expect(store.findRuntimeConfig(builtin.id)?.defaultSystemPrompt).toBe(
      builtin.defaultSystemPrompt,
    );

    const reloaded = createState(store.serialize());
    expect(reloaded.getRuntimeConfig(builtin.id).systemPrompt).toBe("自定义一致性审查提示词。");
  });

  test("removes the override when saving the code default", () => {
    const store = createState();
    const builtin = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    store.upsert(toWrite(builtin, "自定义一致性审查提示词。"));
    store.upsert(toWrite(builtin, builtin.defaultSystemPrompt!));

    expect(store.getRuntimeConfig(builtin.id).systemPrompt).toBe(builtin.defaultSystemPrompt!);
    expect(
      store.serialize().builtinSystemPromptOverrides[BUILTIN_CONSISTENCY_REVIEWER_ID],
    ).toBeUndefined();
  });

  test("rejects a blank builtin system prompt", () => {
    const store = createState();
    const builtin = store.findRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)!;

    expect(() => store.upsert(toWrite(builtin, "   \n"))).toThrow("系统提示词不能为空。");
  });

  test("keeps custom agent persistence unchanged", () => {
    const store = createState();
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
    expect(createState(store.serialize()).findRuntimeConfig(custom.id)).toEqual(custom);
  });
});

describe("AiAgentsState description", () => {
  test("persists multi-line custom description", () => {
    const store = createState();
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
  });

  test("loads legacy custom agents without description as empty string", () => {
    const store = createState({
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
    });

    const agent = store.findRuntimeConfig("legacy-agent")!;
    expect(agent.description).toBe("");
    expect(agent.defaultDescription).toBeNull();
  });
});

describe("AiAgentsState builtin channel overrides", () => {
  test("ignores name and tool list changes for builtin agents", () => {
    const store = createState();
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

describe("AiAgentsState text-only subagents", () => {
  test("includes builtin brainstorm and roleplay as text-only", () => {
    const store = createState();
    const brainstorm = store.findRuntimeConfig(BUILTIN_BRAINSTORM_ID)!;
    const roleplay = store.findRuntimeConfig(BUILTIN_ROLEPLAY_ID)!;

    expect(brainstorm.textOnlyMode).toBe(true);
    expect(roleplay.textOnlyMode).toBe(true);
  });

  test("clears textOnlyMode when subagentEligible is false", () => {
    const store = createState();
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
  });
});
