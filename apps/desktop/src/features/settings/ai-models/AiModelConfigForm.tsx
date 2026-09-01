import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { NumberField } from "@base-ui/react/number-field";
import type {
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiPromptCacheConfig,
  AiPromptCacheMode,
  AiProviderConfigPublic,
  AiReasoningLevel,
} from "@novelevolver/domain/settings/ai-settings";
import {
  AI_PROMPT_CACHE_MODE_LABELS,
  AI_PROMPT_CACHE_MODES,
  AI_REASONING_LEVELS,
  DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS,
  isLowMaxOutputTokensForNovelAgent,
  isToollessAdapterKind,
} from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  settingsCheckboxLabelClass,
  settingsFieldControlCellClass,
  settingsFieldDescriptionClass,
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
import { SettingsJsonEditor } from "../SettingsJsonEditor";
import { SettingsSelect } from "../SettingsSelect";
import { ReasoningLevelChipList } from "./ReasoningLevelChipList";

/** Stable form id for header submit association. */
export const AI_MODEL_CONFIG_FORM_ID = "settings-ai-model-form";

type FormState = {
  providerId: string;
  name: string;
  model: string;
  maxOutputTokens: number | null;
  /** null means not configured. */
  contextLength: number | null;
  /** Subset of AI_REASONING_LEVELS exposed for this model. */
  availableReasoningLevels: AiReasoningLevel[];
  /** null only when available is empty; otherwise a member of available. */
  defaultReasoningLevel: AiReasoningLevel | null;
  /** null means not configured. */
  temperature: number | null;
  /** Empty string means follow the provider default. */
  cacheMode: "" | AiPromptCacheMode;
  cacheKey: string;
  cacheTtl: string;
  /** Raw JSON text for headers; empty string means not configured. */
  headersText: string;
  /** Raw JSON text for extraBody; empty string means not configured. */
  extraBodyText: string;
  supportsTools: boolean;
};

type AiModelConfigFormProps = {
  providers: readonly AiProviderConfigPublic[];
  initial?: AiModelConfigPublic | null;
  defaultProviderId?: string;
  busy?: boolean;
  error?: string | null;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: AiModelConfigWrite) => boolean | void | Promise<boolean | void>;
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
  providers: readonly AiProviderConfigPublic[],
): FormState {
  const providerId = initial?.providerId ?? defaultProviderId;
  const provider = providers.find((entry) => entry.id === providerId);
  const toolless = provider != null && isToollessAdapterKind(provider.kind);
  const availableReasoningLevels = orderReasoningLevels(initial?.availableReasoningLevels ?? []);
  const defaultLevel = initial?.defaultReasoningLevel;
  return {
    providerId,
    name: initial?.name ?? "",
    model: initial?.model ?? "",
    maxOutputTokens: initial?.maxOutputTokens ?? DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS,
    contextLength: initial?.contextLength ?? null,
    availableReasoningLevels,
    defaultReasoningLevel: resolveDefaultReasoningLevel(availableReasoningLevels, defaultLevel),
    temperature: initial?.temperature ?? null,
    cacheMode: initial?.cache?.mode ?? "",
    cacheKey: initial?.cache?.key ?? "",
    cacheTtl: initial?.cache?.ttl ?? "",
    headersText: recordToEditorText(initial?.headers),
    extraBodyText: recordToEditorText(initial?.extraBody),
    supportsTools: toolless ? false : (initial?.supportsTools ?? true),
  };
}

/** Keep AI_REASONING_LEVELS order when toggling multi-select. */
function orderReasoningLevels(levels: readonly string[]): AiReasoningLevel[] {
  const selected = new Set(levels);
  return AI_REASONING_LEVELS.filter((level) => selected.has(level));
}

/** Non-empty available always has a default (first available when missing/invalid). */
function resolveDefaultReasoningLevel(
  available: readonly AiReasoningLevel[],
  candidate: AiReasoningLevel | null | undefined,
): AiReasoningLevel | null {
  if (available.length === 0) {
    return null;
  }
  if (candidate != null && available.includes(candidate)) {
    return candidate;
  }
  return available[0]!;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isValidTemperature(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2;
}

function cacheFromForm(form: FormState): AiPromptCacheConfig {
  const cache: AiPromptCacheConfig = {};
  if (form.cacheMode !== "") {
    cache.mode = form.cacheMode;
  }
  const key = form.cacheKey.trim();
  if (key !== "") {
    cache.key = key;
  }
  const ttl = form.cacheTtl.trim();
  if (ttl !== "") {
    cache.ttl = ttl;
  }
  return cache;
}

type CacheModeSelectValue = "" | AiPromptCacheMode;

const CACHE_MODE_OPTIONS: readonly { value: CacheModeSelectValue; label: string }[] = [
  { value: "", label: "跟随提供商" },
  ...AI_PROMPT_CACHE_MODES.map((mode) => ({
    value: mode,
    label: AI_PROMPT_CACHE_MODE_LABELS[mode],
  })),
];

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
  "rounded-md bg-ctp-yellow/10 px-2 py-1.5 text-2xs text-ctp-yellow",
);

