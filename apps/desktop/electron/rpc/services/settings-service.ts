import { readFileSync, writeFileSync } from "node:fs";

import type { SettingsService } from "@novelevolver/desktop-rpc/services/settings-service";
import {
  agentExportFileName,
  applyAgentExport,
  resolveImportedAgentId,
  serializeAgentExport,
  type AiAgentImportResult,
} from "@novelevolver/domain/settings/agent-export";
import type {
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
  AiPromptConfigWrite,
  AiPromptsSettingsSnapshot,
  AiProviderConfigWrite,
  AiRuntimePolicySnapshot,
  AiRuntimePolicyWrite,
  GitCredentialConfigWrite,
  GitCredentialsSettingsSnapshot,
} from "@novelevolver/domain/settings/ai-settings";
import { RpcTarget } from "capnweb";
import { dialog, type BrowserWindow } from "electron";

import type { RpcMainDeps } from "../server/deps";

export class SettingsServiceImpl extends RpcTarget implements SettingsService {
  readonly #window: BrowserWindow;
  readonly #deps: RpcMainDeps;

  constructor(window: BrowserWindow, deps: RpcMainDeps) {
    super();
    this.#window = window;
    this.#deps = deps;
  }

  getAiModels(): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().getSnapshot();
  }

  upsertAiProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().upsertProvider(input);
  }

  removeAiProvider(id: string): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().removeProvider(id);
  }

  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().upsertModel(input);
  }

  removeAiModel(id: string): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().removeModel(id);
  }

  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().setDefault(id);
  }

  getAiAgents(): AiAgentsSettingsSnapshot {
    return this.#deps.getAiAgentsStore().getSnapshot();
  }

  upsertAiAgent(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot {
    return this.#deps.getAiAgentsStore().upsert(input);
  }

  removeAiAgent(id: string): AiAgentsSettingsSnapshot {
    return this.#deps.getAiAgentsStore().remove(id);
  }

  async exportAiAgent(id: string): Promise<boolean> {
    const agent = this.#deps.getAiAgentsStore().findRuntimeConfig(id);
    if (agent == null) {
      throw new Error("Agent 不存在。");
    }
    const result = await dialog.showSaveDialog(this.#window, {
      title: "导出 Agent",
      defaultPath: agentExportFileName(agent.name),
      filters: [{ name: "Agent 配置", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) {
      return false;
    }
    let path = result.filePath;
    if (!path.toLowerCase().endsWith(".json")) {
      path = `${path}.json`;
    }
    writeFileSync(path, serializeAgentExport(agent), "utf8");
    return true;
  }

  async importAiAgent(): Promise<AiAgentImportResult | null> {
    const result = await dialog.showOpenDialog(this.#window, {
      properties: ["openFile"],
      title: "导入 Agent",
      filters: [{ name: "Agent 配置", extensions: ["json"] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const path = result.filePaths[0];
    if (path == null) {
      return null;
    }
    const text = readFileSync(path, "utf8");
    const store = this.#deps.getAiAgentsStore();
    const previousIds = new Set(store.getSnapshot().agents.map((agent) => agent.id));
    const write = applyAgentExport(text, (id) => store.findRuntimeConfig(id));
    const snapshot = store.upsert(write);
    return {
      agentId: resolveImportedAgentId(write, snapshot, previousIds),
      snapshot,
    };
  }

  getAiPrompts(): AiPromptsSettingsSnapshot {
    return this.#deps.getAiPromptsStore().getSnapshot();
  }

  upsertAiPrompt(input: AiPromptConfigWrite): AiPromptsSettingsSnapshot {
    return this.#deps.getAiPromptsStore().upsert(input);
  }

  removeAiPrompt(id: string): AiPromptsSettingsSnapshot {
    return this.#deps.getAiPromptsStore().remove(id);
  }

  getAiRuntimePolicy(): AiRuntimePolicySnapshot {
    return this.#deps.getAiRuntimePolicyStore().getSnapshot();
  }

  setAiRuntimePolicy(input: AiRuntimePolicyWrite): AiRuntimePolicySnapshot {
    return this.#deps.getAiRuntimePolicyStore().setPolicy(input);
  }

  getGitCredentials(): GitCredentialsSettingsSnapshot {
    return this.#deps.getGitCredentialsStore().getSnapshot();
  }

  upsertGitCredential(input: GitCredentialConfigWrite): GitCredentialsSettingsSnapshot {
    return this.#deps.getGitCredentialsStore().upsert(input);
  }

  removeGitCredential(id: string): GitCredentialsSettingsSnapshot {
    return this.#deps.getGitCredentialsStore().remove(id);
  }
}
