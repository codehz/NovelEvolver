import { cn } from "#app/shared/lib/ui/cn";

import {
  settingsDetailInsetClass,
  settingsDetailSurfaceClass,
  settingsLayerHiddenClass,
  settingsPanelRootClass,
} from "../settings-chrome";
import { SettingsFormActions } from "../SettingsFormActions";
import { SettingsPanelLoadError, SettingsPanelLoading } from "../SettingsPanelStatus";
import { SettingsSubpageHeader } from "../SettingsSubpageHeader";
import { AI_MODEL_CONFIG_FORM_ID } from "./AiModelConfigForm";
import { AiModelsEditorLayer } from "./AiModelsEditorLayer";
import { AiModelsListLayer } from "./AiModelsListLayer";
import { AI_PROVIDER_CONFIG_FORM_ID } from "./AiProviderConfigForm";
import { resolveModelsSubpageTitle, type EditorMode } from "./editor-mode";
import { useAiModelsSettings } from "./use-ai-models-settings";

function resolveModelsSubpageSubmit(
  editor: EditorMode,
): { form: string; submitLabel: string } | null {
  switch (editor.type) {
    case "create-provider":
      return { form: AI_PROVIDER_CONFIG_FORM_ID, submitLabel: "添加" };
    case "edit-provider":
      return { form: AI_PROVIDER_CONFIG_FORM_ID, submitLabel: "保存" };
    case "create-model":
      return { form: AI_MODEL_CONFIG_FORM_ID, submitLabel: "添加" };
    case "edit-model":
      return { form: AI_MODEL_CONFIG_FORM_ID, submitLabel: "保存" };
    case "closed":
      return null;
  }
}

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
    return <SettingsPanelLoading />;
  }

  if (loadError && snapshot === undefined) {
    return (
      <SettingsPanelLoadError
        message={loadError}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  const isSubpageOpen = editor.type !== "closed";
  const subpageTitle = resolveModelsSubpageTitle(editor);
  const subpageSubmit = resolveModelsSubpageSubmit(editor);

  return (
    <div className={settingsPanelRootClass}>
      {isSubpageOpen && subpageTitle ? (
        <SettingsSubpageHeader
          title={subpageTitle}
          actions={
            subpageSubmit ? (
              <SettingsFormActions
                busy={busy}
                form={subpageSubmit.form}
                submitLabel={subpageSubmit.submitLabel}
              />
            ) : undefined
          }
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
        <div className={settingsDetailInsetClass}>
          <div
            className={cn(
              settingsDetailSurfaceClass,
              "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
            )}
          >
            <AiModelsEditorLayer
              key={formKey}
              actionError={actionError}
              busy={busy}
              editor={editor}
              formRef={formRef}
              providers={providers}
              onDirtyChange={onDirtyChange}
              onModelSubmit={handleModelSubmit}
              onProviderSubmit={handleProviderSubmit}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