function sameReasoningLevels(
  a: readonly AiReasoningLevel[],
  b: readonly AiReasoningLevel[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function isModelFormDirty(form: FormState, baseline: FormState): boolean {
  return (
    form.providerId !== baseline.providerId ||
    form.name !== baseline.name ||
    form.model !== baseline.model ||
    form.maxOutputTokens !== baseline.maxOutputTokens ||
    form.contextLength !== baseline.contextLength ||
    form.defaultReasoningLevel !== baseline.defaultReasoningLevel ||
    form.temperature !== baseline.temperature ||
    form.cacheMode !== baseline.cacheMode ||
    form.cacheKey !== baseline.cacheKey ||
    form.cacheTtl !== baseline.cacheTtl ||
    form.headersText !== baseline.headersText ||
    form.extraBodyText !== baseline.extraBodyText ||
    form.supportsTools !== baseline.supportsTools ||
    !sameReasoningLevels(form.availableReasoningLevels, baseline.availableReasoningLevels)
  );
}

export function AiModelConfigForm({
  providers,
  initial = null,
  defaultProviderId = "",
  busy = false,
  error = null,
  formRef = null,
  onDirtyChange,
  onSubmit,
}: AiModelConfigFormProps) {
  const isEdit = initial != null;
  const initialProviderId = defaultProviderId || providers[0]?.id || "";
  const baselineRef = useRef(toFormState(initial, initialProviderId, providers));
  const [form, setForm] = useState<FormState>(() =>
    toFormState(initial, initialProviderId, providers),
  );

  const dirty = useMemo(() => isModelFormDirty(form, baselineRef.current), [form]);
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.providerId),
    [providers, form.providerId],
  );
  const toollessProvider = selectedProvider != null && isToollessAdapterKind(selectedProvider.kind);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const showLowMaxOutputTokensWarning =
    form.maxOutputTokens !== null && isLowMaxOutputTokensForNovelAgent(form.maxOutputTokens);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = (): AiModelConfigWrite | null => {
    if (!isPositiveInteger(form.maxOutputTokens)) {
      return null;
    }
    if (form.contextLength !== null && !isPositiveInteger(form.contextLength)) {
      return null;
    }
    if (form.temperature !== null && !isValidTemperature(form.temperature)) {
      return null;
    }
    if (form.name.trim() === "" || form.model.trim() === "" || form.providerId === "") {
      return null;
    }

    const headersResult = parseHeadersText(form.headersText);
    if (!headersResult.ok) {
      return null;
    }
    const extraBodyResult = parseExtraBodyText(form.extraBodyText);
    if (!extraBodyResult.ok) {
      return null;
    }

    const availableReasoningLevels = orderReasoningLevels(form.availableReasoningLevels);
    const defaultReasoningLevel = resolveDefaultReasoningLevel(
      availableReasoningLevels,
      form.defaultReasoningLevel,
    );

    return {
      ...(isEdit ? { id: initial.id } : {}),
      providerId: form.providerId,
      name: form.name,
      model: form.model,
      maxOutputTokens: form.maxOutputTokens,
      contextLength: form.contextLength,
      availableReasoningLevels,
      defaultReasoningLevel,
      temperature: form.temperature,
      cache: cacheFromForm(form),
      headers: headersResult.value,
      extraBody: extraBodyResult.value,
      supportsTools: toollessProvider ? false : form.supportsTools,
    };
  };

  const submitPayload = async (payload: AiModelConfigWrite): Promise<boolean> => {
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
    [form, isEdit, initial, onSubmit],
  );

  if (providers.length === 0) {
    return <p className="text-xs text-app-muted">请先添加至少一个 API 供应商，再配置模型。</p>;
  }

  return (
    <Form
      id={AI_MODEL_CONFIG_FORM_ID}
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
                const provider = providers.find((entry) => entry.id === next);
                const toolless = provider != null && isToollessAdapterKind(provider.kind);
                setForm((prev) => ({
                  ...prev,
                  providerId: next,
                  ...(toolless ? { supportsTools: false } : {}),
                }));
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
          disabled={busy || toollessProvider}
          name="supportsTools"
        >
          <Field.Label className={settingsFieldLabelClass}>工具调用</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <label className={cn(settingsCheckboxLabelClass, "items-center")}>
              <SettingsCheckbox
                checked={toollessProvider ? false : form.supportsTools}
                disabled={busy || toollessProvider}
                onCheckedChange={(checked) => {
                  update("supportsTools", checked);
                }}
              />
              <span className="min-w-0">
                <span className="block text-app-foreground">支持工具调用</span>
                <span className="mt-0.5 block text-2xs text-app-muted">
                  {toollessProvider
                    ? "delta-completions 供应商仅支持纯文本补全，不可启用工具调用；仍可作为子代理默认模型。"
                    : "关闭后不会出现在主对话模型列表；仍可作为纯文本子代理的默认模型。"}
                </span>
              </span>
            </label>
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="temperature"
          validate={(value) => {
            if (value == null || value === "") {
              return null;
            }
            return isValidTemperature(value)
              ? null
              : "temperature 请留空，或输入 0 到 2 之间的数字。";
          }}
        >
          <Field.Label className={settingsFieldLabelClass}>Temperature</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <NumberField.Root
              allowOutOfRange
              max={2}
              min={0}
              step={0.1}
              value={form.temperature}
              onValueChange={(next) => {
                update("temperature", next);
              }}
            >
              <NumberField.Input className={settingsInputClass} placeholder="可选，例如 0.7" />
            </NumberField.Root>
            <Field.Description className={settingsFieldDescriptionClass}>
              采样温度（0–2）。留空表示不发送，由提供商默认决定。
            </Field.Description>
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
          name="availableReasoningLevels"
        >
          <Field.Label className={settingsFieldLabelClass}>Reasoning Effort</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <ReasoningLevelChipList
              available={form.availableReasoningLevels}
              defaultLevel={form.defaultReasoningLevel}
              disabled={busy}
              onChange={({ available, defaultLevel }) => {
                setForm((prev) => ({
                  ...prev,
                  availableReasoningLevels: available,
                  defaultReasoningLevel: defaultLevel,
                }));
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              点选公开档位；悬停已选项可切换默认。至少选一时必有默认；全部取消表示不暴露该选项。
            </Field.Description>
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="cacheMode">
          <Field.Label className={settingsFieldLabelClass}>Prompt Cache</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <SettingsSelect
              value={form.cacheMode}
              options={CACHE_MODE_OPTIONS}
              onValueChange={(next) => {
                update("cacheMode", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              可移植缓存策略。跟随提供商表示不发送 cache 字段。
            </Field.Description>
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="cacheKey">
          <Field.Label className={settingsFieldLabelClass}>Cache Key</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsInputClass}
              placeholder="可选，会话或租户路由提示"
              spellCheck={false}
              value={form.cacheKey}
              onValueChange={(next) => {
                update("cacheKey", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              提示缓存路由键。提供商可能忽略。留空表示不发送。
            </Field.Description>
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="cacheTtl">
          <Field.Label className={settingsFieldLabelClass}>Cache TTL</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsInputClass}
              placeholder="short / long / 5m / 1h"
              spellCheck={false}
              value={form.cacheTtl}
              onValueChange={(next) => {
                update("cacheTtl", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              可移植保留时长（short / long）或提供商原生 TTL。留空表示不发送。
            </Field.Description>
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
              className={settingsFieldHiddenControlClass}
              tabIndex={-1}
              value={form.headersText}
              onValueChange={(next) => {
                update("headersText", next);
              }}
            />
            <SettingsJsonEditor
              aria-label="Headers JSON"
              disabled={busy}
              placeholder={'{\n  "OpenAI-Organization": "org-..."\n}'}
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
              className={settingsFieldHiddenControlClass}
              tabIndex={-1}
              value={form.extraBodyText}
              onValueChange={(next) => {
                update("extraBodyText", next);
              }}
            />
            <SettingsJsonEditor
              aria-label="Extra Body JSON"
              disabled={busy}
              placeholder={'{\n  "top_p": 0.9\n}'}
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
    </Form>
  );
}
