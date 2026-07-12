import { useId, useState, type SubmitEvent } from "react";

import type {
  AiAdapterKind,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
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
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
};

type AiProviderConfigFormProps = {
  initial?: AiProviderConfigPublic | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: AiProviderConfigWrite) => void | Promise<void>;
};

function toFormState(initial?: AiProviderConfigPublic | null): FormState {
  return {
    name: initial?.name ?? "",
    kind: initial?.kind ?? "responses",
    baseUrl: initial?.baseUrl ?? "",
    apiKey: "",
    clearApiKey: false,
  };
}

export function AiProviderConfigForm({
  initial = null,
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AiProviderConfigFormProps) {
  const formId = useId();
  const isEdit = initial != null;
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const nameId = `${formId}-name`;
  const kindId = `${formId}-kind`;
  const baseUrlId = `${formId}-base-url`;
  const apiKeyId = `${formId}-api-key`;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: AiProviderConfigWrite = {
      ...(isEdit ? { id: initial.id } : {}),
      name: form.name,
      kind: form.kind,
      baseUrl: form.baseUrl,
    };

    if (isEdit) {
      if (form.clearApiKey) {
        payload.apiKey = "";
      } else if (form.apiKey !== "") {
        payload.apiKey = form.apiKey;
      }
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
          供应商名称
        </label>
        <input
          autoFocus
          className={settingsInputClass}
          disabled={busy}
          id={nameId}
          placeholder="例如：OpenAI 官方"
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
