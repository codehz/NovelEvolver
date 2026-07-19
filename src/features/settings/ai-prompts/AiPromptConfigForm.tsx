import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import type { AiPromptConfigPublic, AiPromptConfigWrite } from "#shared/rpc/services/index";
import { AI_PROMPT_SLUG_PATTERN } from "#shared/rpc/services/index";

import {
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
import { SettingsFormActions } from "../SettingsFormActions";

type FormState = {
  title: string;
  slug: string;
  prompt: string;
};

type AiPromptConfigFormProps = {
  initial?: AiPromptConfigPublic | null;
  readOnly?: boolean;
  busy?: boolean;
  error?: string | null;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit?: (input: AiPromptConfigWrite) => boolean | void | Promise<boolean | void>;
};

function toFormState(initial?: AiPromptConfigPublic | null): FormState {
  return {
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    prompt: initial?.prompt ?? "",
  };
}

function isPromptFormDirty(form: FormState, baseline: FormState): boolean {
  return (
    form.title !== baseline.title || form.slug !== baseline.slug || form.prompt !== baseline.prompt
  );
}

export function AiPromptConfigForm({
  initial = null,
  readOnly = false,
  busy = false,
  error = null,
  formRef = null,
  onDirtyChange,
  onSubmit,
}: AiPromptConfigFormProps) {
  const isEdit = initial != null;
  const baselineRef = useRef(toFormState(initial));
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const dirty = useMemo(() => {
    if (readOnly) {
      return false;
    }
    return isPromptFormDirty(form, baselineRef.current);
  }, [form, readOnly]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const buildPayload = (): AiPromptConfigWrite | null => {
    if (readOnly || !onSubmit) {
      return null;
    }
    const title = form.title.trim();
    const slug = form.slug.trim();
    const prompt = form.prompt.trim();
    if (title === "" || slug === "" || prompt === "") {
      return null;
    }
    if (!AI_PROMPT_SLUG_PATTERN.test(slug)) {
      return null;
    }
    return {
      ...(isEdit ? { id: initial.id } : {}),
      title,
      slug,
      prompt,
    };
  };

  const submitPayload = async (payload: AiPromptConfigWrite): Promise<boolean> => {
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
    [form, readOnly, isEdit, initial, onSubmit],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (readOnly) return;
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
        <Field.Root className={settingsFieldRootClass} disabled={busy || readOnly} name="title">
          <Field.Label className={settingsFieldLabelClass}>标题</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus={!readOnly}
              className={settingsInputClass}
              placeholder={readOnly ? undefined : "例如：扩写段落"}
              readOnly={readOnly}
              required={!readOnly}
              value={form.title}
              onValueChange={(next) => {
                update("title", next);
              }}
            />
            {readOnly ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写标题。
              </Field.Error>
            )}
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy || readOnly} name="slug">
          <Field.Label className={settingsFieldLabelClass}>调用名</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsInputClass}
              pattern={readOnly ? undefined : AI_PROMPT_SLUG_PATTERN.source}
              placeholder={readOnly ? undefined : "expand"}
              readOnly={readOnly}
              required={!readOnly}
              spellCheck={false}
              value={form.slug}
              onValueChange={(next) => {
                update("slug", next);
              }}
            />
            {readOnly ? null : (
              <>
                <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                  请填写调用名。
                </Field.Error>
                <Field.Error className={settingsFieldErrorClass} match="patternMismatch">
                  须为小写字母开头，仅含 a-z、0-9、_、-。
                </Field.Error>
                <p className="mt-1 text-2xs text-app-muted">
                  侧栏输入 /调用名 可插入此模板；发送时展开为提示词正文。
                </p>
              </>
            )}
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy || readOnly} name="prompt">
          <Field.Label className={settingsFieldLabelClass}>提示词内容</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsTextareaClass}
              placeholder={readOnly ? undefined : "输入可复用的提示词正文…"}
              readOnly={readOnly}
              render={<textarea rows={8} />}
              required={!readOnly}
              value={form.prompt}
              onValueChange={(next) => {
                update("prompt", next);
              }}
            />
            {readOnly ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写提示词内容。
              </Field.Error>
            )}
          </div>
        </Field.Root>
      </div>

      {error ? <p className={settingsFormErrorClass}>{error}</p> : null}

      {readOnly ? null : <SettingsFormActions busy={busy} submitLabel={isEdit ? "保存" : "添加"} />}
    </Form>
  );
}
