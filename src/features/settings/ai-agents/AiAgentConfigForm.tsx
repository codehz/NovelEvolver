import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentTool,
  AiModelConfigPublic,
  AiProviderConfigPublic,
} from "#shared/rpc/services/index";

import {
  settingsCheckboxLabelClass,
  settingsFieldControlCellClass,
  settingsFieldErrorClass,
  settingsFieldLabelClass,
  settingsFieldRootClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
  settingsTextareaClass,
} from "../settings-chrome";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { SettingsCheckbox } from "../SettingsCheckbox";
import { SettingsFormActions } from "../SettingsFormActions";
import { SettingsSelect } from "../SettingsSelect";
import { AiAgentToolPicker } from "./AiAgentToolPicker";

type FormState = {
  name: string;
  systemPrompt: string;
  defaultModelId: string;
  availableToolNames: string[];
  userSelectable: boolean;
  subagentEligible: boolean;
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
  onSubmit?: (input: AiAgentConfigWrite) => boolean | void | Promise<boolean | void>;
};

function toFormState(initial?: AiAgentConfigPublic | null): FormState {
  return {
    name: initial?.name ?? "",
    systemPrompt: initial?.systemPrompt ?? "",
    defaultModelId: initial?.defaultModelId ?? "",
    availableToolNames: initial ? [...initial.availableToolNames] : [],
    // New custom agents default to both channels enabled.
    userSelectable: initial?.userSelectable ?? true,
    subagentEligible: initial?.subagentEligible ?? true,
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
    !sameToolNames(form.availableToolNames, baseline.availableToolNames) ||
    form.userSelectable !== baseline.userSelectable ||
    form.subagentEligible !== baseline.subagentEligible
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
      userSelectable: form.userSelectable,
      subagentEligible: form.subagentEligible,
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

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || definitionLocked}
          name="userSelectable"
        >
          <Field.Label className={settingsFieldLabelClass}>可见性</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <div className="flex flex-col gap-2">
              <label
                className={cn(
                  settingsCheckboxLabelClass,
                  "items-center",
                  definitionLocked && "cursor-default text-app-muted",
                )}
              >
                <SettingsCheckbox
                  checked={form.userSelectable}
                  disabled={busy || definitionLocked}
                  readOnly={definitionLocked}
                  onCheckedChange={(checked) => {
                    update("userSelectable", checked);
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-app-foreground">在对话中可选</span>
                  <span className="mt-0.5 block text-2xs text-app-muted">
                    关闭后不会出现在聊天 Agent 选择器中
                  </span>
                </span>
              </label>
              <label
                className={cn(
                  settingsCheckboxLabelClass,
                  "items-center",
                  definitionLocked && "cursor-default text-app-muted",
                )}
              >
                <SettingsCheckbox
                  checked={form.subagentEligible}
                  disabled={busy || definitionLocked}
                  readOnly={definitionLocked}
                  onCheckedChange={(checked) => {
                    update("subagentEligible", checked);
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-app-foreground">可用作子代理</span>
                  <span className="mt-0.5 block text-2xs text-app-muted">
                    关闭后无法被 run_subagent 委派
                  </span>
                </span>
              </label>
              {definitionLocked ? (
                <p className="text-2xs text-app-muted">
                  内置 Agent 的可见性与子代理资格由代码固定。
                </p>
              ) : null}
            </div>
          </div>
        </Field.Root>
      </div>

      {error ? <p className={settingsFormErrorClass}>{error}</p> : null}

      {canSubmit ? (
        <SettingsFormActions busy={busy} submitLabel={isEdit ? "保存" : "添加"} />
      ) : null}
    </Form>
  );
}
