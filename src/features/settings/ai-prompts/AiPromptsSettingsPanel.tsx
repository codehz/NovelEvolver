import { useEffect, useRef, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import { Button } from "#app/shared/ui";
import type { AiPromptConfigWrite } from "#shared/rpc/services/index";

import {
  settingsDualPaneDetailTitleRowClass,
  settingsGhostActionClass,
  settingsHeaderActionsClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelRootClass,
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
import { AI_PROMPT_CONFIG_FORM_ID, AiPromptConfigForm } from "./AiPromptConfigForm";

type PromptSelection = { type: "create" } | { type: "edit"; id: string };

const promptsSettingsLoader = createAsyncLoader(() => settingsService.getAiPrompts());

function sameSelection(a: PromptSelection | null, b: PromptSelection | null): boolean {
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

function summarizePrompt(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 48) {
    return singleLine;
  }
  return `${singleLine.slice(0, 48)}…`;
}

type AiPromptsSettingsPanelProps = {
  /** Whether the prompts tab is currently active. */
  active?: boolean;
};

export function AiPromptsSettingsPanel({ active = true }: AiPromptsSettingsPanelProps) {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(promptsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [selection, setSelection] = useState<PromptSelection | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<SettingsFormHandle | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined
      ? settingsErrorMessage(loadErrorRaw, "加载 AI 提示词设置失败")
      : null;

  const prompts = snapshot?.prompts ?? [];

  useEffect(() => {
    if (prompts.length === 0) {
      if (selection?.type === "edit") {
        setSelection(null);
      }
      return;
    }
    if (selection == null) {
      setSelection({ type: "edit", id: prompts[0]!.id });
      return;
    }
    if (selection.type === "edit" && !prompts.some((prompt) => prompt.id === selection.id)) {
      setSelection({ type: "edit", id: prompts[0]!.id });
    }
  }, [prompts, selection]);

  const selectedPrompt =
    selection?.type === "edit"
      ? (prompts.find((prompt) => prompt.id === selection.id) ?? null)
      : null;

  const { requestLeave } = useSettingsEditorLeave({
    active,
    editorOpen: selection != null,
    busy,
    dirty: editorDirty,
    formRef,
    closeEditor: () => {
      clearActionError();
      setEditorDirty(false);
      setFormKey((key) => key + 1);
    },
    onDiscard: () => {
      setEditorDirty(false);
      setFormKey((key) => key + 1);
      if (selection?.type === "create") {
        setSelection(prompts[0] ? { type: "edit", id: prompts[0].id } : null);
      }
    },
  });

  const select = async (next: PromptSelection | null) => {
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

  const handleSubmit = async (input: AiPromptConfigWrite) => {
    const previousIds = new Set(prompts.map((prompt) => prompt.id));
    const result = await runMutation(
      () => settingsService.upsertAiPrompt(input),
      input.id ? "保存提示词失败" : "添加提示词失败",
    );
    if (result == null) {
      return false;
    }
    setEditorDirty(false);
    if (input.id) {
      setSelection({ type: "edit", id: input.id });
    } else {
      const created = result.prompts.find((prompt) => !previousIds.has(prompt.id));
      if (created) {
        setSelection({ type: "edit", id: created.id });
      }
    }
    setFormKey((key) => key + 1);
    return true;
  };

  const handleRemove = async (id: string) => {
    const prompt = prompts.find((item) => item.id === id);
    const confirmed = await confirmDialogApi.confirm({
      title: "删除提示词",
      description: prompt
        ? `确定删除「${prompt.title}」？此操作不可恢复。`
        : "确定删除该提示词？此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const result = await runMutation(() => settingsService.removeAiPrompt(id), "删除提示词失败");
    if (result == null) {
      return;
    }
    if (selection?.type === "edit" && selection.id === id) {
      const remaining = result.prompts;
      clearActionError();
      setEditorDirty(false);
      setFormKey((key) => key + 1);
      setSelection(remaining[0] ? { type: "edit", id: remaining[0].id } : null);
    }
  };

  if (isLoading && snapshot === undefined) {
    return <SettingsPanelLoading />;
  }

  if (loadError && snapshot === undefined) {
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
    selection?.type === "create" ? "添加提示词" : selectedPrompt ? selectedPrompt.title : "提示词";

  return (
    <div className={settingsPanelRootClass}>
      <SettingsMasterDetailShell>
        <SettingsRail
          label="提示词"
          listAriaLabel="提示词列表"
          addLabel="添加提示词"
          addDisabled={busy}
          onAdd={() => {
            void select({ type: "create" });
          }}
        >
          {prompts.map((item) => {
            const summary = summarizePrompt(item.prompt);
            return (
              <li key={item.id}>
                <SettingsRailItem
                  title={item.title}
                  selected={selection?.type === "edit" && selection.id === item.id}
                  badge={<span className="font-mono text-2xs text-app-muted">/{item.slug}</span>}
                  meta={
                    <div className={settingsRailItemMetaLineClass} title={summary}>
                      {summary}
                    </div>
                  }
                  onSelect={() => {
                    void select({ type: "edit", id: item.id });
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
                  <div className={settingsDualPaneDetailTitleRowClass}>
                    <h4 className={settingsListItemTitleClass}>{detailTitle}</h4>
                    {selectedPrompt ? (
                      <span className="truncate font-mono text-2xs text-app-muted">
                        /{selectedPrompt.slug}
                      </span>
                    ) : null}
                  </div>
                  <div className={settingsListItemMetaClass}>
                    {selectedPrompt ? (
                      <span className="truncate">{summarizePrompt(selectedPrompt.prompt)}</span>
                    ) : (
                      <span>配置可复用模板，侧栏通过 /调用名 使用</span>
                    )}
                  </div>
                </div>
                <div className={settingsHeaderActionsClass}>
                  {selectedPrompt ? (
                    <Button
                      aria-label={`删除提示词 ${selectedPrompt.title}`}
                      className={settingsGhostActionClass}
                      disabled={busy}
                      variant="ghost"
                      size="icon-md"
                      onClick={() => {
                        void handleRemove(selectedPrompt.id);
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                    </Button>
                  ) : null}
                  <SettingsFormActions
                    busy={busy}
                    form={AI_PROMPT_CONFIG_FORM_ID}
                    submitLabel={selection.type === "create" ? "添加" : "保存"}
                  />
                </div>
              </>
            ) : undefined
          }
        >
          {selection == null ? (
            <SettingsPanelEmpty>还没有自定义提示词，点击「添加提示词」开始。</SettingsPanelEmpty>
          ) : selection.type === "create" ? (
            <AiPromptConfigForm
              key={`create-${formKey}`}
              busy={busy}
              error={actionError}
              formRef={formRef}
              onDirtyChange={setEditorDirty}
              onSubmit={handleSubmit}
            />
          ) : selectedPrompt ? (
            <AiPromptConfigForm
              key={`${selectedPrompt.id}-${formKey}`}
              busy={busy}
              error={actionError}
              formRef={formRef}
              initial={selectedPrompt}
              onDirtyChange={setEditorDirty}
              onSubmit={handleSubmit}
            />
          ) : (
            <SettingsPanelEmpty>请选择一条提示词。</SettingsPanelEmpty>
          )}
        </SettingsDetailPane>
      </SettingsMasterDetailShell>
    </div>
  );
}
