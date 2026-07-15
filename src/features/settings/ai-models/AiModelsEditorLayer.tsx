import type {
  AiModelConfigWrite,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
} from "#shared/rpc/services/index";

import { settingsPanelSectionClass } from "../settings-chrome";
import { AiModelConfigForm } from "./AiModelConfigForm";
import { AiProviderConfigForm } from "./AiProviderConfigForm";
import type { EditorMode } from "./editor-mode";

type AiModelsEditorLayerProps = {
  editor: Exclude<EditorMode, { type: "closed" }>;
  providers: readonly AiProviderConfigPublic[];
  busy: boolean;
  actionError: string | null;
  onCancel: () => void;
  onProviderSubmit: (input: AiProviderConfigWrite) => Promise<void>;
  onModelSubmit: (input: AiModelConfigWrite) => Promise<void>;
};

export function AiModelsEditorLayer({
  editor,
  providers,
  busy,
  actionError,
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
          onCancel={onCancel}
          onSubmit={onProviderSubmit}
        />
      ) : null}

      {editor.type === "edit-provider" ? (
        <AiProviderConfigForm
          key={editor.provider.id}
          busy={busy}
          error={actionError}
          initial={editor.provider}
          onCancel={onCancel}
          onSubmit={onProviderSubmit}
        />
      ) : null}

      {editor.type === "create-model" ? (
        <AiModelConfigForm
          busy={busy}
          defaultProviderId={editor.providerId}
          error={actionError}
          providers={providers}
          onCancel={onCancel}
          onSubmit={onModelSubmit}
        />
      ) : null}

      {editor.type === "edit-model" ? (
        <AiModelConfigForm
          key={editor.model.id}
          busy={busy}
          error={actionError}
          initial={editor.model}
          providers={providers}
          onCancel={onCancel}
          onSubmit={onModelSubmit}
        />
      ) : null}
    </div>
  );
}
