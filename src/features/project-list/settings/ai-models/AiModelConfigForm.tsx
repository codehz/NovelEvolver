import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { NumberField } from "@base-ui/react/number-field";
import { useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiProviderConfigPublic,
} from "#shared/rpc/services/index";
import {
  DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS,
  isLowMaxOutputTokensForNovelAgent,
} from "#shared/rpc/services/index";

import {
  settingsFieldControlCellClass,
  settingsFieldDescriptionClass,
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

type FormState = {
  providerId: string;
  name: string;
  model: string;
  maxOutputTokens: number | null;
  /** null means not configured. */
  contextLength: number | null;
  /** Raw JSON text for headers; empty string means not configured. */
  headersText: string;
  /** Raw JSON text for extraBody; empty string means not configured. */
  extraBodyText: string;
};

type AiModelConfigFormProps = {
  providers: readonly AiProviderConfigPublic[];
  initial?: AiModelConfigPublic | null;
  defaultProviderId?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: AiModelConfigWrite) => void | Promise<void>;
};

function recordToEditorText(value: Record<string, unknown> | undefined | null): string {
  if (!value || Object.keys(value).length === 0) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

function toFormState(
  initial: AiModelConfigPublic | null | undefined,
  defaultProviderId: string,
): FormState {
  return {
    providerId: initial?.providerId ?? defaultProviderId,
    name: initial?.name ?? "",
    model: initial?.model ?? "",
    maxOutputTokens: initial?.maxOutputTokens ?? DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS,
    contextLength: initial?.contextLength ?? null,
    headersText: recordToEditorText(initial?.headers),
    extraBodyText: recordToEditorText(initial?.extraBody),
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseHeadersText(
  text: string,
): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, value: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, error: "headers 不是合法 JSON。" };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: "headers 必须是 JSON 对象。" };
  }

  const value: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof key !== "string" || key.trim() === "") {
      return { ok: false, error: "headers 的键不能为空。" };
    }
    if (typeof entry !== "string") {
      return { ok: false, error: `headers 的值必须是字符串（键：${key}）。` };
    }
    value[key] = entry;
  }

  return { ok: true, value };
}

function parseExtraBodyText(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, value: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, error: "extraBody 不是合法 JSON。" };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: "extraBody 必须是 JSON 对象。" };
  }

  return { ok: true, value: { ...parsed } };
}

const maxOutputTokensWarningClass = cn(
  "rounded-md border border-ctp-yellow/40 bg-ctp-yellow/10 px-2 py-1.5 text-2xs text-ctp-yellow",
);

