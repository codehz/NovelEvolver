import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type {
  AiAdapterKind,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
} from "#shared/rpc/services/index";

import {
  settingsCheckboxLabelClass,
  settingsFieldControlCellClass,
  settingsFieldErrorClass,
  settingsFieldLabelClass,
  settingsFieldRootClass,
  settingsFormClass,
  settingsFormErrorClass,
  settingsFormGridClass,
  settingsInputClass,
} from "../settings-chrome";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { SettingsCheckbox } from "../SettingsCheckbox";
import { SettingsFormActions } from "../SettingsFormActions";
import { SettingsSelect } from "../SettingsSelect";
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
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: AiProviderConfigWrite) => boolean | void | Promise<boolean | void>;
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

function isProviderFormDirty(form: FormState, baseline: FormState): boolean {
  return (
    form.name !== baseline.name ||
    form.kind !== baseline.kind ||
    form.baseUrl !== baseline.baseUrl ||
    form.apiKey !== baseline.apiKey ||
    form.clearApiKey !== baseline.clearApiKey
  );
}

export function AiProviderConfigForm({
  initial = null,
  busy = false,
  error = null,
  formRef = null,
  onDirtyChange,
  onSubmit,
}: AiProviderConfigFormProps) {
  const isEdit = initial != null;
  const baselineRef = useRef(toFormState(initial));
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const dirty = useMemo(() => isProviderFormDirty(form, baselineRef.current), [form]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const buildPayload = (): AiProviderConfigWrite | null => {
    const name = form.name.trim();
    if (name === "") {
      return null;
    }
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

    return payload;
  };

  const submitPayload = async (payload: AiProviderConfigWrite): Promise<boolean> => {
    const result = await onSubmit(payload);
    return result !== false;
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

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const apiKeyPlaceholder =
    isEdit && initial.hasApiKey && !form.clearApiKey
      ? "已保存，留空则不修改"
      : form.kind === "ollama"
        ? "可选"
        : "API Key";

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
        <Field.Root className={settingsFieldRootClass} disabled={busy} name="name">
          <Field.Label className={settingsFieldLabelClass}>供应商名称</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus
              className={settingsInputClass}
              placeholder="例如：OpenAI 官方"
              required
              value={form.name}
              onValueChange={(next) => {
                update("name", next);
              }}
            />
            <Field.Error className={settingsFieldErrorClass} match="valueMissing">
              请填写供应商名称。
            </Field.Error>
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="kind">
          <Field.Label className={settingsFieldLabelClass}>API 形式</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <SettingsSelect
              value={form.kind}
              options={AI_ADAPTER_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onValueChange={(next) => {
                update("kind", next as AiAdapterKind);
              }}
            />
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="baseUrl">
          <Field.Label className={settingsFieldLabelClass}>Endpoint</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsInputClass}
              placeholder={aiAdapterEndpointPlaceholder(form.kind)}
              spellCheck={false}
              type="url"
              value={form.baseUrl}
              onValueChange={(next) => {
                update("baseUrl", next);
              }}
            />
            <Field.Error className={settingsFieldErrorClass} match="typeMismatch">
              请输入有效的 URL。
            </Field.Error>
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || form.clearApiKey}
          name="apiKey"
        >
          <Field.Label className={settingsFieldLabelClass}>API Key</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoComplete="off"
              className={settingsInputClass}
              placeholder={apiKeyPlaceholder}
              spellCheck={false}
              type="password"
              value={form.apiKey}
              onValueChange={(next) => {
                update("apiKey", next);
                if (next !== "") {
                  update("clearApiKey", false);
                }
              }}
            />
            {isEdit && initial.hasApiKey ? (
              <label className={cn(settingsCheckboxLabelClass, "items-center text-app-muted")}>
                <SettingsCheckbox
                  checked={form.clearApiKey}
                  disabled={busy}
                  onCheckedChange={(checked) => {
                    update("clearApiKey", checked);
                    if (checked) {
                      update("apiKey", "");
                    }
                  }}
                />
                清除已保存的 API Key
              </label>
            ) : null}
          </div>
        </Field.Root>
      </div>

      {error ? <p className={settingsFormErrorClass}>{error}</p> : null}

      <SettingsFormActions busy={busy} submitLabel={isEdit ? "保存" : "添加"} />
    </Form>
  );
}
