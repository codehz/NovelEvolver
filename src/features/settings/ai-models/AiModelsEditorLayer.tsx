import type { Ref } from "react";

import type {
  AiModelConfigWrite,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
} from "#shared/rpc/services/index";

import { settingsPanelSectionClass } from "../settings-chrome";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { AiModelConfigForm } from "./AiModelConfigForm";
import { AiProviderConfigForm } from "./AiProviderConfigForm";
import type { EditorMode } from "./editor-mode";

type AiModelsEditorLayerProps = {
  editor: Exclude<EditorMode, { type: "closed" }>;
  providers: readonly AiProviderConfigPublic[];
  busy: boolean;
  actionError: string | null;
  formRef: Ref<SettingsFormHandle | null>;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onProviderSubmit: (input: AiProviderConfigWrite) => Promise<boolean>;
  onModelSubmit: (input: AiModelConfigWrite) => Promise<boolean>;
};

export function AiModelsEditorLayer({
  editor,
  providers,
  busy,
  actionError,
  formRef,
  onDirtyChange,
  onCancel,
  onProviderSubmit,
  onModelSubmit,
}: AiModelsEditorLayerProps) {
  return (
    <div className={settingsPanelSectionClass}>
      {editor.type === "create-provider" ? (
        <AiProviderConfigForm
          busy={busy}
          error={actionError}
          formRef={formRef}
          onCancel={onCancel}
          onDirtyChange={onDirtyChange}
          onSubmit={onProviderSubmit}
        />
      ) : null}

      {editor.type === "edit-provider" ? (
        <AiProviderConfigForm
          key={editor.provider.id}
          busy={busy}
          error={actionError}
          formRef={formRef}
          initial={editor.provider}
          onCancel={onCancel}
          onDirtyChange={onDirtyChange}
          onSubmit={onProviderSubmit}
        />
      ) : null}

      {editor.type === "create-model" ? (
        <AiModelConfigForm
          busy={busy}
          defaultProviderId={editor.providerId}
          error={actionError}
          formRef={formRef}
          providers={providers}
          onCancel={onCancel}
          onDirtyChange={onDirtyChange}
          onSubmit={onModelSubmit}
        />
      ) : null}

      {editor.type === "edit-model" ? (
        <AiModelConfigForm
          key={editor.model.id}
          busy={busy}
          error={actionError}
          formRef={formRef}
          initial={editor.model}
          providers={providers}
          onCancel={onCancel}
          onDirtyChange={onDirtyChange}
          onSubmit={onModelSubmit}
        />
      ) : null}
    </div>
  );
}
