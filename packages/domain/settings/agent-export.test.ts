import { describe, expect, test } from "bun:test";

import {
  applyAgentExport,
  agentExportFileName,
  parseAgentExport,
  resolveImportedAgentId,
  serializeAgentExport,
  toBuiltinUpsert,
} from "./agent-export";
import { BUILTIN_CONSISTENCY_REVIEWER_ID, type AiAgentConfigPublic } from "./ai-settings";
import { AiAgentsState, parseAiAgentsState } from "./stores/ai-agents-state";

let nextId = 0;

function createState(knownModelIds: readonly string[] = []): AiAgentsState {
  return new AiAgentsState({
    createId: () => `id-${++nextId}`,
    knownModelIds: () => knownModelIds,
    data: parseAiAgentsState(null),
  });
}

function customAgent(overrides: Partial<AiAgentConfigPublic> = {}): AiAgentConfigPublic {
  return {
    id: "custom-1",
    name: "风格写手",
    description: "按指定风格写作",
    defaultDescription: null,
    systemPrompt: "按指定风格写作。",
    defaultSystemPrompt: null,
    defaultModelId: "should-not-export",
    availableToolNames: ["read_document", "write_document"],
    builtin: false,
    userSelectable: true,
    subagentEligible: true,
    textOnlyMode: false,
    ...overrides,
  };
}

describe("serializeAgentExport / parseAgentExport", () => {
  test("round-trips a custom agent without id or defaultModelId", () => {
    const json = serializeAgentExport(customAgent());
    const parsed = parseAgentExport(json);

    expect(parsed).toEqual({
      kind: "custom",
      agent: {
        name: "风格写手",
        description: "按指定风格写作",
        systemPrompt: "按指定风格写作。",
        availableToolNames: ["read_document", "write_document"],
        userSelectable: true,
        subagentEligible: true,
        textOnlyMode: false,
      },
    });
    expect(json).not.toContain("custom-1");
    expect(json).not.toContain("should-not-export");
    expect(json).not.toContain("defaultModelId");
  });

  test("round-trips a builtin agent as an override patch", () => {
    const store = createState();
    const builtin = store.getRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID);
    const json = serializeAgentExport({
      ...builtin,
      description: "覆盖简介",
      systemPrompt: "覆盖提示词。",
      userSelectable: false,
      defaultModelId: "local-model",
    });
    const parsed = parseAgentExport(json);

    expect(parsed.kind).toBe("builtin-override");
    if (parsed.kind !== "builtin-override") {
      return;
    }
    expect(parsed.agent).toEqual({
      id: BUILTIN_CONSISTENCY_REVIEWER_ID,
      description: "覆盖简介",
      systemPrompt: "覆盖提示词。",
      userSelectable: false,
      subagentEligible: builtin.subagentEligible,
    });
    expect(json).not.toContain("defaultModelId");
    expect(json).not.toContain("textOnlyMode");
    expect(json).not.toContain("availableToolNames");
  });

  test("strips unknown tools and BOM", () => {
    const json = `\uFEFF${JSON.stringify({
      format: "novelevolver.agent",
      version: 1,
      kind: "custom",
      agent: {
        name: "工具过滤",
        description: "",
        systemPrompt: "写",
        availableToolNames: ["read_document", "not_a_tool", "write_document"],
        userSelectable: true,
        subagentEligible: false,
        textOnlyMode: true,
      },
    })}`;
    const parsed = parseAgentExport(json);
    expect(parsed.kind).toBe("custom");
    if (parsed.kind !== "custom") {
      return;
    }
    expect(parsed.agent.availableToolNames).toEqual(["read_document", "write_document"]);
    expect(parsed.agent.textOnlyMode).toBe(false);
  });

  test("rejects invalid envelopes", () => {
    expect(() => parseAgentExport("{")).toThrow("无法解析 Agent 文件。");
    expect(() => parseAgentExport(JSON.stringify({ format: "other", version: 1 }))).toThrow(
      "不是 NovelEvolver Agent 文件。",
    );
    expect(() =>
      parseAgentExport(
        JSON.stringify({ format: "novelevolver.agent", version: 2, kind: "custom", agent: {} }),
      ),
    ).toThrow("不支持的 Agent 文件版本。");
    expect(() =>
      parseAgentExport(
        JSON.stringify({
          format: "novelevolver.agent",
          version: 1,
          kind: "builtin-override",
          agent: {
            id: "not-a-builtin",
            description: "",
            systemPrompt: "x",
            userSelectable: true,
            subagentEligible: true,
          },
        }),
      ),
    ).toThrow("内置 Agent 标识无效。");
    expect(() =>
      parseAgentExport(
        JSON.stringify({
          format: "novelevolver.agent",
          version: 1,
          kind: "custom",
          agent: {
            name: "  ",
            description: "",
            systemPrompt: "写",
            availableToolNames: [],
            userSelectable: true,
            subagentEligible: true,
            textOnlyMode: false,
          },
        }),
      ),
    ).toThrow("Agent 名称不能为空。");
  });
});

