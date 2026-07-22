import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
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
  settingsFieldHiddenControlClass,
  settingsFieldLabelClass,
  settingsFieldRootClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
} from "../settings-chrome";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { SettingsCheckbox } from "../SettingsCheckbox";
import { SettingsPlainTextEditor } from "../SettingsPlainTextEditor";
import { SettingsSelect } from "../SettingsSelect";
import { AiAgentToolPicker } from "./AiAgentToolPicker";

/** Stable form id for header submit association. */
export const AI_AGENT_CONFIG_FORM_ID = "settings-ai-agent-form";

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
  fixedFieldsLocked: boolean,
): boolean {
  if (
    form.systemPrompt !== baseline.systemPrompt ||
    form.defaultModelId !== baseline.defaultModelId
  ) {
    return true;
  }
  if (fixedFieldsLocked) {
    return false;
  }
  return (
    form.name !== baseline.name ||
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
  busy = false,
  error = null,
  formRef = null,
  onDirtyChange,
  onSubmit,
}: AiAgentConfigFormProps) {
  const isEdit = initial != null;
  const isBuiltin = initial?.builtin === true;
  const fixedFieldsLocked = readOnly || isBuiltin;
  const canEditDefaultModel = !readOnly;
  const canSubmit = !readOnly && onSubmit != null;
  const baselineRef = useRef(toFormState(initial));
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const dirty = useMemo(() => {
    if (readOnly) {
      return false;
    }
    return isAgentFormDirty(form, baselineRef.current, fixedFieldsLocked);
  }, [fixedFieldsLocked, form, readOnly]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const buildPayload = (): AiAgentConfigWrite | null => {
    if (!canSubmit || !onSubmit) {
      return null;
    }
    const name = form.name.trim();
    const systemPrompt = form.systemPrompt.trim();
    if (systemPrompt === "" || (!fixedFieldsLocked && name === "")) {
      return null;
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
    return result !== false && result !== null;
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
    [form, canSubmit, fixedFieldsLocked, isEdit, initial, onSubmit],
  );

  const providerNameById = new Map<string, string>();
  for (const p of providers) {
    providerNameById.set(p.id, p.name);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (readOnly) return;
    if (isBuiltin && key !== "systemPrompt" && key !== "defaultModelId") return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Form
      id={AI_AGENT_CONFIG_FORM_ID}
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
          disabled={busy || fixedFieldsLocked}
          name="name"
        >
          <Field.Label className={settingsFieldLabelClass}>名称</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus={!fixedFieldsLocked}
              className={settingsInputClass}
              placeholder={fixedFieldsLocked ? undefined : "例如：写作助手"}
              readOnly={fixedFieldsLocked}
              required={!fixedFieldsLocked}
              value={form.name}
              onValueChange={(next) => {
                update("name", next);
              }}
            />
            {fixedFieldsLocked ? null : (
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
              className={settingsFieldHiddenControlClass}
              required={!readOnly}
              tabIndex={-1}
              value={form.systemPrompt}
              onValueChange={(next) => {
                update("systemPrompt", next);
              }}
            />
            <SettingsPlainTextEditor
              aria-label="系统提示词"
              disabled={busy || readOnly}
              placeholder={readOnly ? undefined : "设定 Agent 的行为、性格与限制…"}
              value={form.systemPrompt}
              onValueChange={(next) => {
                update("systemPrompt", next);
              }}
            />
            {readOnly ? null : (
              <>
                <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                  请填写系统提示词。
                </Field.Error>
                {isBuiltin && initial.defaultSystemPrompt ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-2xs text-app-muted">恢复后需保存才会生效。</p>
                    <Button
                      disabled={busy || form.systemPrompt === initial.defaultSystemPrompt}
                      variant="text"
                      onClick={() => {
                        update("systemPrompt", initial.defaultSystemPrompt!);
                      }}
                    >
                      恢复默认
                    </Button>
                  </div>
                ) : null}
              </>
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
          disabled={busy || fixedFieldsLocked}
          name="availableToolNames"
        >
          <Field.Label className={settingsFieldLabelClass}>可用工具</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <AiAgentToolPicker
              disabled={busy}
              readOnly={fixedFieldsLocked}
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
          disabled={busy || fixedFieldsLocked}
          name="userSelectable"
        >
          <Field.Label className={settingsFieldLabelClass}>可见性</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <div className="flex flex-col gap-2">
              <label
                className={cn(
                  settingsCheckboxLabelClass,
                  "items-center",
                  fixedFieldsLocked && "cursor-default text-app-muted",
                )}
              >
                <SettingsCheckbox
                  checked={form.userSelectable}
                  disabled={busy || fixedFieldsLocked}
                  readOnly={fixedFieldsLocked}
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
                  fixedFieldsLocked && "cursor-default text-app-muted",
                )}
              >
                <SettingsCheckbox
                  checked={form.subagentEligible}
                  disabled={busy || fixedFieldsLocked}
                  readOnly={fixedFieldsLocked}
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
              {fixedFieldsLocked ? (
                <p className="text-2xs text-app-muted">
                  内置 Agent 的可见性与子代理资格由代码固定。
                </p>
              ) : null}
            </div>
          </div>
        </Field.Root>
      </div>

      {error ? <p className={settingsFormErrorClass}>{error}</p> : null}
    </Form>
  );
}
