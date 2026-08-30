import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { NumberField } from "@base-ui/react/number-field";
import { useMemo, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { AppTooltip, Button } from "#app/shared/ui";
import type { AiRuntimePolicySnapshot, AiRuntimePolicyWrite } from "#domain/settings/ai-settings";
import { AI_RUNTIME_POLICY_LIMITS, DEFAULT_AI_RUNTIME_POLICY } from "#domain/settings/ai-settings";

import {
  settingsFieldControlCellClass,
  settingsFieldDescriptionClass,
  settingsFieldErrorClass,
  settingsFieldLabelClass,
  settingsFieldRootClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelSectionClass,
} from "../settings-chrome";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { useSettingsForm } from "../use-settings-form";

const policyFieldControlRowClass = cn("flex min-w-0 items-center gap-1");
const policyFieldNumberRootClass = cn("min-w-0 flex-1");

/** Stable form id for header submit association. */
export const AI_RUNTIME_POLICY_FORM_ID = "settings-ai-runtime-policy-form";

type PolicyFieldKey = keyof AiRuntimePolicyWrite;

type FormState = {
  [K in PolicyFieldKey]: number | null;
};

type FieldSpec = {
  key: PolicyFieldKey;
  label: string;
  description: string;
};

const MAIN_FIELDS: readonly FieldSpec[] = [
  {
    key: "maxToolRounds",
    label: "主代理最大工具轮数",
    description: `单次回复中工具循环的上限。默认 ${DEFAULT_AI_RUNTIME_POLICY.maxToolRounds}。`,
  },
] as const;

const SUBAGENT_FIELDS: readonly FieldSpec[] = [
  {
    key: "maxSubagentToolRounds",
    label: "子代理最大工具轮数",
    description: `单次 run_subagent 的独立工具循环预算。默认 ${DEFAULT_AI_RUNTIME_POLICY.maxSubagentToolRounds}。`,
  },
  {
    key: "maxParallelReadOnlySubagents",
    label: "只读/纯文本子代理并行度",
    description: `同一工具批次内只读或纯文本子代理生成阶段的最大并行数；可写子代理仍串行，output_target 落盘在批次末串行执行。默认 ${DEFAULT_AI_RUNTIME_POLICY.maxParallelReadOnlySubagents}。`,
  },
  {
    key: "maxParentSummaryChars",
    label: "父摘要最大字数",
    description: `传入子代理的 parent_summary 截断上限。默认 ${DEFAULT_AI_RUNTIME_POLICY.maxParentSummaryChars}。`,
  },
  {
    key: "maxFocusTargets",
    label: "焦点预载目标数",
    description: `子代理启动时自动注入的 focus 上限。默认 ${DEFAULT_AI_RUNTIME_POLICY.maxFocusTargets}。`,
  },
  {
    key: "maxFocusContentChars",
    label: "单焦点正文最大字数",
    description: `超长正文截断并提示 read_document。默认 ${DEFAULT_AI_RUNTIME_POLICY.maxFocusContentChars}。`,
  },
] as const;

type AiRuntimePolicyFormProps = {
  initial: AiRuntimePolicySnapshot;
  busy?: boolean;
  error?: string | null;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: AiRuntimePolicyWrite) => boolean | void | Promise<boolean | void>;
};

function toFormState(initial: AiRuntimePolicySnapshot): FormState {
  return {
    maxToolRounds: initial.maxToolRounds,
    maxSubagentToolRounds: initial.maxSubagentToolRounds,
    maxParallelReadOnlySubagents: initial.maxParallelReadOnlySubagents,
    maxParentSummaryChars: initial.maxParentSummaryChars,
    maxFocusTargets: initial.maxFocusTargets,
    maxFocusContentChars: initial.maxFocusContentChars,
  };
}

