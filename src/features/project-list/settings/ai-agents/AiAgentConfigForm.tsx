import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useState } from "react";

import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentTool,
  AiModelConfigPublic,
  AiProviderConfigPublic,
} from "#shared/rpc/services/index";

import {
  settingsFieldControlCellClass,
  settingsFieldErrorClass,
  settingsFieldLabelClass,
  settingsFieldRootClass,
  settingsFormActionsClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsTextareaClass,
} from "../settings-chrome";
import { SettingsSelect } from "../SettingsSelect";
import { AiAgentToolPicker } from "./AiAgentToolPicker";

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
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const providerNameById = new Map<string, string>();
  for (const p of providers) {
    providerNameById.set(p.id, p.name);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Form
      className={settingsFormClass}
      onFormSubmit={() => {
        if (readOnly || !onSubmit) {
          return;
        }

        const payload: AiAgentConfigWrite = {
          ...(isEdit ? { id: initial.id } : {}),
          name: form.name.trim(),
          systemPrompt: form.systemPrompt.trim(),
          defaultModelId: form.defaultModelId === "" ? null : form.defaultModelId,
          availableToolNames: form.availableToolNames,
        };

        void onSubmit(payload);
      }}
    >
      <div className={settingsFormGridClass}>
        <Field.Root className={settingsFieldRootClass} disabled={busy || readOnly} name="name">
          <Field.Label className={settingsFieldLabelClass}>名称</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus={!readOnly}
              className={settingsInputClass}
              placeholder={readOnly ? undefined : "例如：写作助手"}
              readOnly={readOnly}
              required={!readOnly}
              value={form.name}
              onValueChange={(next) => {
                update("name", next);
              }}
            />
            {readOnly ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写名称。
              </Field.Error>
            )}
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || readOnly}
          name="systemPrompt"
        >
          <Field.Label className={settingsFieldLabelClass}>系统提示词</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsTextareaClass}
              placeholder={readOnly ? undefined : "设定 Agent 的行为、性格与限制…"}
              readOnly={readOnly}
              render={<textarea rows={5} />}
              required={!readOnly}
              value={form.systemPrompt}
              onValueChange={(next) => {
                update("systemPrompt", next);
              }}
            />
            {readOnly ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写系统提示词。
              </Field.Error>
            )}
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || readOnly}
          name="defaultModelId"
        >
          <Field.Label className={settingsFieldLabelClass}>默认模型</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <SettingsSelect
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
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || readOnly}
          name="availableToolNames"
        >
          <Field.Label className={settingsFieldLabelClass}>可用工具</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <AiAgentToolPicker
              disabled={busy}
              readOnly={readOnly}
              tools={tools}
              value={form.availableToolNames}
              onChange={(next) => {
                update("availableToolNames", next);
              }}
            />
          </div>
        </Field.Root>
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
    </Form>
  );
}
