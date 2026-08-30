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
} from "#domain/settings/ai-settings";
import { AI_AGENT_DESCRIPTION_MAX_LENGTH } from "#domain/settings/ai-settings";

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

/** Prefill values when creating a custom agent (e.g. duplicate). */
export type AiAgentConfigFormSeed = {
  name: string;
  description: string;
  systemPrompt: string;
  defaultModelId: string | null;
  availableToolNames: string[];
  userSelectable: boolean;
  subagentEligible: boolean;
  textOnlyMode: boolean;
};

type FormState = {
  name: string;
  description: string;
  systemPrompt: string;
  defaultModelId: string;
  availableToolNames: string[];
  userSelectable: boolean;
  subagentEligible: boolean;
  textOnlyMode: boolean;
};

const DESCRIPTION_MAX_LENGTH = AI_AGENT_DESCRIPTION_MAX_LENGTH;

type AiAgentConfigFormProps = {
  tools: AiAgentTool[];
  models: AiModelConfigPublic[];
  providers: AiProviderConfigPublic[];
  initial?: AiAgentConfigPublic | null;
  /** Prefill for create mode (ignored when `initial` is set). */
  seed?: AiAgentConfigFormSeed | null;
  /** Full form locked (view-only). */
  readOnly?: boolean;
  busy?: boolean;
  error?: string | null;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit?: (input: AiAgentConfigWrite) => boolean | void | Promise<boolean | void>;
};

