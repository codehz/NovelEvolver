import { useEffect, useMemo, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiProviderConfigWrite,
} from "#shared/rpc/services/index";

import { settingsErrorMessage } from "../settings-error";
import { useSettingsMutation } from "../use-settings-mutation";
import { type EditorMode, isEditorTiedToProvider } from "./editor-mode";

const modelsSettingsLoader = createAsyncLoader(() => settingsService.getAiModels());

export function useAiModelsSettings() {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(modelsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [editor, setEditor] = useState<EditorMode>({ type: "closed" });

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

  const closeEditor = () => {
    clearActionError();
    setEditor({ type: "closed" });
  };

  const openEditor = (next: EditorMode) => {
    clearActionError();
    setEditor(next);
  };

  const handleProviderSubmit = async (input: AiProviderConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiProvider(input),
      input.id ? "保存供应商失败" : "添加供应商失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
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
      setEditor({ type: "closed" });
    }
  };

  const handleModelSubmit = async (input: AiModelConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiModel(input),
      input.id ? "保存模型配置失败" : "添加模型配置失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
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
      setEditor({ type: "closed" });
    }
  };

  const handleSetDefault = async (id: string | null) => {
    await runMutation(() => settingsService.setDefaultAiModel(id), "设置默认模型失败");
  };

  return {
    actionError,
    busy,
    closeEditor,
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
    providers,
    refresh,
    snapshot,
  };
}
