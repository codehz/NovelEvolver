import { useEffect, useMemo, useRef, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type { AiAgentConfigPublic, AiAgentConfigWrite } from "#shared/rpc/services/index";

import {
  settingsGhostActionClass,
  settingsHeaderActionsClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelRootClass,
  settingsStatusBadgeClass,
} from "../settings-chrome";
import { settingsErrorMessage } from "../settings-error";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { SettingsDetailPane } from "../SettingsDetailPane";
import { SettingsFormActions } from "../SettingsFormActions";
import { SettingsMasterDetailShell } from "../SettingsMasterDetailShell";
import {
  SettingsPanelEmpty,
  SettingsPanelLoadError,
  SettingsPanelLoading,
} from "../SettingsPanelStatus";
import { SettingsRail } from "../SettingsRail";
import { SettingsRailItem, settingsRailItemMetaLineClass } from "../SettingsRailItem";
import { useSettingsEditorLeave } from "../use-settings-editor-leave";
import { useSettingsMutation } from "../use-settings-mutation";
import { AI_AGENT_CONFIG_FORM_ID, AiAgentConfigForm } from "./AiAgentConfigForm";

type AgentSelection = { type: "create" } | { type: "edit"; id: string };

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

function sameSelection(a: AgentSelection | null, b: AgentSelection | null): boolean {
  if (a == null || b == null) {
    return a === b;
  }
  if (a.type === "create" && b.type === "create") {
    return true;
  }
  if (a.type === "edit" && b.type === "edit") {
    return a.id === b.id;
  }
  return false;
}

function agentMetaLine(agent: AiAgentConfigPublic, modelNameById: Map<string, string>): string {
  const parts: string[] = [`${agent.availableToolNames.length} 个工具`];
  if (agent.defaultModelId) {
    parts.push(modelNameById.get(agent.defaultModelId) ?? agent.defaultModelId);
  } else {
    parts.push("继承默认模型");
  }
  if (agent.userSelectable) {
    parts.push("对话可选");
  }
  if (agent.subagentEligible) {
    parts.push("子代理");
  }
  if (!agent.userSelectable && !agent.subagentEligible) {
    parts.push("未启用");
  }
  return parts.join(" · ");
}

type AiAgentsSettingsPanelProps = {
  /** Whether the agents tab is currently active. */
  active?: boolean;
};

export function AiAgentsSettingsPanel({ active = true }: AiAgentsSettingsPanelProps) {
  const { data, error: loadErrorRaw, isLoading, refresh } = useAsyncLoader(agentsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [selection, setSelection] = useState<AgentSelection | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<SettingsFormHandle | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined
      ? settingsErrorMessage(loadErrorRaw, "加载 AI Agent 设置失败")
      : null;

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

  // Default / heal selection after load or deletions.
  useEffect(() => {
    if (agents.length === 0) {
      if (selection?.type === "edit") {
        setSelection(null);
      }
      return;
    }
    if (selection == null) {
      setSelection({ type: "edit", id: agents[0]!.id });
      return;
    }
    if (selection.type === "edit" && !agents.some((agent) => agent.id === selection.id)) {
      setSelection({ type: "edit", id: agents[0]!.id });
    }
  }, [agents, selection]);

  const selectedAgent =
    selection?.type === "edit" ? (agents.find((agent) => agent.id === selection.id) ?? null) : null;

  const { requestLeave } = useSettingsEditorLeave({
    active,
    editorOpen: selection != null,
    busy,
    dirty: editorDirty,
    formRef,
    closeEditor: () => {
      // Master-detail keeps a selection; discard/remount is handled via onDiscard + select.
      clearActionError();
      setEditorDirty(false);
      setFormKey((key) => key + 1);
    },
    onDiscard: () => {
      setEditorDirty(false);
      setFormKey((key) => key + 1);
      if (selection?.type === "create") {
        setSelection(agents[0] ? { type: "edit", id: agents[0].id } : null);
      }
    },
  });

  const select = async (next: AgentSelection | null) => {
    if (sameSelection(selection, next)) {
      return;
    }
    const ok = await requestLeave();
    if (!ok) {
      return;
    }
    clearActionError();
    setEditorDirty(false);
    setFormKey((key) => key + 1);
    setSelection(next);
  };

  const handleSubmit = async (input: AiAgentConfigWrite) => {
    const previousIds = new Set(agents.map((agent) => agent.id));
    const snapshot = await runMutation(
      () => settingsService.upsertAiAgent(input),
      input.id ? "保存 Agent 失败" : "添加 Agent 失败",
    );
    if (snapshot == null) {
      return false;
    }
    setEditorDirty(false);
    if (input.id) {
      setSelection({ type: "edit", id: input.id });
    } else {
      const created = snapshot.agents.find((agent) => !previousIds.has(agent.id));
      if (created) {
        setSelection({ type: "edit", id: created.id });
      }
    }
    setFormKey((key) => key + 1);
    return true;
  };

  const handleRemove = async (id: string) => {
    const agent = agents.find((item) => item.id === id);
    const confirmed = await confirmDialogApi.confirm({
      title: "删除 Agent",
      description: agent
        ? `确定删除「${agent.name}」？此操作不可恢复。`
        : "确定删除该 Agent？此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const snapshot = await runMutation(() => settingsService.removeAiAgent(id), "删除 Agent 失败");
    if (snapshot == null) {
      return;
    }
    if (selection?.type === "edit" && selection.id === id) {
      const remaining = snapshot.agents;
      clearActionError();
      setEditorDirty(false);
      setFormKey((key) => key + 1);
      setSelection(remaining[0] ? { type: "edit", id: remaining[0].id } : null);
    }
  };

  if (isLoading && data === undefined) {
    return <SettingsPanelLoading />;
  }

  if (loadError && data === undefined) {
    return (
      <SettingsPanelLoadError
        message={loadError}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  const detailTitle =
    selection?.type === "create"
      ? "添加 Agent"
      : selectedAgent
        ? selectedAgent.builtin
          ? `配置：${selectedAgent.name}`
          : selectedAgent.name
        : "Agent";

  return (
    <div className={settingsPanelRootClass}>
      <SettingsMasterDetailShell>
        <SettingsRail
          label="Agent"
          listAriaLabel="Agent 列表"
          addLabel="添加 Agent"
          addDisabled={busy}
          onAdd={() => {
            void select({ type: "create" });
          }}
        >
          {agents.map((agent) => {
            const meta = agentMetaLine(agent, modelNameById);
            return (
              <li key={agent.id}>
                <SettingsRailItem
                  title={agent.name}
                  selected={selection?.type === "edit" && selection.id === agent.id}
                  badge={
                    <span
                      className={cn(
                        settingsStatusBadgeClass,
                        agent.builtin && "bg-badge-background/20 text-badge-background",
                      )}
                    >
                      {agent.builtin ? "内置" : "自定义"}
                    </span>
                  }
                  meta={
                    <div className={settingsRailItemMetaLineClass} title={meta}>
                      {meta}
                    </div>
                  }
                  onSelect={() => {
                    void select({ type: "edit", id: agent.id });
                  }}
                />
              </li>
            );
          })}
        </SettingsRail>

        <SettingsDetailPane
          banner={
            actionError ? (
              <p className="shrink-0 px-3 pt-2 text-xs text-ctp-red">{actionError}</p>
            ) : null
          }
          header={
            selection != null ? (
              <>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <h4 className={settingsListItemTitleClass}>{detailTitle}</h4>
                    {selectedAgent?.builtin ? (
                      <span
                        className={cn(
                          settingsStatusBadgeClass,
                          "bg-badge-background/20 text-badge-background",
                        )}
                      >
                        内置
                      </span>
                    ) : null}
                  </div>
                  {selectedAgent ? (
                    <div className={settingsListItemMetaClass}>
                      <span>{selectedAgent.availableToolNames.length} 个工具</span>
                      {selectedAgent.defaultModelId ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            默认模型：
                            {modelNameById.get(selectedAgent.defaultModelId) ??
                              selectedAgent.defaultModelId}
                          </span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>继承对话默认模型</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={settingsListItemMetaClass}>
                      <span>定义独立系统提示词与工具权限的自定义角色</span>
                    </div>
                  )}
                </div>
                <div className={settingsHeaderActionsClass}>
                  {selectedAgent && !selectedAgent.builtin ? (
                    <Button
                      aria-label={`删除 Agent ${selectedAgent.name}`}
                      className={settingsGhostActionClass}
                      disabled={busy}
                      variant="ghost"
                      size="icon-md"
                      onClick={() => {
                        void handleRemove(selectedAgent.id);
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                    </Button>
                  ) : null}
                  <SettingsFormActions
                    busy={busy}
                    form={AI_AGENT_CONFIG_FORM_ID}
                    submitLabel={selection.type === "create" ? "添加" : "保存"}
                  />
                </div>
              </>
            ) : undefined
          }
        >
          {selection == null ? (
            <SettingsPanelEmpty>还没有 Agent，点击「添加 Agent」开始。</SettingsPanelEmpty>
          ) : selection.type === "create" ? (
            <AiAgentConfigForm
              key={`create-${formKey}`}
              busy={busy}
              error={actionError}
              formRef={formRef}
              models={models}
              providers={providers}
              tools={tools}
              onDirtyChange={setEditorDirty}
              onSubmit={handleSubmit}
            />
          ) : selectedAgent ? (
            <AiAgentConfigForm
              key={`${selectedAgent.id}-${formKey}`}
              busy={busy}
              error={actionError}
              formRef={formRef}
              initial={selectedAgent}
              lockDefinitionFields={selectedAgent.builtin}
              models={models}
              providers={providers}
              tools={tools}
              onDirtyChange={setEditorDirty}
              onSubmit={handleSubmit}
            />
          ) : (
            <SettingsPanelEmpty>请选择一个 Agent。</SettingsPanelEmpty>
          )}
        </SettingsDetailPane>
      </SettingsMasterDetailShell>
    </div>
  );
}
