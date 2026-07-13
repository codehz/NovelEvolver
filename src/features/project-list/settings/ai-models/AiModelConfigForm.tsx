import { useId, useState, type SubmitEvent } from "react";

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
  settingsFieldLabelClass,
  settingsFormActionsClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "../settings-chrome";
import { SettingsSelect } from "../SettingsSelect";
type FormState = {
  providerId: string;
  name: string;
  model: string;
  maxOutputTokens: string;
  /** Empty string means not configured. */
  contextLength: string;
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

function toFormState(
  initial: AiModelConfigPublic | null | undefined,
  defaultProviderId: string,
): FormState {
  return {
    providerId: initial?.providerId ?? defaultProviderId,
    name: initial?.name ?? "",
    model: initial?.model ?? "",
    maxOutputTokens: String(initial?.maxOutputTokens ?? DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS),
    contextLength:
      initial?.contextLength !== null && initial?.contextLength !== undefined
        ? String(initial.contextLength)
        : "",
  };
}

function parseMaxOutputTokensField(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

/** Empty → null (not configured). Non-empty invalid → throws via form error. */
function parseContextLengthField(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return { ok: false };
  }
  return { ok: true, value };
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
  const formId = useId();
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() =>
    toFormState(initial, defaultProviderId || providers[0]?.id || ""),
  );
  const [maxOutputTokensError, setMaxOutputTokensError] = useState<string | null>(null);
  const [contextLengthError, setContextLengthError] = useState<string | null>(null);

  const parsedMaxOutputTokens = parseMaxOutputTokensField(form.maxOutputTokens);
  const showLowMaxOutputTokensWarning =
    parsedMaxOutputTokens !== null && isLowMaxOutputTokensForNovelAgent(parsedMaxOutputTokens);

  const providerIdField = `${formId}-provider`;
  const nameId = `${formId}-name`;
  const modelId = `${formId}-model`;
  const maxOutputTokensId = `${formId}-max-output-tokens`;
  const contextLengthId = `${formId}-context-length`;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const maxOutputTokens = parseMaxOutputTokensField(form.maxOutputTokens);
    if (maxOutputTokens === null) {
      setMaxOutputTokensError("请输入大于 0 的整数作为最大输出 token。");
      return;
    }
    setMaxOutputTokensError(null);

    const contextLengthParsed = parseContextLengthField(form.contextLength);
    if (!contextLengthParsed.ok) {
      setContextLengthError("上下文长度请留空，或输入大于 0 的整数。");
      return;
    }
    setContextLengthError(null);

    const payload: AiModelConfigWrite = {
      ...(isEdit ? { id: initial.id } : {}),
      providerId: form.providerId,
      name: form.name,
      model: form.model,
      maxOutputTokens,
      contextLength: contextLengthParsed.value,
    };

    void onSubmit(payload);
  };

  if (providers.length === 0) {
    return <p className="text-xs text-app-muted">请先添加至少一个 API 供应商，再配置模型。</p>;
  }

  return (
    <form className={settingsFormClass} onSubmit={handleSubmit}>
      <div className={settingsFormGridClass}>
        <label className={settingsFieldLabelClass} htmlFor={providerIdField}>
          供应商
        </label>
        <SettingsSelect
          disabled={busy}
          id={providerIdField}
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

        <label className={settingsFieldLabelClass} htmlFor={nameId}>
          显示名称
        </label>
        <input
          autoFocus
          className={settingsInputClass}
          disabled={busy}
          id={nameId}
          placeholder="例如：写作助手 GPT-4o"
          required
          type="text"
          value={form.name}
          onChange={(event) => {
            update("name", event.target.value);
          }}
        />

        <label className={settingsFieldLabelClass} htmlFor={modelId}>
          模型 ID
        </label>
        <input
          className={settingsInputClass}
          disabled={busy}
          id={modelId}
          placeholder="例如：gpt-4o"
          required
          type="text"
          value={form.model}
          onChange={(event) => {
            update("model", event.target.value);
          }}
        />

        <label className={settingsFieldLabelClass} htmlFor={maxOutputTokensId}>
          最大输出 token
        </label>
        <div className="flex min-w-0 flex-col gap-1.5">
          <input
            className={settingsInputClass}
            disabled={busy}
            id={maxOutputTokensId}
            inputMode="numeric"
            min={1}
            placeholder={String(DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS)}
            required
            type="number"
            value={form.maxOutputTokens}
            onChange={(event) => {
              update("maxOutputTokens", event.target.value);
              if (maxOutputTokensError !== null) {
                setMaxOutputTokensError(null);
              }
            }}
          />
          <p className="text-2xs text-app-muted">
            单次模型回复允许生成的最大 token 数。默认 {DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS}。
          </p>
          {showLowMaxOutputTokensWarning ? (
            <p className={maxOutputTokensWarningClass} role="status">
              当前上限 {parsedMaxOutputTokens} token，对小说写作 Agent
              偏少，长段正文或大纲容易被截断。建议提高到 8192 或更高（需符合模型与服务商上限）。
            </p>
          ) : null}
          {maxOutputTokensError ? (
            <p className="text-2xs text-ctp-red">{maxOutputTokensError}</p>
          ) : null}
        </div>

        <label className={settingsFieldLabelClass} htmlFor={contextLengthId}>
          上下文长度
        </label>
        <div className="flex min-w-0 flex-col gap-1.5">
          <input
            className={settingsInputClass}
            disabled={busy}
            id={contextLengthId}
            inputMode="numeric"
            min={1}
            placeholder="可选，例如 128000"
            type="number"
            value={form.contextLength}
            onChange={(event) => {
              update("contextLength", event.target.value);
              if (contextLengthError !== null) {
                setContextLengthError(null);
              }
            }}
          />
          <p className="text-2xs text-app-muted">
            模型上下文窗口（token）。用于侧边栏显示当前占用占比；留空表示不统计。不会传给 API。
          </p>
          {contextLengthError ? (
            <p className="text-2xs text-ctp-red">{contextLengthError}</p>
          ) : null}
        </div>
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
    </form>
  );
}
