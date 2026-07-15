import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type { AiModelConfigPublic } from "#shared/rpc/services/index";
import { isLowMaxOutputTokensForNovelAgent } from "#shared/rpc/services/index";

import {
  settingsGhostActionClass,
  settingsListItemClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsStatusBadgeClass,
  settingsStatusBadgeDefaultClass,
} from "../settings-chrome";

type ModelListItemProps = {
  model: AiModelConfigPublic;
  isDefault: boolean;
  busy: boolean;
  onSetDefault: (id: string | null) => void;
  onEdit: (model: AiModelConfigPublic) => void;
  onRemove: (id: string) => void;
};

export function ModelListItem({
  model,
  isDefault,
  busy,
  onSetDefault,
  onEdit,
  onRemove,
}: ModelListItemProps) {
  return (
    <li className={cn(settingsListItemClass, isDefault && "border-badge-background/40")}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={settingsListItemTitleClass}>{model.name}</span>
          {isDefault ? (
            <span className={cn(settingsStatusBadgeClass, settingsStatusBadgeDefaultClass)}>
              默认
            </span>
          ) : null}
        </div>
        <div className={settingsListItemMetaClass}>
          <span className="font-mono">{model.model}</span>
          <span aria-hidden="true">·</span>
          <span
            className={cn(
              isLowMaxOutputTokensForNovelAgent(model.maxOutputTokens) && "text-ctp-yellow",
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
                effort {model.defaultReasoningLevel ?? model.availableReasoningLevels[0]} /{" "}
                {model.availableReasoningLevels.length}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {isDefault ? (
          <Button
            disabled={busy}
            onClick={() => {
              onSetDefault(null);
            }}
          >
            取消默认
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => {
              onSetDefault(model.id);
            }}
          >
            设为默认
          </Button>
        )}
        <Button
          aria-label={`编辑模型 ${model.name}`}
          className={settingsGhostActionClass}
          disabled={busy}
          variant="ghost"
          size="icon-md"
          onClick={() => {
            onEdit(model);
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
        </Button>
        <Button
          aria-label={`删除模型 ${model.name}`}
          className={settingsGhostActionClass}
          disabled={busy}
          variant="ghost"
          size="icon-md"
          onClick={() => {
            onRemove(model.id);
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
        </Button>
      </div>
    </li>
  );
}
