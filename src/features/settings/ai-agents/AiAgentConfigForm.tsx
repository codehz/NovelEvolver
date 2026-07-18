import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useState } from "react";

import { Button } from "#app/shared/ui";
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
  /** Full form locked (view-only). */
  readOnly?: boolean;
  /**
   * Lock name / system prompt / tools but keep default model editable.
   * Used for builtin agents (definition is code-owned).
   */
  lockDefinitionFields?: boolean;
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
  lockDefinitionFields = false,
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AiAgentConfigFormProps) {
  const isEdit = initial != null;
  const definitionLocked = readOnly || lockDefinitionFields;
  const canEditDefaultModel = !readOnly;
  const canSubmit = !readOnly && onSubmit != null;
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const providerNameById = new Map<string, string>();
  for (const p of providers) {
    providerNameById.set(p.id, p.name);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (readOnly) return;
    if (lockDefinitionFields && key !== "defaultModelId") return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Form
      className={settingsFormClass}
      onFormSubmit={() => {
        if (!canSubmit || !onSubmit) {
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
        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || definitionLocked}
          name="name"
        >
          <Field.Label className={settingsFieldLabelClass}>名称</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus={!definitionLocked}
              className={settingsInputClass}
              placeholder={definitionLocked ? undefined : "例如：写作助手"}
              readOnly={definitionLocked}
              required={!definitionLocked}
              value={form.name}
              onValueChange={(next) => {
                update("name", next);
              }}
            />
            {definitionLocked ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写名称。
              </Field.Error>
            )}
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || definitionLocked}
          name="systemPrompt"
        >
          <Field.Label className={settingsFieldLabelClass}>系统提示词</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsTextareaClass}
              placeholder={definitionLocked ? undefined : "设定 Agent 的行为、性格与限制…"}
              readOnly={definitionLocked}
              render={<textarea rows={5} />}
              required={!definitionLocked}
              value={form.systemPrompt}
              onValueChange={(next) => {
                update("systemPrompt", next);
              }}
            />
            {definitionLocked ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写系统提示词。
              </Field.Error>
            )}
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || !canEditDefaultModel}
          name="defaultModelId"
        >
          <Field.Label className={settingsFieldLabelClass}>默认模型</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <SettingsSelect
              readOnly={!canEditDefaultModel}
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
          disabled={busy || definitionLocked}
          name="availableToolNames"
        >
          <Field.Label className={settingsFieldLabelClass}>可用工具</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <AiAgentToolPicker
              disabled={busy}
              readOnly={definitionLocked}
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
        <Button disabled={busy} onClick={onCancel}>
          {readOnly ? "返回" : "取消"}
        </Button>
        {canSubmit ? (
          <Button disabled={busy} type="submit" variant="primary">
            {isEdit ? "保存" : "添加"}
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
