import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import type {
  GitCredentialConfigPublic,
  GitCredentialConfigWrite,
} from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";

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

/** Stable form id for header submit association. */
export const GIT_CREDENTIAL_CONFIG_FORM_ID = "settings-git-credential-form";

type FormState = {
  host: string;
  username: string;
  secret: string;
  clearSecret: boolean;
};

type GitCredentialConfigFormProps = {
  initial?: GitCredentialConfigPublic | null;
  busy?: boolean;
  error?: string | null;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: GitCredentialConfigWrite) => boolean | void | Promise<boolean | void>;
};

function toFormState(initial?: GitCredentialConfigPublic | null): FormState {
  return {
    host: initial?.host ?? "",
    username: initial?.username ?? "",
    secret: "",
    clearSecret: false,
  };
}

function isCredentialFormDirty(form: FormState, baseline: FormState): boolean {
  return (
    form.host !== baseline.host ||
    form.username !== baseline.username ||
    form.secret !== baseline.secret ||
    form.clearSecret !== baseline.clearSecret
  );
}

export function GitCredentialConfigForm({
  initial = null,
  busy = false,
  error = null,
  formRef = null,
  onDirtyChange,
  onSubmit,
}: GitCredentialConfigFormProps) {
  const isEdit = initial != null;
  const baselineRef = useRef(toFormState(initial));
  const [form, setForm] = useState<FormState>(() => toFormState(initial));

  const dirty = useMemo(() => isCredentialFormDirty(form, baselineRef.current), [form]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const buildPayload = (): GitCredentialConfigWrite | null => {
    const host = form.host.trim();
    const username = form.username.trim();
    // Host may be a bare hostname or a full remote URL; server normalizes via
    // normalizeGitCredentialHost. Create requires a non-empty secret.
    if (host === "" || username === "") {
      return null;
    }

    const payload: GitCredentialConfigWrite = {
      ...(isEdit ? { id: initial.id } : {}),
      host: form.host,
      username: form.username,
    };

    if (isEdit) {
      if (form.clearSecret) {
        payload.secret = "";
      } else if (form.secret !== "") {
        payload.secret = form.secret;
      }
    } else if (form.secret !== "") {
      payload.secret = form.secret;
    } else {
      return null;
    }

    return payload;
  };

  const submitPayload = async (payload: GitCredentialConfigWrite): Promise<boolean> => {
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

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const secretPlaceholder =
    isEdit && initial.hasSecret && !form.clearSecret
      ? "已保存，留空则不修改"
      : "密码或个人访问令牌（PAT）";

  return (
    <Form
      id={GIT_CREDENTIAL_CONFIG_FORM_ID}
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
        <Field.Root className={settingsFieldRootClass} disabled={busy} name="host">
          <Field.Label className={settingsFieldLabelClass}>域名</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus
              className={settingsInputClass}
              placeholder="github.com 或完整远程 URL"
              required
              spellCheck={false}
              value={form.host}
              onValueChange={(next) => {
                update("host", next);
              }}
            />
            <Field.Error className={settingsFieldErrorClass} match="valueMissing">
              请填写域名。
            </Field.Error>
            <p className="mt-1 text-2xs text-app-muted">
              按主机名存储；粘贴完整 URL 或 git@host:path 会自动提取域名。
            </p>
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} disabled={busy} name="username">
          <Field.Label className={settingsFieldLabelClass}>用户名</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoComplete="username"
              className={settingsInputClass}
              placeholder="HTTPS 用户名"
              required
              spellCheck={false}
              value={form.username}
              onValueChange={(next) => {
                update("username", next);
              }}
            />
            <Field.Error className={settingsFieldErrorClass} match="valueMissing">
              请填写用户名。
            </Field.Error>
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy || form.clearSecret}
          name="secret"
        >
          <Field.Label className={settingsFieldLabelClass}>密钥</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoComplete="off"
              className={settingsInputClass}
              placeholder={secretPlaceholder}
              required={!isEdit}
              spellCheck={false}
              type="password"
              value={form.secret}
              onValueChange={(next) => {
                update("secret", next);
                if (next !== "") {
                  update("clearSecret", false);
                }
              }}
            />
            {isEdit ? null : (
              <Field.Error className={settingsFieldErrorClass} match="valueMissing">
                请填写密码或个人访问令牌。
              </Field.Error>
            )}
            {isEdit && initial.hasSecret ? (
              <label className={cn(settingsCheckboxLabelClass, "items-center text-app-muted")}>
                <SettingsCheckbox
                  checked={form.clearSecret}
                  disabled={busy}
                  onCheckedChange={(checked) => {
                    update("clearSecret", checked);
                    if (checked) {
                      update("secret", "");
                    }
                  }}
                />
                清除已保存的密钥
              </label>
            ) : null}
          </div>
        </Field.Root>
      </div>

      {error ? <p className={settingsFormErrorClass}>{error}</p> : null}
    </Form>
  );
}
