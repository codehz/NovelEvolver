import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { NumberField } from "@base-ui/react/number-field";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { AppTooltip, Button } from "#app/shared/ui";
import type { AiRuntimePolicySnapshot, AiRuntimePolicyWrite } from "#shared/rpc/services/index";
import { AI_RUNTIME_POLICY_LIMITS, DEFAULT_AI_RUNTIME_POLICY } from "#shared/rpc/services/index";

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
    maxParentSummaryChars: initial.maxParentSummaryChars,
    maxFocusTargets: initial.maxFocusTargets,
    maxFocusContentChars: initial.maxFocusContentChars,
  };
}

function isPositiveIntegerInRange(value: number | null, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

export function AiRuntimePolicyForm({
  initial,
  busy = false,
  error = null,
  formRef,
  onDirtyChange,
  onSubmit,
}: AiRuntimePolicyFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [baseline, setBaseline] = useState<FormState>(() => toFormState(initial));
  const formElementRef = useRef<HTMLFormElement | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    const next = toFormState(initial);
    setForm(next);
    setBaseline(next);
  }, [initial]);

  const dirty = useMemo(
    () =>
      form.maxToolRounds !== baseline.maxToolRounds ||
      form.maxSubagentToolRounds !== baseline.maxSubagentToolRounds ||
      form.maxParentSummaryChars !== baseline.maxParentSummaryChars ||
      form.maxFocusTargets !== baseline.maxFocusTargets ||
      form.maxFocusContentChars !== baseline.maxFocusContentChars,
    [baseline, form],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const submit = async (): Promise<boolean> => {
    if (busy) {
      return false;
    }
    const payload: AiRuntimePolicyWrite = {
      maxToolRounds: form.maxToolRounds ?? DEFAULT_AI_RUNTIME_POLICY.maxToolRounds,
      maxSubagentToolRounds:
        form.maxSubagentToolRounds ?? DEFAULT_AI_RUNTIME_POLICY.maxSubagentToolRounds,
      maxParentSummaryChars:
        form.maxParentSummaryChars ?? DEFAULT_AI_RUNTIME_POLICY.maxParentSummaryChars,
      maxFocusTargets: form.maxFocusTargets ?? DEFAULT_AI_RUNTIME_POLICY.maxFocusTargets,
      maxFocusContentChars:
        form.maxFocusContentChars ?? DEFAULT_AI_RUNTIME_POLICY.maxFocusContentChars,
    };

    for (const key of Object.keys(payload) as PolicyFieldKey[]) {
      const limit = AI_RUNTIME_POLICY_LIMITS[key];
      if (!isPositiveIntegerInRange(payload[key], limit.min, limit.max)) {
        formElementRef.current?.reportValidity();
        return false;
      }
    }

    const result = await onSubmitRef.current(payload);
    return result !== false;
  };

  useImperativeHandle(formRef, () => ({
    save: submit,
  }));

  const update = (key: PolicyFieldKey, value: number | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
                update(spec.key, next);
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
                    update(spec.key, defaultValue);
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