export function AiModelConfigForm({
  providers,
  initial = null,
  defaultProviderId = "",
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AiModelConfigFormProps) {
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() =>
    toFormState(initial, defaultProviderId || providers[0]?.id || ""),
  );

  const showLowMaxOutputTokensWarning =
    form.maxOutputTokens !== null && isLowMaxOutputTokensForNovelAgent(form.maxOutputTokens);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (providers.length === 0) {
    return <p className="text-xs text-app-muted">请先添加至少一个 API 供应商，再配置模型。</p>;
  }

  return (
    <Form
      className={settingsFormClass}
      onFormSubmit={() => {
        if (!isPositiveInteger(form.maxOutputTokens)) {
          return;
        }
        if (form.contextLength !== null && !isPositiveInteger(form.contextLength)) {
          return;
        }

        const headersResult = parseHeadersText(form.headersText);
        if (!headersResult.ok) {
          return;
        }
        const extraBodyResult = parseExtraBodyText(form.extraBodyText);
        if (!extraBodyResult.ok) {
          return;
        }

        const payload: AiModelConfigWrite = {
          ...(isEdit ? { id: initial.id } : {}),
          providerId: form.providerId,
          name: form.name,
          model: form.model,
          maxOutputTokens: form.maxOutputTokens,
          contextLength: form.contextLength,
          headers: headersResult.value,
          extraBody: extraBodyResult.value,
        };

        void onSubmit(payload);
      }}
    >
      <div className={settingsFormGridClass}>
        <Field.Root className={settingsFieldRootClass} disabled={busy} name="providerId">
          <Field.Label className={settingsFieldLabelClass}>供应商</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <SettingsSelect
              required
              value={form.providerId}
              options={providers.map((provider) => ({
                value: provider.id,
                label: provider.name,
              }))}
              onValueChange={(next) => {
                update("providerId", next);
              }}
            />
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="name">
          <Field.Label className={settingsFieldLabelClass}>显示名称</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus
              className={settingsInputClass}
              placeholder="例如：写作助手 GPT-4o"
              required
              value={form.name}
              onValueChange={(next) => {
                update("name", next);
              }}
            />
            <Field.Error className={settingsFieldErrorClass} match="valueMissing">
              请填写显示名称。
            </Field.Error>
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="model">
          <Field.Label className={settingsFieldLabelClass}>模型 ID</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsInputClass}
              placeholder="例如：gpt-4o"
              required
              value={form.model}
              onValueChange={(next) => {
                update("model", next);
              }}
            />
            <Field.Error className={settingsFieldErrorClass} match="valueMissing">
              请填写模型 ID。
            </Field.Error>
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="maxOutputTokens"
          validate={(value) =>
            isPositiveInteger(value) ? null : "请输入大于 0 的整数作为最大输出 token。"
          }
        >
          <Field.Label className={settingsFieldLabelClass}>最大输出 token</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <NumberField.Root
              allowOutOfRange
              min={1}
              required
              step={1}
              value={form.maxOutputTokens}
              onValueChange={(next) => {
                update("maxOutputTokens", next);
              }}
            >
              <NumberField.Input
                className={settingsInputClass}
                placeholder={String(DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS)}
              />
            </NumberField.Root>
            <Field.Description className={settingsFieldDescriptionClass}>
              单次模型回复允许生成的最大 token 数。默认 {DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS}。
            </Field.Description>
            {showLowMaxOutputTokensWarning ? (
              <p className={maxOutputTokensWarningClass} role="status">
                当前上限 {form.maxOutputTokens} token，对小说写作 Agent
                偏少，长段正文或大纲容易被截断。建议提高到 8192 或更高（需符合模型与服务商上限）。
              </p>
            ) : null}
            <Field.Error className={settingsFieldErrorClass} />
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="contextLength"
          validate={(value) => {
            if (value == null || value === "") {
              return null;
            }
            return isPositiveInteger(value) ? null : "上下文长度请留空，或输入大于 0 的整数。";
          }}
        >
          <Field.Label className={settingsFieldLabelClass}>上下文长度</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <NumberField.Root
              allowOutOfRange
              min={1}
              step={1}
              value={form.contextLength}
              onValueChange={(next) => {
                update("contextLength", next);
              }}
            >
              <NumberField.Input className={settingsInputClass} placeholder="可选，例如 128000" />
            </NumberField.Root>
            <Field.Description className={settingsFieldDescriptionClass}>
              模型上下文窗口（token）。用于侧边栏显示当前占用占比；留空表示不统计。不会传给 API。
            </Field.Description>
            <Field.Error className={settingsFieldErrorClass} />
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="headersText"
          validate={(value) => {
            if (typeof value !== "string") {
              return null;
            }
            const result = parseHeadersText(value);
            return result.ok ? null : result.error;
          }}
        >
          <Field.Label className={settingsFieldLabelClass}>Headers</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsTextareaClass}
              placeholder={'可选，例如：\n{\n  "OpenAI-Organization": "org-..."\n}'}
              render={<textarea rows={4} spellCheck={false} />}
              value={form.headersText}
              onValueChange={(next) => {
                update("headersText", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              额外 HTTP 请求头（JSON
              对象，值必须是字符串）。与内置鉴权头浅合并，同名键后写覆盖。留空表示不配置。
            </Field.Description>
            <Field.Error className={settingsFieldErrorClass} />
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="extraBodyText"
          validate={(value) => {
            if (typeof value !== "string") {
              return null;
            }
            const result = parseExtraBodyText(value);
            return result.ok ? null : result.error;
          }}
        >
          <Field.Label className={settingsFieldLabelClass}>Extra Body</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsTextareaClass}
              placeholder={'可选，例如：\n{\n  "top_p": 0.9\n}'}
              render={<textarea rows={4} spellCheck={false} />}
              value={form.extraBodyText}
              onValueChange={(next) => {
                update("extraBodyText", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              额外请求 body 顶层字段（JSON 对象）。与适配器构建的 body
              浅合并，同名键可覆盖内置字段（如 model / max_output_tokens）。留空表示不配置。
            </Field.Description>
            <Field.Error className={settingsFieldErrorClass} />
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
          取消
        </button>
        <button className={settingsPrimaryButtonClass} disabled={busy} type="submit">
          {busy ? "保存中…" : isEdit ? "保存" : "添加"}
        </button>
      </div>
    </Form>
  );
}