describe("applyAgentExport", () => {
  test("custom upsert drops the model binding and omits id", () => {
    const write = applyAgentExport(serializeAgentExport(customAgent()), () => null);
    expect(write.id).toBeUndefined();
    expect(write.defaultModelId).toBeNull();
    expect(write.name).toBe("风格写手");
  });

  test("builtin upsert keeps the receiver defaultModelId", () => {
    const known = ["local-a", "local-b"];
    const source = createState(known);
    const receiver = createState(known);
    const builtin = source.getRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID);

    source.upsert({
      id: builtin.id,
      name: builtin.name,
      description: "来源简介",
      systemPrompt: "来源提示词。",
      defaultModelId: "local-a",
      availableToolNames: builtin.availableToolNames,
      userSelectable: false,
      subagentEligible: builtin.subagentEligible,
      textOnlyMode: builtin.textOnlyMode,
    });
    receiver.upsert({
      id: builtin.id,
      name: builtin.name,
      description: builtin.description,
      systemPrompt: builtin.systemPrompt,
      defaultModelId: "local-b",
      availableToolNames: builtin.availableToolNames,
      userSelectable: builtin.userSelectable,
      subagentEligible: builtin.subagentEligible,
      textOnlyMode: builtin.textOnlyMode,
    });

    const write = applyAgentExport(
      serializeAgentExport(source.getRuntimeConfig(builtin.id)),
      (id) => receiver.findRuntimeConfig(id),
    );
    expect(write.id).toBe(BUILTIN_CONSISTENCY_REVIEWER_ID);
    expect(write.defaultModelId).toBe("local-b");
    expect(write.systemPrompt).toBe("来源提示词。");
    expect(write.description).toBe("来源简介");
    expect(write.userSelectable).toBe(false);

    const snapshot = receiver.upsert(write);
    const applied = snapshot.agents.find((agent) => agent.id === builtin.id)!;
    expect(applied.defaultModelId).toBe("local-b");
    expect(applied.systemPrompt).toBe("来源提示词。");
    expect(applied.name).toBe(builtin.name);
    expect(applied.availableToolNames).toEqual(builtin.availableToolNames);
  });

  test("builtin upsert would clear the model if defaultModelId were null", () => {
    const receiver = createState(["local-b"]);
    const builtin = receiver.getRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID);
    receiver.upsert({
      id: builtin.id,
      name: builtin.name,
      description: builtin.description,
      systemPrompt: builtin.systemPrompt,
      defaultModelId: "local-b",
      availableToolNames: builtin.availableToolNames,
      userSelectable: builtin.userSelectable,
      subagentEligible: builtin.subagentEligible,
      textOnlyMode: builtin.textOnlyMode,
    });
    const current = receiver.getRuntimeConfig(builtin.id);
    const write = toBuiltinUpsert(
      {
        id: BUILTIN_CONSISTENCY_REVIEWER_ID,
        description: current.description,
        systemPrompt: "仍覆盖提示词。",
        userSelectable: current.userSelectable,
        subagentEligible: current.subagentEligible,
      },
      { ...current, defaultModelId: null },
    );
    expect(write.defaultModelId).toBeNull();
    receiver.upsert(write);
    expect(receiver.getRuntimeConfig(builtin.id).defaultModelId).toBeNull();
  });
});

describe("resolveImportedAgentId / agentExportFileName", () => {
  test("uses write.id for builtin and the new snapshot id for custom", () => {
    const store = createState();
    const previousIds = new Set(store.getSnapshot().agents.map((agent) => agent.id));
    const write = applyAgentExport(serializeAgentExport(customAgent()), () => null);
    const snapshot = store.upsert(write);
    expect(resolveImportedAgentId(write, snapshot, previousIds).startsWith("id-")).toBe(true);

    const builtinWrite = applyAgentExport(
      serializeAgentExport(store.getRuntimeConfig(BUILTIN_CONSISTENCY_REVIEWER_ID)),
      (id) => store.findRuntimeConfig(id),
    );
    expect(resolveImportedAgentId(builtinWrite, snapshot, previousIds)).toBe(
      BUILTIN_CONSISTENCY_REVIEWER_ID,
    );
  });

  test("sanitizes export file names", () => {
    expect(agentExportFileName("风格/写手")).toBe("风格_写手.json");
    expect(agentExportFileName("   ")).toBe("agent.json");
  });
});
