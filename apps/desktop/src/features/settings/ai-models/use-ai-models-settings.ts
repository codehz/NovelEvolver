import { useEffect, useMemo, useRef, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiProviderConfigWrite,
} from "#domain/settings/ai-settings";

import { settingsErrorMessage } from "../settings-error";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { useSettingsEditorLeave } from "../use-settings-editor-leave";
import { useSettingsMutation } from "../use-settings-mutation";
import { type EditorMode, isEditorTiedToProvider, resolveEditorProviderId } from "./editor-mode";

const modelsSettingsLoader = createAsyncLoader(() => settingsService.getAiModels());

type UseAiModelsSettingsOptions = {
  /** Whether the models tab is the active settings category. */
  active?: boolean;
};

export function useAiModelsSettings({ active = true }: UseAiModelsSettingsOptions = {}) {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(modelsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [editor, setEditor] = useState<EditorMode>({ type: "closed" });
  const [editorDirty, setEditorDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const formRef = useRef<SettingsFormHandle | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined ? settingsErrorMessage(loadErrorRaw, "加载 AI 模型设置失败") : null;

  const providers = snapshot?.providers ?? [];
  const models = snapshot?.models ?? [];
  const defaultModelId = snapshot?.defaultModelId ?? null;

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AiModelConfigPublic[]>();
    for (const provider of providers) {
      map.set(provider.id, []);
    }
    for (const model of models) {
      const list = map.get(model.providerId);
      if (list) {
        list.push(model);
      }
    }
    return map;
  }, [models, providers]);

  const resolvedSelectedProviderId =
    selectedProviderId !== null && providers.some((provider) => provider.id === selectedProviderId)
      ? selectedProviderId
      : (providers[0]?.id ?? null);

  const closeEditor = () => {
    clearActionError();
    setEditorDirty(false);
    setEditor({ type: "closed" });
  };

  const { requestClose } = useSettingsEditorLeave({
    active,
    editorOpen: editor.type !== "closed",
    busy,
    dirty: editorDirty,
    formRef,
    closeEditor,
    onDiscard: () => {
      setEditorDirty(false);
      setFormKey((key) => key + 1);
    },
  });

  const openEditor = (next: EditorMode) => {
    clearActionError();
    setEditorDirty(false);
    setFormKey((key) => key + 1);
    const providerId = resolveEditorProviderId(next);
    if (providerId != null) {
      setSelectedProviderId(providerId);
    }
    setEditor(next);
  };

  const handleProviderSubmit = async (input: AiProviderConfigWrite) => {
    const previousIds = new Set(providers.map((provider) => provider.id));
    const result = await runMutation(
      () => settingsService.upsertAiProvider(input),
      input.id ? "保存供应商失败" : "添加供应商失败",
    );
    if (result != null) {
      setEditorDirty(false);
      if (input.id) {
        setSelectedProviderId(input.id);
      } else {
        const created = result.providers.find((provider) => !previousIds.has(provider.id));
        if (created) {
          setSelectedProviderId(created.id);
        }
      }
      setEditor({ type: "closed" });
      return true;
    }
    return false;
  };

  const handleRemoveProvider = async (id: string) => {
    const confirmed = await confirmDialogApi.confirm({
      title: "删除供应商",
      description: "删除供应商将同时删除其下所有模型配置，此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiProvider(id), "删除供应商失败");
    if (ok && isEditorTiedToProvider(editor, id)) {
      closeEditor();
    }
  };

  const handleModelSubmit = async (input: AiModelConfigWrite) => {
    const result = await runMutation(
      () => settingsService.upsertAiModel(input),
      input.id ? "保存模型配置失败" : "添加模型配置失败",
    );
    if (result != null) {
      setEditorDirty(false);
      setSelectedProviderId(input.providerId);
      setEditor({ type: "closed" });
      return true;
    }
    return false;
  };

  const handleRemoveModel = async (id: string) => {
    const confirmed = await confirmDialogApi.confirm({
      title: "删除模型配置",
      description: "确定删除该模型配置？此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiModel(id), "删除模型配置失败");
    if (ok && editor.type === "edit-model" && editor.model.id === id) {
      closeEditor();
    }
  };

  const handleSetDefault = async (id: string | null) => {
    await runMutation(() => settingsService.setDefaultAiModel(id), "设置默认模型失败");
  };

  return {
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
    onDirtyChange: setEditorDirty,
    providers,
    selectedProviderId: resolvedSelectedProviderId,
    setSelectedProviderId,
    refresh,
    snapshot,
  };
}
