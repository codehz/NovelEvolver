import { useCallback, useEffect, useMemo, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { cn } from "#app/shared/lib/ui/cn";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
} from "#shared/rpc/services/index";
import { isLowMaxOutputTokensForNovelAgent } from "#shared/rpc/services/index";

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
import { AiProviderConfigForm } from "./AiProviderConfigForm";

type ModelEditorMode =
  | { type: "closed" }
  | { type: "create"; providerId: string }
  | { type: "edit"; model: AiModelConfigPublic };

type ProviderEditorMode =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; provider: AiProviderConfigPublic };

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
  const [modelEditor, setModelEditor] = useState<ModelEditorMode>({ type: "closed" });
  const [providerEditor, setProviderEditor] = useState<ProviderEditorMode>({ type: "closed" });

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

  const handleProviderSubmit = async (input: AiProviderConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiProvider(input),
      input.id ? "保存供应商失败" : "添加供应商失败",
    );
    if (ok) {
      setProviderEditor({ type: "closed" });
    }
  };

  const handleRemoveProvider = async (id: string) => {
    if (!window.confirm("删除供应商将同时删除其下所有模型配置，确定继续？")) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiProvider(id), "删除供应商失败");
    if (ok) {
      if (providerEditor.type === "edit" && providerEditor.provider.id === id) {
        setProviderEditor({ type: "closed" });
      }
      if (modelEditor.type === "edit" && modelEditor.model.providerId === id) {
        setModelEditor({ type: "closed" });
      }
      if (modelEditor.type === "create" && modelEditor.providerId === id) {
        setModelEditor({ type: "closed" });
      }
    }
  };

  const handleModelSubmit = async (input: AiModelConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiModel(input),
      input.id ? "保存模型配置失败" : "添加模型配置失败",
    );
    if (ok) {
      setModelEditor({ type: "closed" });
    }
  };

  const handleRemoveModel = async (id: string) => {
    if (!window.confirm("确定删除该模型配置？")) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiModel(id), "删除模型配置失败");
    if (ok && modelEditor.type === "edit" && modelEditor.model.id === id) {
      setModelEditor({ type: "closed" });
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

  const showListChrome = providerEditor.type === "closed" && modelEditor.type === "closed";

  return (
    <div className={settingsPanelSectionClass}>
      <div className={settingsPanelHeaderClass}>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-app-foreground">供应商与模型</h3>
          <p className="mt-0.5 text-2xs text-app-muted">
            先配置 API 供应商（连接与密钥），再在其下添加多个模型。密钥经系统加密后写入本地{" "}
            <span className="font-mono">ai-settings.json</span>。
          </p>
        </div>
        {showListChrome ? (
          <button
            className={settingsPrimaryButtonClass}
            disabled={busy}
            type="button"
            onClick={() => {
              setActionError(null);
              setProviderEditor({ type: "create" });
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
            添加供应商
          </button>
        ) : null}
      </div>

      {actionError && showListChrome ? <p className="text-xs text-ctp-red">{actionError}</p> : null}

      {providerEditor.type === "create" ? (
        <AiProviderConfigForm
          busy={busy}
          error={actionError}
          onCancel={() => {
            setActionError(null);
            setProviderEditor({ type: "closed" });
          }}
          onSubmit={handleProviderSubmit}
        />
      ) : null}

      {providerEditor.type === "edit" ? (
        <AiProviderConfigForm
          key={providerEditor.provider.id}
          busy={busy}
          error={actionError}
          initial={providerEditor.provider}
          onCancel={() => {
            setActionError(null);
            setProviderEditor({ type: "closed" });
          }}
          onSubmit={handleProviderSubmit}
        />
      ) : null}

      {modelEditor.type === "create" ? (
        <AiModelConfigForm
          busy={busy}
          defaultProviderId={modelEditor.providerId}
          error={actionError}
          providers={providers}
          onCancel={() => {
            setActionError(null);
            setModelEditor({ type: "closed" });
          }}
          onSubmit={handleModelSubmit}
        />
      ) : null}

      {modelEditor.type === "edit" ? (
        <AiModelConfigForm
          key={modelEditor.model.id}
          busy={busy}
          error={actionError}
          initial={modelEditor.model}
          providers={providers}
          onCancel={() => {
            setActionError(null);
            setModelEditor({ type: "closed" });
          }}
          onSubmit={handleModelSubmit}
        />
      ) : null}

      {providers.length === 0 && showListChrome ? (
        <div className={settingsEmptyStateClass}>还没有 API 供应商，点击「添加供应商」开始。</div>
      ) : null}

      {showListChrome
        ? providers.map((provider) => {
            const providerModels = modelsByProvider.get(provider.id) ?? [];

            return (
              <section key={provider.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2 border-b border-app-surface/80 pb-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <h4 className={settingsListItemTitleClass}>{provider.name}</h4>
                      {provider.hasApiKey ? (
                        <span className={settingsStatusBadgeClass}>已配置密钥</span>
                      ) : (
                        <span className={settingsStatusBadgeClass}>无密钥</span>
                      )}
                    </div>
                    <div className={settingsListItemMetaClass}>
                      <span>{aiAdapterLabel(provider.kind)}</span>
                      {provider.baseUrl ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate font-mono" title={provider.baseUrl}>
                            {provider.baseUrl}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      className={settingsSecondaryButtonClass}
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setModelEditor({ type: "create", providerId: provider.id });
                      }}
                    >
                      添加模型
                    </button>
                    <button
                      aria-label={`编辑供应商 ${provider.name}`}
                      className={settingsIconButtonClass}
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setProviderEditor({ type: "edit", provider });
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
                    </button>
                    <button
                      aria-label={`删除供应商 ${provider.name}`}
                      className={settingsIconButtonClass}
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        void handleRemoveProvider(provider.id);
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                    </button>
                  </div>
                </div>

                {providerModels.length === 0 ? (
                  <p className="text-2xs text-app-muted">该供应商下还没有模型。</p>
                ) : (
                  <ul className={settingsListClass}>
                    {providerModels.map((model) => {
                      const isDefault = model.id === defaultModelId;

                      return (
                        <li
                          key={model.id}
                          className={cn(
                            settingsListItemClass,
                            isDefault && "border-badge-background/40",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className={settingsListItemTitleClass}>{model.name}</span>
                              {isDefault ? (
                                <span
                                  className={cn(
                                    settingsStatusBadgeClass,
                                    settingsStatusBadgeDefaultClass,
                                  )}
                                >
                                  默认
                                </span>
                              ) : null}
                            </div>
                            <div className={settingsListItemMetaClass}>
                              <span className="font-mono">{model.model}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={cn(
                                  isLowMaxOutputTokensForNovelAgent(model.maxOutputTokens) &&
                                    "text-ctp-yellow",
                                )}
                              >
                                最大输出 {model.maxOutputTokens}
                              </span>
                              {model.contextLength !== null ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>上下文 {model.contextLength}</span>
                                </>
                              ) : null}
                              {model.availableReasoningLevels.length > 0 ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    effort{" "}
                                    {model.defaultReasoningLevel != null
                                      ? `${model.defaultReasoningLevel} / ${model.availableReasoningLevels.length}`
                                      : `${model.availableReasoningLevels.length} 档`}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5">
                            {!isDefault ? (
                              <button
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
                              aria-label={`编辑模型 ${model.name}`}
                              className={settingsIconButtonClass}
                              disabled={busy}
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setModelEditor({ type: "edit", model });
                              }}
                            >
                              <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
                            </button>
                            <button
                              aria-label={`删除模型 ${model.name}`}
                              className={settingsIconButtonClass}
                              disabled={busy}
                              type="button"
                              onClick={() => {
                                void handleRemoveModel(model.id);
                              }}
                            >
                              <span
                                aria-hidden="true"
                                className="icon-[codicon--trash] text-base"
                              />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        : null}
    </div>
  );
}
