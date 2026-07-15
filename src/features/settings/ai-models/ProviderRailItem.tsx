import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass, panelHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import type { AiProviderConfigPublic } from "#shared/rpc/services/index";

import { settingsListItemTitleClass, settingsStatusBadgeClass } from "../settings-chrome";
import { aiAdapterLabel } from "./ai-adapter-labels";

const metaLineClass = cn("truncate text-2xs text-app-muted");

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
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-transparent px-2 py-1.5 text-left outline-none",
        panelHoverClass,
        controlFocusVisibleClass,
        selected && "border-badge-background/40 bg-ctp-surface0/40",
      )}
      onClick={() => {
        onSelect(provider.id);
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn(settingsListItemTitleClass, "min-w-0 flex-1")} title={provider.name}>
          {provider.name}
        </span>
        <span className={settingsStatusBadgeClass}>{modelCount}</span>
      </div>
      <div className={metaLineClass} title={adapterLabel}>
        {adapterLabel}
      </div>
      <div className={metaLineClass} title={keyStatus}>
        {keyStatus}
      </div>
    </button>
  );
}
