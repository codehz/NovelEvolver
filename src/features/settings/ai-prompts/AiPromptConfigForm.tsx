import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useState } from "react";

import { Button } from "#app/shared/ui";
import type { AiPromptConfigPublic, AiPromptConfigWrite } from "#shared/rpc/services/index";
import { AI_PROMPT_SLUG_PATTERN } from "#shared/rpc/services/index";

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
  onCancel: () => void;
  onSubmit?: (input: AiPromptConfigWrite) => void | Promise<void>;
};

function toFormState(initial?: AiPromptConfigPublic | null): FormState {
  return {
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    prompt: initial?.prompt ?? "",
  };
}

export function AiPromptConfigForm({
  initial = null,
  readOnly = false,
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AiPromptConfigFormProps) {
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

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

        const payload: AiPromptConfigWrite = {
          ...(isEdit ? { id: initial.id } : {}),
          title: form.title.trim(),
          slug: form.slug.trim(),
          prompt: form.prompt.trim(),
        };

        void onSubmit(payload);
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

      <div className={settingsFormActionsClass}>
        <Button disabled={busy} onClick={onCancel}>
          {readOnly ? "返回" : "取消"}
        </Button>
        {readOnly ? null : (
          <Button disabled={busy} type="submit" variant="primary">
            {isEdit ? "保存" : "添加"}
          </Button>
        )}
      </div>
    </Form>
  );
}
