import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useMemo, type Ref } from "react";

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
} from "#app/features/settings/settings-chrome";
import type { SettingsFormHandle } from "#app/features/settings/settings-leave-guard";
import { useSettingsForm } from "#app/features/settings/use-settings-form";
import { projectDisplayName } from "#app/shared/lib/project-display-name";
import {
  getHttpsRemoteUrlValidationError,
  normalizeHttpsRemoteUrl,
} from "#shared/rpc/session/index";

import { projectSettingsReadonlyValueClass } from "./project-settings-chrome";

/** Stable form id for header/footer submit association. */
export const PROJECT_SETTINGS_FORM_ID = "project-settings-form";

/** Max length for custom project display name (trim after). */
export const PROJECT_DISPLAY_NAME_MAX_LENGTH = 64;

export type ProjectSettingsFormValues = {
  displayName: string | null;
  remoteUrl: string | null;
};

type FormState = {
  displayName: string;
  remoteUrl: string;
};

type ProjectSettingsFormProps = {
  initial: {
    displayName: string | null;
    remoteUrl: string | null;
    path: string;
    displayPath: string;
  };
  busy?: boolean;
  error?: string | null;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (values: ProjectSettingsFormValues) => boolean | void | Promise<boolean | void>;
};

function toFormState(initial: ProjectSettingsFormProps["initial"]): FormState {
  return {
    displayName: initial.displayName ?? "",
    remoteUrl: initial.remoteUrl ?? "",
  };
}

function asFieldString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validateDisplayName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length > PROJECT_DISPLAY_NAME_MAX_LENGTH) {
    return `项目名不能超过 ${PROJECT_DISPLAY_NAME_MAX_LENGTH} 个字符。`;
  }
  return null;
}

function validateRemoteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  return getHttpsRemoteUrlValidationError(trimmed);
}

function toWritePayload(form: FormState): ProjectSettingsFormValues | null {
  if (validateDisplayName(form.displayName) !== null) {
    return null;
  }
  if (validateRemoteUrl(form.remoteUrl) !== null) {
    return null;
  }

  const displayName = form.displayName.trim() === "" ? null : form.displayName.trim();
  const remoteRaw = form.remoteUrl.trim();
  const remoteUrl = remoteRaw === "" ? null : normalizeHttpsRemoteUrl(remoteRaw);
  return { displayName, remoteUrl };
}

export function ProjectSettingsForm({
  initial,
  busy = false,
  error = null,
  formRef,
  onDirtyChange,
  onSubmit,
}: ProjectSettingsFormProps) {
  const initialState = useMemo(() => toFormState(initial), [initial]);
  const pathDerivedName = useMemo(() => projectDisplayName(initial.path), [initial.path]);

  const {
    values: form,
    setField,
    submit,
    formElementRef,
  } = useSettingsForm<FormState>({
    initial: initialState,
    formRef,
    onDirtyChange,
    busy,
    onSubmit: async (values) => {
      const payload = toWritePayload(values);
      if (payload === null) {
        formElementRef.current?.reportValidity();
        return false;
      }
      return onSubmit(payload);
    },
  });

  return (
    <Form
      id={PROJECT_SETTINGS_FORM_ID}
      className={settingsFormClass}
      ref={formElementRef}
      onFormSubmit={() => {
        void submit();
      }}
    >
      <div className={settingsFormGridClass}>
        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="displayName"
          validate={(value) => validateDisplayName(asFieldString(value))}
        >
          <Field.Label className={settingsFieldLabelClass}>项目名</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              autoFocus
              className={settingsInputClass}
              maxLength={PROJECT_DISPLAY_NAME_MAX_LENGTH}
              placeholder={pathDerivedName}
              spellCheck={false}
              value={form.displayName}
              onValueChange={(next) => {
                setField("displayName", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              留空则使用文件名「{pathDerivedName}」。不改动本地 .npk 路径。
            </Field.Description>
            <Field.Error className={settingsFieldErrorClass} />
          </div>
        </Field.Root>

        <Field.Root
          className={settingsFieldRootClass}
          disabled={busy}
          name="remoteUrl"
          validate={(value) => validateRemoteUrl(asFieldString(value))}
        >
          <Field.Label className={settingsFieldLabelClass}>远端地址</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <Field.Control
              className={settingsInputClass}
              placeholder="https://github.com/org/repo.git"
              spellCheck={false}
              value={form.remoteUrl}
              onValueChange={(next) => {
                setField("remoteUrl", next);
              }}
            />
            <Field.Description className={settingsFieldDescriptionClass}>
              仅支持 HTTPS；留空清除。凭证在 设置 → Git 凭证 中按域名配置。
            </Field.Description>
            <Field.Error className={settingsFieldErrorClass} />
          </div>
        </Field.Root>

        <Field.Root className={settingsFieldRootClass} name="path">
          <Field.Label className={settingsFieldLabelClass}>本地路径</Field.Label>
          <div className={settingsFieldControlCellClass}>
            <p className={projectSettingsReadonlyValueClass} title={initial.path}>
              {initial.displayPath}
            </p>
          </div>
        </Field.Root>
      </div>

      {error !== null && error !== "" ? <p className={settingsFormErrorClass}>{error}</p> : null}
    </Form>
  );
}