function isPositiveIntegerInRange(value: number | null, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function toWritePayload(form: FormState): AiRuntimePolicyWrite {
  return {
    maxToolRounds: form.maxToolRounds ?? DEFAULT_AI_RUNTIME_POLICY.maxToolRounds,
    maxSubagentToolRounds:
      form.maxSubagentToolRounds ?? DEFAULT_AI_RUNTIME_POLICY.maxSubagentToolRounds,
    maxParallelReadOnlySubagents:
      form.maxParallelReadOnlySubagents ?? DEFAULT_AI_RUNTIME_POLICY.maxParallelReadOnlySubagents,
    maxParentSummaryChars:
      form.maxParentSummaryChars ?? DEFAULT_AI_RUNTIME_POLICY.maxParentSummaryChars,
    maxFocusTargets: form.maxFocusTargets ?? DEFAULT_AI_RUNTIME_POLICY.maxFocusTargets,
    maxFocusContentChars:
      form.maxFocusContentChars ?? DEFAULT_AI_RUNTIME_POLICY.maxFocusContentChars,
  };
}

export function AiRuntimePolicyForm({
  initial,
  busy = false,
  error = null,
  formRef,
  onDirtyChange,
  onSubmit,
}: AiRuntimePolicyFormProps) {
  const initialState = useMemo(() => toFormState(initial), [initial]);

  const {
    values: form,
    setField,
    submit,
    formElementRef,
  } = useSettingsForm<FormState>({
    initial: initialState,
    formRef,
    onDirtyChange,
    busy,
    onSubmit: async (values) => {
      const payload = toWritePayload(values);
      for (const key of Object.keys(payload) as PolicyFieldKey[]) {
        const limit = AI_RUNTIME_POLICY_LIMITS[key];
        if (!isPositiveIntegerInRange(payload[key], limit.min, limit.max)) {
          formElementRef.current?.reportValidity();
          return false;
        }
      }
      return onSubmit(payload);
    },
  });

  const renderField = (spec: FieldSpec) => {
    const limit = AI_RUNTIME_POLICY_LIMITS[spec.key];
    const defaultValue = DEFAULT_AI_RUNTIME_POLICY[spec.key];
    const canReset = form[spec.key] !== defaultValue;
    const resetLabel = `恢复「${spec.label}」为默认值 ${defaultValue}`;
    return (
      <Field.Root
        key={spec.key}
        className={settingsFieldRootClass}
        disabled={busy}
        name={spec.key}
        validate={(value) =>
          isPositiveIntegerInRange(
            typeof value === "number" ? value : Number(value),
            limit.min,
            limit.max,
          )
            ? null
            : `请输入 ${limit.min}–${limit.max} 的整数。`
        }
      >
        <Field.Label className={settingsFieldLabelClass}>{spec.label}</Field.Label>
        <div className={settingsFieldControlCellClass}>
          <div className={policyFieldControlRowClass}>
            <NumberField.Root
              allowOutOfRange
              className={policyFieldNumberRootClass}
              min={limit.min}
              max={limit.max}
              required
              step={1}
              value={form[spec.key]}
              onValueChange={(next) => {
                setField(spec.key, next);
              }}
            >
              <NumberField.Input
                className={settingsInputClass}
                placeholder={String(defaultValue)}
              />
            </NumberField.Root>
            {canReset ? (
              <AppTooltip label={`恢复默认（${defaultValue}）`} side="left">
                <Button
                  aria-label={resetLabel}
                  disabled={busy}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setField(spec.key, defaultValue);
                  }}
                >
                  <span aria-hidden="true" className="icon-[codicon--discard] text-sm" />
                </Button>
              </AppTooltip>
            ) : null}
          </div>
          <Field.Description className={settingsFieldDescriptionClass}>
            {spec.description} 允许范围 {limit.min}–{limit.max}。
          </Field.Description>
          <Field.Error className={settingsFieldErrorClass} />
        </div>
      </Field.Root>
    );
  };

  return (
    <Form
      id={AI_RUNTIME_POLICY_FORM_ID}
      className={settingsPanelSectionClass}
      ref={formElementRef}
      onFormSubmit={() => {
        void submit();
      }}
    >
      <div className={settingsFormClass}>
        <p className={settingsListItemMetaClass}>
          修改仅对之后新发起的对话请求与子代理运行生效；进行中的运行不会中途切换预算。
        </p>

        <section className="flex flex-col gap-2">
          <h4 className={settingsListItemTitleClass}>主对话预算</h4>
          <div className={settingsFormGridClass}>{MAIN_FIELDS.map(renderField)}</div>
        </section>

        <section className="flex flex-col gap-2">
          <h4 className={settingsListItemTitleClass}>子代理预算与注入</h4>
          <div className={settingsFormGridClass}>{SUBAGENT_FIELDS.map(renderField)}</div>
        </section>

        {error ? (
          <p className={settingsFormErrorClass} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Form>
  );
}
