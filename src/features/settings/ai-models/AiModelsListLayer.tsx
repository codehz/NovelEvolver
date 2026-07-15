import { useEffect, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type { AiModelConfigPublic, AiProviderConfigPublic } from "#shared/rpc/services/index";

import {
  settingsDualPaneClass,
  settingsDualPaneDetailClass,
  settingsDualPaneDetailHeaderClass,
  settingsDualPaneDetailScrollClass,
  settingsDualPaneRailClass,
  settingsDualPaneRailLabelClass,
  settingsDualPaneRailListClass,
  settingsDualPaneRailScrollClass,
  settingsEmptyStateClass,
  settingsGhostActionClass,
  settingsListClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelHeaderClass,
  settingsPanelSectionClass,
  settingsStatusBadgeClass,
} from "../settings-chrome";
import { aiAdapterLabel } from "./ai-adapter-labels";
import type { EditorMode } from "./editor-mode";
import { ModelListItem } from "./ModelListItem";
import { ProviderRailItem } from "./ProviderRailItem";

type AiModelsListLayerProps = {
  providers: readonly AiProviderConfigPublic[];
  modelsByProvider: ReadonlyMap<string, readonly AiModelConfigPublic[]>;
  defaultModelId: string | null;
  busy: boolean;
  actionError: string | null;
  onOpenEditor: (next: EditorMode) => void;
  onRemoveProvider: (id: string) => void;
  onSetDefault: (id: string | null) => void;
  onRemoveModel: (id: string) => void;
};

export function AiModelsListLayer({
  providers,
  modelsByProvider,
  defaultModelId,
  busy,
  actionError,
  onOpenEditor,
  onRemoveProvider,
  onSetDefault,
  onRemoveModel,
}: AiModelsListLayerProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    () => providers[0]?.id ?? null,
  );

  useEffect(() => {
    const firstProvider = providers[0];
    if (firstProvider === undefined) {
      setSelectedProviderId(null);
      return;
    }
    if (selectedProviderId === null || !providers.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(firstProvider.id);
    }
  }, [providers, selectedProviderId]);

  const selectedProvider =
    selectedProviderId === null
      ? null
      : (providers.find((provider) => provider.id === selectedProviderId) ?? null);
  const selectedModels =
    selectedProvider === null ? [] : (modelsByProvider.get(selectedProvider.id) ?? []);

  if (providers.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className={settingsPanelSectionClass}>
          <div className={settingsPanelHeaderClass}>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-app-foreground">供应商与模型</h3>
              <p className="mt-0.5 text-2xs text-app-muted">
                左侧选择供应商，右侧管理其下模型。密钥经系统加密后写入本地{" "}
                <span className="font-mono">ai-settings.json</span>。
              </p>
            </div>
            <Button
              disabled={busy}
              variant="primary"
              onClick={() => {
                onOpenEditor({ type: "create-provider" });
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
              添加供应商
            </Button>
          </div>
          {actionError ? <p className="text-xs text-ctp-red">{actionError}</p> : null}
          <div className={settingsEmptyStateClass}>还没有 API 供应商，点击「添加供应商」开始。</div>
        </div>
      </div>
    );
  }

  return (
    <div className={settingsDualPaneClass}>
      <aside className={settingsDualPaneRailClass}>
        <div className={settingsDualPaneRailLabelClass}>供应商</div>
        <div className={settingsDualPaneRailScrollClass}>
          <ul className={settingsDualPaneRailListClass} aria-label="供应商列表">
            {providers.map((provider) => (
              <li key={provider.id}>
                <ProviderRailItem
                  provider={provider}
                  modelCount={modelsByProvider.get(provider.id)?.length ?? 0}
                  selected={provider.id === selectedProviderId}
                  onSelect={setSelectedProviderId}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 p-2">
          <Button
            className="w-full"
            disabled={busy}
            variant="primary"
            onClick={() => {
              onOpenEditor({ type: "create-provider" });
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
            添加供应商
          </Button>
        </div>
      </aside>

      <section className={settingsDualPaneDetailClass}>
        {actionError ? (
          <p className="shrink-0 px-3 pt-2 text-xs text-ctp-red">{actionError}</p>
        ) : null}

        {selectedProvider ? (
          <>
            <div className={settingsDualPaneDetailHeaderClass}>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <h4 className={settingsListItemTitleClass}>{selectedProvider.name}</h4>
                  {selectedProvider.hasApiKey ? (
                    <span className={settingsStatusBadgeClass}>已配置密钥</span>
                  ) : (
                    <span className={settingsStatusBadgeClass}>无密钥</span>
                  )}
                </div>
                <div className={settingsListItemMetaClass}>
                  <span>{aiAdapterLabel(selectedProvider.kind)}</span>
                  {selectedProvider.baseUrl ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate font-mono" title={selectedProvider.baseUrl}>
                        {selectedProvider.baseUrl}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  disabled={busy}
                  onClick={() => {
                    onOpenEditor({
                      type: "create-model",
                      providerId: selectedProvider.id,
                    });
                  }}
                >
                  <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
                  添加模型
                </Button>
                <Button
                  aria-label={`编辑供应商 ${selectedProvider.name}`}
                  className={settingsGhostActionClass}
                  disabled={busy}
                  variant="ghost"
                  size="icon-md"
                  onClick={() => {
                    onOpenEditor({ type: "edit-provider", provider: selectedProvider });
                  }}
                >
                  <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
                </Button>
                <Button
                  aria-label={`删除供应商 ${selectedProvider.name}`}
                  className={settingsGhostActionClass}
                  disabled={busy}
                  variant="ghost"
                  size="icon-md"
                  onClick={() => {
                    onRemoveProvider(selectedProvider.id);
                  }}
                >
                  <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                </Button>
              </div>
            </div>

            <div className={settingsDualPaneDetailScrollClass}>
              {selectedModels.length === 0 ? (
                <div className={settingsEmptyStateClass}>
                  该供应商下还没有模型，点击「添加模型」开始。
                </div>
              ) : (
                <ul className={settingsListClass}>
                  {selectedModels.map((model) => (
                    <ModelListItem
                      key={model.id}
                      model={model}
                      isDefault={model.id === defaultModelId}
                      busy={busy}
                      onSetDefault={onSetDefault}
                      onEdit={(next) => {
                        onOpenEditor({ type: "edit-model", model: next });
                      }}
                      onRemove={onRemoveModel}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className={cn(settingsPanelSectionClass, "flex-1")}>
            <div className={settingsEmptyStateClass}>请选择一个供应商。</div>
          </div>
        )}
      </section>
    </div>
  );
}
