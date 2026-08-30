import type { AiModelConfigPublic, AiProviderConfigPublic } from "#domain/settings/ai-settings";

export type EditorMode =
  | { type: "closed" }
  | { type: "create-provider" }
  | { type: "edit-provider"; provider: AiProviderConfigPublic }
  | { type: "create-model"; providerId: string }
  | { type: "edit-model"; model: AiModelConfigPublic };

export function resolveModelsSubpageTitle(editor: EditorMode): string | null {
  switch (editor.type) {
    case "create-provider":
      return "添加供应商";
    case "edit-provider":
      return `编辑：${editor.provider.name}`;
    case "create-model":
      return "添加模型";
    case "edit-model":
      return `编辑：${editor.model.name}`;
    case "closed":
      return null;
  }
}

export function resolveEditorProviderId(editor: EditorMode): string | null {
  switch (editor.type) {
    case "edit-provider":
      return editor.provider.id;
    case "create-model":
      return editor.providerId;
    case "edit-model":
      return editor.model.providerId;
    case "closed":
    case "create-provider":
      return null;
  }
}

export function isEditorTiedToProvider(editor: EditorMode, providerId: string): boolean {
  return resolveEditorProviderId(editor) === providerId;
}
