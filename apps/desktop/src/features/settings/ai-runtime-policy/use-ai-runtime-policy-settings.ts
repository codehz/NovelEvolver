import {
  DEFAULT_AI_RUNTIME_POLICY,
  type AiRuntimePolicyWrite,
} from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useRef, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";

import { settingsErrorMessage } from "../settings-error";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { useSettingsEditorLeave } from "../use-settings-editor-leave";
import { useSettingsMutation } from "../use-settings-mutation";

const runtimePolicySettingsLoader = createAsyncLoader(() => settingsService.getAiRuntimePolicy());

type UseAiRuntimePolicySettingsOptions = {
  /** Whether the runtime-policy tab is the active settings category. */
  active?: boolean;
};

export function useAiRuntimePolicySettings({
  active = true,
}: UseAiRuntimePolicySettingsOptions = {}) {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(runtimePolicySettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [editorDirty, setEditorDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<SettingsFormHandle | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined ? settingsErrorMessage(loadErrorRaw, "加载 AI 运行策略失败") : null;

  const { requestLeave } = useSettingsEditorLeave({
    active,
    editorOpen: snapshot !== undefined,
    busy,
    dirty: editorDirty,
    formRef,
    closeEditor: () => {
      clearActionError();
      setEditorDirty(false);
    },
    onDiscard: () => {
      setEditorDirty(false);
      setFormKey((key) => key + 1);
    },
  });

  const handleSubmit = async (input: AiRuntimePolicyWrite): Promise<boolean> => {
    const result = await runMutation(
      () => settingsService.setAiRuntimePolicy(input),
      "保存运行策略失败",
    );
    if (result === null) {
      return false;
    }
    setEditorDirty(false);
    return true;
  };

  const handleRestoreDefaults = async (): Promise<boolean> => {
    const result = await runMutation(
      () => settingsService.setAiRuntimePolicy({ ...DEFAULT_AI_RUNTIME_POLICY }),
      "恢复默认运行策略失败",
    );
    if (result === null) {
      return false;
    }
    setEditorDirty(false);
    setFormKey((key) => key + 1);
    return true;
  };

  return {
    actionError,
    busy,
    formKey,
    formRef,
    isLoading,
    loadError,
    onDirtyChange: setEditorDirty,
    refresh,
    requestLeave,
    snapshot,
    handleSubmit,
    handleRestoreDefaults,
  };
}
