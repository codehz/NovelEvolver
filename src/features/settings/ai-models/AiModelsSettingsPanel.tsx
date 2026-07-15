import { useEffect, useMemo, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
} from "#shared/rpc/services/index";

import {
  settingsEmptyStateClass,
  settingsLayerHiddenClass,
  settingsPanelHeaderClass,
  settingsPanelRootClass,
  settingsPanelScrollClass,
  settingsPanelSectionClass,
} from "../settings-chrome";
import { settingsErrorMessage } from "../settings-error";
import { SettingsSubpageHeader } from "../SettingsSubpageHeader";
import { useSettingsMutation } from "../use-settings-mutation";
import { AiModelConfigForm } from "./AiModelConfigForm";
import { AiProviderConfigForm } from "./AiProviderConfigForm";
import { ProviderSection } from "./ProviderSection";

type EditorMode =
  | { type: "closed" }
  | { type: "create-provider" }
  | { type: "edit-provider"; provider: AiProviderConfigPublic }
  | { type: "create-model"; providerId: string }
  | { type: "edit-model"; model: AiModelConfigPublic };

const modelsSettingsLoader = createAsyncLoader(() => settingsService.getAiModels());

function resolveModelsSubpageTitle(editor: EditorMode): string | null {
  switch (editor.type) {
    case "create-provider":
      return "添加供应商";
    case "edit-provider":
      return `编辑：${editor.provider.name}`;
    case "create-model":
      return "添加模型";
    case "edit-model":
      return `编辑：${editor.model.name}`;
    case "closed":
      return null;
  }
}

function isEditorTiedToProvider(editor: EditorMode, providerId: string): boolean {
  return (
    (editor.type === "edit-provider" && editor.provider.id === providerId) ||
    (editor.type === "edit-model" && editor.model.providerId === providerId) ||
    (editor.type === "create-model" && editor.providerId === providerId)
  );
}

export function AiModelsSettingsPanel() {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(modelsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [editor, setEditor] = useState<EditorMode>({ type: "closed" });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined ? settingsErrorMessage(loadErrorRaw, "加载 AI 模型设置失败") : null;

  const providers = snapshot?.providers ?? [];
  const models = snapshot?.models ?? [];
  const defaultModelId = snapshot?.defaultModelId ?? null;

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AiModelConfigPublic[]>();
    for (const provider of providers) {
      map.set(provider.id, []);
    }
    for (const model of models) {
      const list = map.get(model.providerId);
      if (list) {
        list.push(model);
      }
    }
    return map;
  }, [models, providers]);

  const closeEditor = () => {
    clearActionError();
    setEditor({ type: "closed" });
  };

  const openEditor = (next: EditorMode) => {
    clearActionError();
    setEditor(next);
  };

  const handleProviderSubmit = async (input: AiProviderConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiProvider(input),
      input.id ? "保存供应商失败" : "添加供应商失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
  };

  const handleRemoveProvider = async (id: string) => {
    const confirmed = await confirmDialogApi.confirm({
      title: "删除供应商",
      description: "删除供应商将同时删除其下所有模型配置，此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiProvider(id), "删除供应商失败");
    if (ok && isEditorTiedToProvider(editor, id)) {
      setEditor({ type: "closed" });
    }
  };

  const handleModelSubmit = async (input: AiModelConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiModel(input),
      input.id ? "保存模型配置失败" : "添加模型配置失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
  };

  const handleRemoveModel = async (id: string) => {
    const confirmed = await confirmDialogApi.confirm({
      title: "删除模型配置",
      description: "确定删除该模型配置？此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiModel(id), "删除模型配置失败");
    if (ok && editor.type === "edit-model" && editor.model.id === id) {
      setEditor({ type: "closed" });
    }
  };

  const handleSetDefault = async (id: string | null) => {
    await runMutation(() => settingsService.setDefaultAiModel(id), "设置默认模型失败");
  };

  if (isLoading && snapshot === undefined) {
    return (
      <div className={settingsPanelRootClass}>
        <div className={settingsPanelScrollClass}>
          <div className={settingsEmptyStateClass}>加载中…</div>
        </div>
      </div>
    );
  }

  if (loadError && snapshot === undefined) {
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
  const subpageTitle = resolveModelsSubpageTitle(editor);

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
              <h3 className="text-sm font-medium text-app-foreground">供应商与模型</h3>
              <p className="mt-0.5 text-2xs text-app-muted">
                先配置 API 供应商（连接与密钥），再在其下添加多个模型。密钥经系统加密后写入本地{" "}
                <span className="font-mono">ai-settings.json</span>。
              </p>
            </div>
            <Button
              disabled={busy}
              variant="primary"
              onClick={() => {
                openEditor({ type: "create-provider" });
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
              添加供应商
            </Button>
          </div>

          {actionError ? <p className="text-xs text-ctp-red">{actionError}</p> : null}

          {providers.length === 0 ? (
            <div className={settingsEmptyStateClass}>
              还没有 API 供应商，点击「添加供应商」开始。
            </div>
          ) : null}

          {providers.map((provider) => (
            <ProviderSection
              key={provider.id}
              provider={provider}
              models={modelsByProvider.get(provider.id) ?? []}
              defaultModelId={defaultModelId}
              busy={busy}
              onAddModel={(providerId) => {
                openEditor({ type: "create-model", providerId });
              }}
              onEditProvider={(next) => {
                openEditor({ type: "edit-provider", provider: next });
              }}
              onRemoveProvider={(id) => {
                void handleRemoveProvider(id);
              }}
              onSetDefault={(id) => {
                void handleSetDefault(id);
              }}
              onEditModel={(model) => {
                openEditor({ type: "edit-model", model });
              }}
              onRemoveModel={(id) => {
                void handleRemoveModel(id);
              }}
            />
          ))}
        </div>
      </div>

      {isSubpageOpen ? (
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            {editor.type === "create-provider" ? (
              <AiProviderConfigForm
                busy={busy}
                error={actionError}
                onCancel={closeEditor}
                onSubmit={handleProviderSubmit}
              />
            ) : null}

            {editor.type === "edit-provider" ? (
              <AiProviderConfigForm
                key={editor.provider.id}
                busy={busy}
                error={actionError}
                initial={editor.provider}
                onCancel={closeEditor}
                onSubmit={handleProviderSubmit}
              />
            ) : null}

            {editor.type === "create-model" ? (
              <AiModelConfigForm
                busy={busy}
                defaultProviderId={editor.providerId}
                error={actionError}
                providers={providers}
                onCancel={closeEditor}
                onSubmit={handleModelSubmit}
              />
            ) : null}

            {editor.type === "edit-model" ? (
              <AiModelConfigForm
                key={editor.model.id}
                busy={busy}
                error={actionError}
                initial={editor.model}
                providers={providers}
                onCancel={closeEditor}
                onSubmit={handleModelSubmit}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
