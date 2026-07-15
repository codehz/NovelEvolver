import { useEffect, useMemo, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type { AiAgentConfigPublic, AiAgentConfigWrite } from "#shared/rpc/services/index";

import {
  settingsEmptyStateClass,
  settingsGhostActionClass,
  settingsLayerHiddenClass,
  settingsListClass,
  settingsListItemClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelHeaderClass,
  settingsPanelRootClass,
  settingsPanelScrollClass,
  settingsPanelSectionClass,
  settingsStatusBadgeClass,
} from "../settings-chrome";
import { SettingsSubpageHeader } from "../SettingsSubpageHeader";
import { AiAgentConfigForm } from "./AiAgentConfigForm";

type AgentEditorMode =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; agent: AiAgentConfigPublic }
  | { type: "detail"; agent: AiAgentConfigPublic };

type AgentsSettingsData = {
  agents: Awaited<ReturnType<typeof settingsService.getAiAgents>>;
  models: Awaited<ReturnType<typeof settingsService.getAiModels>>;
};

const agentsSettingsLoader = createAsyncLoader(async (): Promise<AgentsSettingsData> => {
  const [agents, models] = await Promise.all([
    settingsService.getAiAgents(),
    settingsService.getAiModels(),
  ]);
  return { agents, models };
});

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return fallback;
}

function resolveAgentSubpageTitle(editor: AgentEditorMode): string | null {
  if (editor.type === "create") {
    return "添加 Agent";
  }
  if (editor.type === "edit") {
    return `编辑：${editor.agent.name}`;
  }
  if (editor.type === "detail") {
    return `详情：${editor.agent.name}`;
  }
  return null;
}

export function AiAgentsSettingsPanel() {
  const { data, error: loadErrorRaw, isLoading, refresh } = useAsyncLoader(agentsSettingsLoader);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<AgentEditorMode>({ type: "closed" });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined ? errorMessage(loadErrorRaw, "加载 AI Agent 设置失败") : null;

  const agents = data?.agents.agents ?? [];
  const tools = data?.agents.tools ?? [];
  const models = data?.models.models ?? [];
  const providers = data?.models.providers ?? [];

  const modelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const model of models) {
      map.set(model.id, model.name);
    }
    return map;
  }, [models]);

  const runMutation = async (action: () => PromiseLike<unknown>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (error) {
      setActionError(errorMessage(error, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = () => {
    setActionError(null);
    setEditor({ type: "closed" });
  };

  const handleSubmit = async (input: AiAgentConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiAgent(input),
      input.id ? "保存 Agent 失败" : "添加 Agent 失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("确定删除该 Agent？")) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiAgent(id), "删除 Agent 失败");
    if (ok && editor.type !== "closed" && "agent" in editor && editor.agent.id === id) {
      setEditor({ type: "closed" });
    }
  };

  const handleOpenEditor = (next: AgentEditorMode) => {
    setActionError(null);
    setEditor(next);
  };

  if (isLoading && data === undefined) {
    return (
      <div className={settingsPanelRootClass}>
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            <div className={settingsEmptyStateClass}>加载中…</div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && data === undefined) {
    return (
      <div className={settingsPanelRootClass}>
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            <p className="text-xs text-ctp-red">{loadError}</p>
            <Button
              onClick={() => {
                void refresh();
              }}
            >
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isSubpageOpen = editor.type !== "closed";
  const subpageTitle = resolveAgentSubpageTitle(editor);

  return (
    <div className={settingsPanelRootClass}>
      {isSubpageOpen && subpageTitle ? (
        <SettingsSubpageHeader title={subpageTitle} onBack={closeEditor} />
      ) : null}

      {/* Keep-alive list layer: own scrollport so form scroll cannot clobber list position. */}
      <div className={cn(settingsPanelScrollClass, isSubpageOpen && settingsLayerHiddenClass)}>
        <div className={settingsPanelSectionClass}>
          <div className={settingsPanelHeaderClass}>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-app-foreground">AI Agent</h3>
              <p className="mt-0.5 text-2xs text-app-muted">
                定义拥有独立系统提示词和工具权限的 AI 角色，可在对话中切换。
              </p>
            </div>
            <Button
              disabled={busy}
              variant="primary"
              onClick={() => {
                handleOpenEditor({ type: "create" });
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
              添加 Agent
            </Button>
          </div>

          {actionError ? <p className="text-xs text-ctp-red">{actionError}</p> : null}

          {agents.length === 0 ? (
            <div className={settingsEmptyStateClass}>
              还没有自定义 Agent，点击「添加 Agent」开始。
            </div>
          ) : null}

          {agents.length > 0 ? (
            <ul className={settingsListClass}>
              {agents.map((agent) => {
                const defaultModelName = agent.defaultModelId
                  ? (modelNameById.get(agent.defaultModelId) ?? agent.defaultModelId)
                  : null;

                return (
                  <li key={agent.id} className={settingsListItemClass}>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className={settingsListItemTitleClass}>{agent.name}</span>
                        {agent.builtin ? (
                          <span
                            className={cn(
                              settingsStatusBadgeClass,
                              "bg-badge-background/20 text-badge-background",
                            )}
                          >
                            内置
                          </span>
                        ) : (
                          <span className={settingsStatusBadgeClass}>自定义</span>
                        )}
                      </div>
                      <div className={settingsListItemMetaClass}>
                        <span>{agent.availableToolNames.length} 个工具</span>
                        {defaultModelName ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>默认模型：{defaultModelName}</span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>继承对话默认模型</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      {agent.builtin ? (
                        <Button
                          aria-label={`查看 ${agent.name} 详情`}
                          disabled={busy}
                          onClick={() => {
                            handleOpenEditor({ type: "detail", agent });
                          }}
                        >
                          详情
                        </Button>
                      ) : (
                        <>
                          <Button
                            aria-label={`编辑 Agent ${agent.name}`}
                            className={settingsGhostActionClass}
                            disabled={busy}
                            variant="ghost"
                            size="icon-md"
                            onClick={() => {
                              handleOpenEditor({ type: "edit", agent });
                            }}
                          >
                            <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
                          </Button>
                          <Button
                            aria-label={`删除 Agent ${agent.name}`}
                            className={settingsGhostActionClass}
                            disabled={busy}
                            variant="ghost"
                            size="icon-md"
                            onClick={() => {
                              void handleRemove(agent.id);
                            }}
                          >
                            <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      {isSubpageOpen ? (
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            {editor.type === "create" ? (
              <AiAgentConfigForm
                busy={busy}
                error={actionError}
                models={models}
                providers={providers}
                tools={tools}
                onCancel={closeEditor}
                onSubmit={handleSubmit}
              />
            ) : null}

            {editor.type === "edit" ? (
              <AiAgentConfigForm
                key={editor.agent.id}
                busy={busy}
                error={actionError}
                initial={editor.agent}
                models={models}
                providers={providers}
                tools={tools}
                onCancel={closeEditor}
                onSubmit={handleSubmit}
              />
            ) : null}

            {editor.type === "detail" ? (
              <AiAgentConfigForm
                key={editor.agent.id}
                busy={busy}
                error={actionError}
                initial={editor.agent}
                models={models}
                providers={providers}
                readOnly
                tools={tools}
                onCancel={closeEditor}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
