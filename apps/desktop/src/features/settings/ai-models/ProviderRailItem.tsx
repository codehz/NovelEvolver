import type { AiProviderConfigPublic } from "#domain/settings/ai-settings";

import { settingsStatusBadgeClass } from "../settings-chrome";
import { SettingsRailItem, settingsRailItemMetaLineClass } from "../SettingsRailItem";
import { aiAdapterLabel } from "./ai-adapter-labels";

type ProviderRailItemProps = {
  provider: AiProviderConfigPublic;
  modelCount: number;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function ProviderRailItem({
  provider,
  modelCount,
  selected,
  onSelect,
}: ProviderRailItemProps) {
  const adapterLabel = aiAdapterLabel(provider.kind);
  const keyStatus = provider.hasApiKey ? "已配置密钥" : "无密钥";

  return (
    <SettingsRailItem
      title={provider.name}
      selected={selected}
      badge={<span className={settingsStatusBadgeClass}>{modelCount}</span>}
      meta={
        <>
          <div className={settingsRailItemMetaLineClass} title={adapterLabel}>
            {adapterLabel}
          </div>
          <div className={settingsRailItemMetaLineClass} title={keyStatus}>
            {keyStatus}
          </div>
        </>
      }
      onSelect={() => {
        onSelect(provider.id);
      }}
    />
  );
}
