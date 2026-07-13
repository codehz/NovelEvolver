import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { useId, useState, type SubmitEvent } from "react";

import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentTool,
  AiModelConfigPublic,
  AiProviderConfigPublic,
} from "#shared/rpc/services/index";

import {
  settingsCheckboxLabelClass,
  settingsFieldLabelClass,
  settingsFormActionsClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "../settings-chrome";
import { SettingsCheckbox } from "../SettingsCheckbox";
import { SettingsSelect } from "../SettingsSelect";

type FormState = {
  name: string;
  systemPrompt: string;
  defaultModelId: string;
  availableToolNames: string[];
};

type AiAgentConfigFormProps = {
  tools: AiAgentTool[];
  models: AiModelConfigPublic[];
  providers: AiProviderConfigPublic[];
  initial?: AiAgentConfigPublic | null;
  readOnly?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit?: (input: AiAgentConfigWrite) => void | Promise<void>;
};

function toFormState(initial?: AiAgentConfigPublic | null): FormState {
  return {
    name: initial?.name ?? "",
    systemPrompt: initial?.systemPrompt ?? "",
    defaultModelId: initial?.defaultModelId ?? "",
    availableToolNames: initial ? [...initial.availableToolNames] : [],
  };
}

export function AiAgentConfigForm({
  tools,
  models,
  providers,
  initial = null,
  readOnly = false,
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AiAgentConfigFormProps) {
  const formId = useId();
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const providerNameById = new Map<string, string>();
  for (const p of providers) {
    providerNameById.set(p.id, p.name);
  }

  const nameId = `${formId}-name`;
  const systemPromptId = `${formId}-system-prompt`;
  const defaultModelIdField = `${formId}-default-model`;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || !onSubmit) return;

    const payload: AiAgentConfigWrite = {
      ...(isEdit ? { id: initial.id } : {}),
      name: form.name.trim(),
      systemPrompt: form.systemPrompt.trim(),
      defaultModelId: form.defaultModelId === "" ? null : form.defaultModelId,
      availableToolNames: form.availableToolNames,
    };

    void onSubmit(payload);
  };

  return (
    <form className={settingsFormClass} onSubmit={handleSubmit}>
      <div className={settingsFormGridClass}>
        <label className={settingsFieldLabelClass} htmlFor={nameId}>
          名称
        </label>
        <input
          autoFocus={!readOnly}
          className={settingsInputClass}
          disabled={busy || readOnly}
          id={nameId}
          placeholder={readOnly ? undefined : "例如：写作助手"}
          readOnly={readOnly}
          required={!readOnly}
          type="text"
          value={form.name}
          onChange={(event) => {
            update("name", event.target.value);
          }}
        />

        <label className={settingsFieldLabelClass} htmlFor={systemPromptId}>
          系统提示词
        </label>
        <textarea
          className={settingsInputClass}
          disabled={busy || readOnly}
          id={systemPromptId}
          placeholder={readOnly ? undefined : "设定 Agent 的行为、性格与限制…"}
          readOnly={readOnly}
          required={!readOnly}
          rows={5}
          value={form.systemPrompt}
          onChange={(event) => {
            update("systemPrompt", event.target.value);
          }}
        />

        <label className={settingsFieldLabelClass} htmlFor={defaultModelIdField}>
          默认模型
        </label>
        <SettingsSelect
          disabled={busy || readOnly}
          id={defaultModelIdField}
          readOnly={readOnly}
          value={form.defaultModelId}
          options={[
            { value: "", label: "继承对话默认模型" },
            ...models.map((model) => {
              const providerName = providerNameById.get(model.providerId);
              const label = providerName ? `${model.name}（${providerName}）` : model.name;
              return { value: model.id, label };
            }),
          ]}
          onValueChange={(next) => {
            update("defaultModelId", next);
          }}
        />

        <label className={settingsFieldLabelClass}>可用工具</label>
        <CheckboxGroup
          className="flex flex-col gap-1.5"
          disabled={busy || readOnly}
          value={form.availableToolNames}
          onValueChange={(next) => {
            update("availableToolNames", next);
          }}
        >
          {tools.map((tool) => (
            <label key={tool.name} className={settingsCheckboxLabelClass}>
              <SettingsCheckbox value={tool.name} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="font-medium">{tool.name}</span>
                {tool.description ? (
                  <>
                    ：<span className="text-app-muted">{tool.description}</span>
                  </>
                ) : null}
              </span>
            </label>
          ))}
        </CheckboxGroup>
      </div>

      {error ? <p className={settingsFormErrorClass}>{error}</p> : null}

      <div className={settingsFormActionsClass}>
        <button
          className={settingsSecondaryButtonClass}
          disabled={busy}
          type="button"
          onClick={onCancel}
        >
          {readOnly ? "返回" : "取消"}
        </button>
        {readOnly ? null : (
          <button className={settingsPrimaryButtonClass} disabled={busy} type="submit">
            {isEdit ? "保存" : "添加"}
          </button>
        )}
      </div>
    </form>
  );
}
