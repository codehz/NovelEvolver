import { Button } from "#app/shared/ui";
import type { AiModelConfigPublic, AiProviderConfigPublic } from "#shared/rpc/services/index";

import {
  settingsEmptyStateClass,
  settingsPanelHeaderClass,
  settingsPanelSectionClass,
} from "../settings-chrome";
import type { EditorMode } from "./editor-mode";
import { ProviderSection } from "./ProviderSection";

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

      {providers.length === 0 ? (
        <div className={settingsEmptyStateClass}>还没有 API 供应商，点击「添加供应商」开始。</div>
      ) : null}

      {providers.map((provider) => (
        <ProviderSection
          key={provider.id}
          provider={provider}
          models={modelsByProvider.get(provider.id) ?? []}
          defaultModelId={defaultModelId}
          busy={busy}
          onAddModel={(providerId) => {
            onOpenEditor({ type: "create-model", providerId });
          }}
          onEditProvider={(next) => {
            onOpenEditor({ type: "edit-provider", provider: next });
          }}
          onRemoveProvider={onRemoveProvider}
          onSetDefault={onSetDefault}
          onEditModel={(model) => {
            onOpenEditor({ type: "edit-model", model });
          }}
          onRemoveModel={onRemoveModel}
        />
      ))}
    </div>
  );
}
