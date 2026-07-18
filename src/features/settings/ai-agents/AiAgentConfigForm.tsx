import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

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
import type { SettingsFormHandle } from "../settings-leave-guard";
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
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onSubmit?: (input: AiAgentConfigWrite) => boolean | void | Promise<boolean | void>;
};

function toFormState(initial?: AiAgentConfigPublic | null): FormState {
  return {
    name: initial?.name ?? "",
    systemPrompt: initial?.systemPrompt ?? "",
    defaultModelId: initial?.defaultModelId ?? "",
    availableToolNames: initial ? [...initial.availableToolNames] : [],
  };
}

function sameToolNames(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

function isAgentFormDirty(
  form: FormState,
  baseline: FormState,
  lockDefinitionFields: boolean,
): boolean {
  if (form.defaultModelId !== baseline.defaultModelId) {
    return true;
  }
  if (lockDefinitionFields) {
    return false;
  }
  return (
    form.name !== baseline.name ||
    form.systemPrompt !== baseline.systemPrompt ||
    !sameToolNames(form.availableToolNames, baseline.availableToolNames)
  );
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
  formRef = null,
  onDirtyChange,
  onCancel,
  onSubmit,
}: AiAgentConfigFormProps) {
  const isEdit = initial != null;
  const definitionLocked = readOnly || lockDefinitionFields;
  const canEditDefaultModel = !readOnly;
  const canSubmit = !readOnly && onSubmit != null;
  const baselineRef = useRef(toFormState(initial));
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const dirty = useMemo(() => {
    if (readOnly) {
      return false;
    }
    return isAgentFormDirty(form, baselineRef.current, lockDefinitionFields);
  }, [form, lockDefinitionFields, readOnly]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const buildPayload = (): AiAgentConfigWrite | null => {
    if (!canSubmit || !onSubmit) {
      return null;
    }
    const name = form.name.trim();
    const systemPrompt = form.systemPrompt.trim();
    if (!definitionLocked) {
      if (name === "" || systemPrompt === "") {
        return null;
      }
    }
    return {
      ...(isEdit ? { id: initial.id } : {}),
      name,
      systemPrompt,
      defaultModelId: form.defaultModelId === "" ? null : form.defaultModelId,
      availableToolNames: form.availableToolNames,
    };
  };

  const submitPayload = async (payload: AiAgentConfigWrite): Promise<boolean> => {
    if (!onSubmit) {
      return false;
    }
    const result = await onSubmit(payload);
    return result !== false;
  };

  useImperativeHandle(
    formRef,
    () => ({
      save: async () => {
        const payload = buildPayload();
        if (payload == null) {
          return false;
        }
        return submitPayload(payload);
      },
    }),
    [form, canSubmit, definitionLocked, isEdit, initial, onSubmit],
  );

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
        const payload = buildPayload();
        if (payload == null) {
          return;
        }
        void submitPayload(payload);
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
