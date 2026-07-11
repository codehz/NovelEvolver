import { useId, useState, type SubmitEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type {
  AiAdapterKind,
  AiModelConfigPublic,
  AiModelConfigWrite,
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
  settingsSelectClass,
} from "../settings-chrome";
import { AI_ADAPTER_OPTIONS, aiAdapterEndpointPlaceholder } from "./ai-adapter-labels";

type FormState = {
  name: string;
  kind: AiAdapterKind;
  model: string;
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  maxOutputTokens: string;
};

type AiModelConfigFormProps = {
  initial?: AiModelConfigPublic | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: AiModelConfigWrite) => void | Promise<void>;
};

function toFormState(initial?: AiModelConfigPublic | null): FormState {
  return {
    name: initial?.name ?? "",
    kind: initial?.kind ?? "responses",
    model: initial?.model ?? "",
    baseUrl: initial?.baseUrl ?? "",
    apiKey: "",
    clearApiKey: false,
    maxOutputTokens: String(initial?.maxOutputTokens ?? DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS),
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

const maxOutputTokensWarningClass = cn(
  "rounded-md border border-ctp-yellow/40 bg-ctp-yellow/10 px-2 py-1.5 text-2xs text-ctp-yellow",
);

export function AiModelConfigForm({
  initial = null,
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AiModelConfigFormProps) {
  const formId = useId();
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [maxOutputTokensError, setMaxOutputTokensError] = useState<string | null>(null);

  const parsedMaxOutputTokens = parseMaxOutputTokensField(form.maxOutputTokens);
  const showLowMaxOutputTokensWarning =
    parsedMaxOutputTokens !== null && isLowMaxOutputTokensForNovelAgent(parsedMaxOutputTokens);

  const nameId = `${formId}-name`;
  const kindId = `${formId}-kind`;
  const modelId = `${formId}-model`;
  const baseUrlId = `${formId}-base-url`;
  const apiKeyId = `${formId}-api-key`;
  const maxOutputTokensId = `${formId}-max-output-tokens`;

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

    const payload: AiModelConfigWrite = {
      ...(isEdit ? { id: initial.id } : {}),
      name: form.name,
      kind: form.kind,
      model: form.model,
      baseUrl: form.baseUrl,
      maxOutputTokens,
    };

    if (isEdit) {
      if (form.clearApiKey) {
        payload.apiKey = "";
      } else if (form.apiKey !== "") {
        payload.apiKey = form.apiKey;
      }
      // else leave apiKey undefined → keep existing
    } else if (form.apiKey !== "") {
      payload.apiKey = form.apiKey;
    }

    void onSubmit(payload);
  };

  const apiKeyPlaceholder =
    isEdit && initial.hasApiKey && !form.clearApiKey
      ? "已保存，留空则不修改"
      : form.kind === "ollama"
        ? "可选"
        : "API Key";

  return (
    <form className={settingsFormClass} onSubmit={handleSubmit}>
      <div className={settingsFormGridClass}>
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

        <label className={settingsFieldLabelClass} htmlFor={kindId}>
          API 形式
        </label>
        <select
          className={settingsSelectClass}
          disabled={busy}
          id={kindId}
          value={form.kind}
          onChange={(event) => {
            update("kind", event.target.value as AiAdapterKind);
          }}
        >
          {AI_ADAPTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

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

        <label className={settingsFieldLabelClass} htmlFor={baseUrlId}>
          Endpoint
        </label>
        <input
          className={settingsInputClass}
          disabled={busy}
          id={baseUrlId}
          placeholder={aiAdapterEndpointPlaceholder(form.kind)}
          spellCheck={false}
          type="url"
          value={form.baseUrl}
          onChange={(event) => {
            update("baseUrl", event.target.value);
          }}
        />

        <label className={settingsFieldLabelClass} htmlFor={apiKeyId}>
          API Key
        </label>
        <div className="flex min-w-0 flex-col gap-1.5">
          <input
            autoComplete="off"
            className={settingsInputClass}
            disabled={busy || form.clearApiKey}
            id={apiKeyId}
            placeholder={apiKeyPlaceholder}
            spellCheck={false}
            type="password"
            value={form.apiKey}
            onChange={(event) => {
              update("apiKey", event.target.value);
              if (event.target.value !== "") {
                update("clearApiKey", false);
              }
            }}
          />
          {isEdit && initial.hasApiKey ? (
            <label className="flex items-center gap-1.5 text-2xs text-app-muted">
              <input
                checked={form.clearApiKey}
                disabled={busy}
                type="checkbox"
                onChange={(event) => {
                  update("clearApiKey", event.target.checked);
                  if (event.target.checked) {
                    update("apiKey", "");
                  }
                }}
              />
              清除已保存的 API Key
            </label>
          ) : null}
        </div>

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
