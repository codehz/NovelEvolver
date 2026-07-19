import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  settingsEmptyStateClass,
  settingsLayerHiddenClass,
  settingsPanelRootClass,
  settingsPanelScrollClass,
  settingsPanelSectionClass,
} from "../settings-chrome";
import { SettingsSubpageHeader } from "../SettingsSubpageHeader";
import { AiModelsEditorLayer } from "./AiModelsEditorLayer";
import { AiModelsListLayer } from "./AiModelsListLayer";
import { resolveModelsSubpageTitle } from "./editor-mode";
import { useAiModelsSettings } from "./use-ai-models-settings";

type AiModelsSettingsPanelProps = {
  /** Whether the models tab is currently active. */
  active?: boolean;
};

export function AiModelsSettingsPanel({ active = true }: AiModelsSettingsPanelProps) {
  const {
    actionError,
    busy,
    formKey,
    formRef,
    requestClose,
    defaultModelId,
    editor,
    handleModelSubmit,
    handleProviderSubmit,
    handleRemoveModel,
    handleRemoveProvider,
    handleSetDefault,
    isLoading,
    loadError,
    modelsByProvider,
    openEditor,
    onDirtyChange,
    providers,
    refresh,
    snapshot,
  } = useAiModelsSettings({ active });

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
        <SettingsSubpageHeader
          title={subpageTitle}
          onBack={() => {
            void requestClose();
          }}
        />
      ) : null}

      {/* Keep-alive list layer: dual-column owns its own column scrollports. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          isSubpageOpen && settingsLayerHiddenClass,
        )}
      >
        <AiModelsListLayer
          actionError={actionError}
          busy={busy}
          defaultModelId={defaultModelId}
          modelsByProvider={modelsByProvider}
          providers={providers}
          onOpenEditor={openEditor}
          onRemoveModel={(id) => {
            void handleRemoveModel(id);
          }}
          onRemoveProvider={(id) => {
            void handleRemoveProvider(id);
          }}
          onSetDefault={(id) => {
            void handleSetDefault(id);
          }}
        />
      </div>

      {isSubpageOpen ? (
        <div className={settingsPanelScrollClass}>
          <AiModelsEditorLayer
            key={formKey}
            actionError={actionError}
            busy={busy}
            editor={editor}
            formRef={formRef}
            providers={providers}
            onCancel={() => {
              void requestClose();
            }}
            onDirtyChange={onDirtyChange}
            onModelSubmit={handleModelSubmit}
            onProviderSubmit={handleProviderSubmit}
          />
        </div>
      ) : null}
    </div>
  );
}