function toFormState(
  initial?: AiAgentConfigPublic | null,
  seed?: AiAgentConfigFormSeed | null,
): FormState {
  if (initial != null) {
    return {
      name: initial.name,
      description: initial.description,
      systemPrompt: initial.systemPrompt,
      defaultModelId: initial.defaultModelId ?? "",
      availableToolNames: [...initial.availableToolNames],
      userSelectable: initial.userSelectable,
      subagentEligible: initial.subagentEligible,
      textOnlyMode: initial.textOnlyMode,
    };
  }
  if (seed != null) {
    return {
      name: seed.name,
      description: seed.description,
      systemPrompt: seed.systemPrompt,
      defaultModelId: seed.defaultModelId ?? "",
      availableToolNames: [...seed.availableToolNames],
      userSelectable: seed.userSelectable,
      subagentEligible: seed.subagentEligible,
      textOnlyMode: seed.textOnlyMode,
    };
  }
  return {
    name: "",
    description: "",
    systemPrompt: "",
    defaultModelId: "",
    availableToolNames: [],
    // New custom agents default to both channels enabled.
    userSelectable: true,
    subagentEligible: true,
    textOnlyMode: false,
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

function isAgentFormDirty(form: FormState, baseline: FormState, identityLocked: boolean): boolean {
  if (
    form.description !== baseline.description ||
    form.systemPrompt !== baseline.systemPrompt ||
    form.defaultModelId !== baseline.defaultModelId ||
    form.userSelectable !== baseline.userSelectable ||
    form.subagentEligible !== baseline.subagentEligible ||
    form.textOnlyMode !== baseline.textOnlyMode
  ) {
    return true;
  }
  if (identityLocked) {
    return false;
  }
  return (
    form.name !== baseline.name ||
    !sameToolNames(form.availableToolNames, baseline.availableToolNames)
  );
}

export function AiAgentConfigForm({
  tools,
  models,
  providers,
  initial = null,
  seed = null,
  readOnly = false,
  busy = false,
  error = null,
  formRef = null,
  onDirtyChange,
  onSubmit,
}: AiAgentConfigFormProps) {
  const isEdit = initial != null;
  const isBuiltin = initial?.builtin === true;
  const identityLocked = readOnly || isBuiltin;
  const channelsLocked = readOnly;
  const canEditDefaultModel = !readOnly;
  const canSubmit = !readOnly && onSubmit != null;
  const baselineRef = useRef(toFormState(initial, seed));
  const [form, setForm] = useState<FormState>(() => toFormState(initial, seed));

  const dirty = useMemo(() => {
    if (readOnly) {
      return false;
    }
    return isAgentFormDirty(form, baselineRef.current, identityLocked);
  }, [form, identityLocked, readOnly]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const buildPayload = (): AiAgentConfigWrite | null => {
    if (!canSubmit || !onSubmit) {
      return null;
    }
    const name = form.name.trim();
    const systemPrompt = form.systemPrompt.trim();
    if (systemPrompt === "" || (!identityLocked && name === "")) {
      return null;
    }
    return {
      ...(isEdit ? { id: initial.id } : {}),
      name,
      description: form.description.trim(),
      systemPrompt,
      defaultModelId: form.defaultModelId === "" ? null : form.defaultModelId,
      availableToolNames: form.availableToolNames,
      userSelectable: form.userSelectable,
      subagentEligible: form.subagentEligible,
      textOnlyMode: form.subagentEligible ? form.textOnlyMode : false,
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
    [form, canSubmit, identityLocked, isEdit, initial, onSubmit],
  );

  const providerNameById = new Map<string, string>();
  for (const p of providers) {
    providerNameById.set(p.id, p.name);
  }

  const selectableModels = useMemo(() => {
    if (form.textOnlyMode || !form.subagentEligible) {
      return models;
    }
    return models.filter((model) => model.supportsTools !== false);
  }, [form.subagentEligible, form.textOnlyMode, models]);

  const toolPickerReadOnly = identityLocked || form.textOnlyMode;
  const canEditTextOnlyMode = !readOnly && !isBuiltin && form.subagentEligible;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (readOnly) return;
    if (isBuiltin) {
      const allowed: (keyof FormState)[] = [
        "description",
        "systemPrompt",
        "defaultModelId",
        "userSelectable",
        "subagentEligible",
      ];
      if (!allowed.includes(key)) return;
    }
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "subagentEligible" && value === false) {
        next.textOnlyMode = false;
      }
      return next;
    });
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
          disabled={busy || identityLocked}
          name="name"
        >
          <Field.Label className={settingsFieldLabelClass}>名称</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus={!identityLocked}
              className={settingsInputClass}
              placeholder={identityLocked ? undefined : "例如：写作助手"}
              readOnly={identityLocked}
              required={!identityLocked}
              value={form.name}
              onValueChange={(next) => {
                update("name", next);
              }}
            />
            {identityLocked ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写名称。
              </Field.Error>
            )}
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || readOnly}
          name="description"
        >
          <Field.Label className={settingsFieldLabelClass}>简介</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsFieldHiddenControlClass}
              tabIndex={-1}
              value={form.description}
              onValueChange={(next) => {
                update("description", next.slice(0, DESCRIPTION_MAX_LENGTH));
              }}
            />
            <SettingsPlainTextEditor
              aria-label="简介"
              disabled={busy || readOnly}
              maxHeight="8rem"
              minHeight="3.5rem"
              placeholder={
                readOnly ? undefined : "首行用于选择器；完整多行简介会注入可用子代理目录…"
              }
              value={form.description}
              onValueChange={(next) => {
                update("description", next.slice(0, DESCRIPTION_MAX_LENGTH));
              }}
            />
            {readOnly ? null : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xs text-app-muted">
                  可选多行；选择器只显示首行（去 Markdown），全文写入父会话子代理目录。
                  {form.description.length > 0
                    ? ` ${form.description.length}/${DESCRIPTION_MAX_LENGTH}`
                    : null}
                </p>
                {isBuiltin && initial.defaultDescription != null ? (
                  <Button
                    disabled={busy || form.description === initial.defaultDescription}
                    variant="text"
                    onClick={() => {
                      update("description", initial.defaultDescription!);
                    }}
                  >
                    恢复默认
                  </Button>
                ) : null}
              </div>
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
                ...selectableModels.map((model) => {
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
          disabled={busy || identityLocked || form.textOnlyMode}
          name="availableToolNames"
        >
          <Field.Label className={settingsFieldLabelClass}>可用工具</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <AiAgentToolPicker
              disabled={busy || form.textOnlyMode}
              readOnly={toolPickerReadOnly}
              tools={tools}
              value={form.availableToolNames}
              onChange={(next) => {
                update("availableToolNames", next);
              }}
            />
            {form.textOnlyMode ? (
              <p className="mt-2 text-2xs text-app-muted">
                纯文本子代理运行时不会挂载工具；白名单仅保留以便关闭纯文本模式后恢复。
              </p>
            ) : null}
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || channelsLocked}
          name="userSelectable"
        >
          <Field.Label className={settingsFieldLabelClass}>可见性</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <div className="flex flex-col gap-2">
              <label
                className={cn(
                  settingsCheckboxLabelClass,
                  "items-center",
                  channelsLocked && "cursor-default text-app-muted",
                )}
              >
                <SettingsCheckbox
                  checked={form.userSelectable}
                  disabled={busy || channelsLocked}
                  readOnly={channelsLocked}
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
                  channelsLocked && "cursor-default text-app-muted",
                )}
              >
                <SettingsCheckbox
                  checked={form.subagentEligible}
                  disabled={busy || channelsLocked}
                  readOnly={channelsLocked}
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
              {canEditTextOnlyMode ? (
                <label className={cn(settingsCheckboxLabelClass, "items-center")}>
                  <SettingsCheckbox
                    checked={form.textOnlyMode}
                    disabled={busy}
                    onCheckedChange={(checked) => {
                      update("textOnlyMode", checked);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-app-foreground">纯文本子代理</span>
                    <span className="mt-0.5 block text-2xs text-app-muted">
                      开启后子运行不挂载工具，适合角色扮演与创意人格
                    </span>
                  </span>
                </label>
              ) : null}
              {isBuiltin ? (
                <p className="text-2xs text-app-muted">
                  内置 Agent 可关闭通道；名称与工具列表仍由代码固定。
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
