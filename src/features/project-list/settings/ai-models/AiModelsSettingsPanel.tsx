import { useCallback, useEffect, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { cn } from "#app/shared/lib/ui/cn";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
} from "#shared/rpc/settings-rpc";

import {
  settingsEmptyStateClass,
  settingsIconButtonClass,
  settingsListClass,
  settingsListItemClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelHeaderClass,
  settingsPanelSectionClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsStatusBadgeClass,
  settingsStatusBadgeDefaultClass,
} from "../settings-chrome";
import { aiAdapterLabel } from "./ai-adapter-labels";
import { AiModelConfigForm } from "./AiModelConfigForm";

type EditorMode =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; model: AiModelConfigPublic };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return fallback;
}

export function AiModelsSettingsPanel() {
  const [snapshot, setSnapshot] = useState<AiModelsSettingsSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<EditorMode>({ type: "closed" });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await settingsService.getAiModels();
      setSnapshot(next);
    } catch (error) {
      setLoadError(errorMessage(error, "加载 AI 模型设置失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applySnapshot = (next: AiModelsSettingsSnapshot) => {
    setSnapshot(next);
    setActionError(null);
  };

  const runMutation = async (
    action: () => Promise<AiModelsSettingsSnapshot> | AiModelsSettingsSnapshot,
    fallback: string,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await action();
      applySnapshot(next);
      return true;
    } catch (error) {
      setActionError(errorMessage(error, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (input: AiModelConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiModel(input),
      input.id ? "保存模型配置失败" : "添加模型配置失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("确定删除该模型配置？")) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiModel(id), "删除模型配置失败");
    if (ok && editor.type === "edit" && editor.model.id === id) {
      setEditor({ type: "closed" });
    }
  };

  const handleSetDefault = async (id: string | null) => {
    await runMutation(() => settingsService.setDefaultAiModel(id), "设置默认模型失败");
  };

  if (loading && snapshot === null) {
    return <div className={settingsEmptyStateClass}>加载中…</div>;
  }

  if (loadError && snapshot === null) {
    return (
      <div className={settingsPanelSectionClass}>
        <p className="text-xs text-ctp-red">{loadError}</p>
        <button
          className={settingsSecondaryButtonClass}
          type="button"
          onClick={() => {
            void refresh();
          }}
        >
          重试
        </button>
      </div>
    );
  }

  const models = snapshot?.models ?? [];
  const defaultModelId = snapshot?.defaultModelId ?? null;

  return (
    <div className={settingsPanelSectionClass}>
      <div className={settingsPanelHeaderClass}>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-app-foreground">模型配置</h3>
          <p className="mt-0.5 text-2xs text-app-muted">
            可保存多个 API 配置，并指定一个默认模型。密钥经系统加密后写入本地文件。
          </p>
        </div>
        {editor.type === "closed" ? (
          <button
            className={settingsPrimaryButtonClass}
            disabled={busy}
            type="button"
            onClick={() => {
              setActionError(null);
              setEditor({ type: "create" });
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
            添加模型
          </button>
        ) : null}
      </div>

      {actionError && editor.type === "closed" ? (
        <p className="text-xs text-ctp-red">{actionError}</p>
      ) : null}

      {editor.type === "create" ? (
        <AiModelConfigForm
          busy={busy}
          error={actionError}
          onCancel={() => {
            setActionError(null);
            setEditor({ type: "closed" });
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      {editor.type === "edit" ? (
        <AiModelConfigForm
          key={editor.model.id}
          busy={busy}
          error={actionError}
          initial={editor.model}
          onCancel={() => {
            setActionError(null);
            setEditor({ type: "closed" });
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      {models.length === 0 && editor.type === "closed" ? (
        <div className={settingsEmptyStateClass}>还没有模型配置，点击「添加模型」开始。</div>
      ) : (
        <ul className={settingsListClass}>
          {models.map((model) => {
            const isDefault = model.id === defaultModelId;
            const isEditing = editor.type === "edit" && editor.model.id === model.id;
            return (
              <li
                key={model.id}
                className={cn(settingsListItemClass, isEditing && "border-badge-background/50")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className={settingsListItemTitleClass}>{model.name}</span>
                    {isDefault ? (
                      <span
                        className={cn(settingsStatusBadgeClass, settingsStatusBadgeDefaultClass)}
                      >
                        默认
                      </span>
                    ) : null}
                    {model.hasApiKey ? (
                      <span className={settingsStatusBadgeClass}>已配置密钥</span>
                    ) : (
                      <span className={settingsStatusBadgeClass}>无密钥</span>
                    )}
                  </div>
                  <div className={settingsListItemMetaClass}>
                    <span>{aiAdapterLabel(model.kind)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{model.model}</span>
                    {model.baseUrl ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate font-mono" title={model.baseUrl}>
                          {model.baseUrl}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {!isDefault ? (
                    <button
                      aria-label={`将 ${model.name} 设为默认`}
                      className={settingsSecondaryButtonClass}
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        void handleSetDefault(model.id);
                      }}
                    >
                      设为默认
                    </button>
                  ) : (
                    <button
                      aria-label="取消默认模型"
                      className={settingsSecondaryButtonClass}
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        void handleSetDefault(null);
                      }}
                    >
                      取消默认
                    </button>
                  )}
                  <button
                    aria-label={`编辑 ${model.name}`}
                    className={settingsIconButtonClass}
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setEditor({ type: "edit", model });
                    }}
                  >
                    <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
                  </button>
                  <button
                    aria-label={`删除 ${model.name}`}
                    className={settingsIconButtonClass}
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      void handleRemove(model.id);
                    }}
                  >
                    <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
