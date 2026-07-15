import { Button } from "#app/shared/ui";
import type { AiModelConfigPublic, AiProviderConfigPublic } from "#shared/rpc/services/index";

import {
  settingsGhostActionClass,
  settingsListClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsStatusBadgeClass,
} from "../settings-chrome";
import { aiAdapterLabel } from "./ai-adapter-labels";
import { ModelListItem } from "./ModelListItem";

type ProviderSectionProps = {
  provider: AiProviderConfigPublic;
  models: readonly AiModelConfigPublic[];
  defaultModelId: string | null;
  busy: boolean;
  onAddModel: (providerId: string) => void;
  onEditProvider: (provider: AiProviderConfigPublic) => void;
  onRemoveProvider: (id: string) => void;
  onSetDefault: (id: string | null) => void;
  onEditModel: (model: AiModelConfigPublic) => void;
  onRemoveModel: (id: string) => void;
};

export function ProviderSection({
  provider,
  models,
  defaultModelId,
  busy,
  onAddModel,
  onEditProvider,
  onRemoveProvider,
  onSetDefault,
  onEditModel,
  onRemoveModel,
}: ProviderSectionProps) {
  return (
    <section className="flex flex-col gap-2">
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
          <Button
            disabled={busy}
            onClick={() => {
              onAddModel(provider.id);
            }}
          >
            添加模型
          </Button>
          <Button
            aria-label={`编辑供应商 ${provider.name}`}
            className={settingsGhostActionClass}
            disabled={busy}
            variant="ghost"
            size="icon-md"
            onClick={() => {
              onEditProvider(provider);
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
          </Button>
          <Button
            aria-label={`删除供应商 ${provider.name}`}
            className={settingsGhostActionClass}
            disabled={busy}
            variant="ghost"
            size="icon-md"
            onClick={() => {
              onRemoveProvider(provider.id);
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
          </Button>
        </div>
      </div>

      {models.length === 0 ? (
        <p className="text-2xs text-app-muted">该供应商下还没有模型。</p>
      ) : (
        <ul className={settingsListClass}>
          {models.map((model) => (
            <ModelListItem
              key={model.id}
              model={model}
              isDefault={model.id === defaultModelId}
              busy={busy}
              onSetDefault={onSetDefault}
              onEdit={onEditModel}
              onRemove={onRemoveModel}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
