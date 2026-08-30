import { useEffect, useRef, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import { Button } from "#app/shared/ui";
import type { GitCredentialConfigWrite } from "#shared/rpc/services/index";

import {
  settingsDualPaneDetailTitleRowClass,
  settingsGhostActionClass,
  settingsHeaderActionsClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelRootClass,
  settingsStatusBadgeClass,
} from "../settings-chrome";
import { settingsErrorMessage } from "../settings-error";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { SettingsDetailPane } from "../SettingsDetailPane";
import { SettingsFormActions } from "../SettingsFormActions";
import { SettingsMasterDetailShell } from "../SettingsMasterDetailShell";
import {
  SettingsPanelEmpty,
  SettingsPanelLoadError,
  SettingsPanelLoading,
} from "../SettingsPanelStatus";
import { SettingsRail } from "../SettingsRail";
import { SettingsRailItem, settingsRailItemMetaLineClass } from "../SettingsRailItem";
import { useSettingsEditorLeave } from "../use-settings-editor-leave";
import { useSettingsMutation } from "../use-settings-mutation";
import { GIT_CREDENTIAL_CONFIG_FORM_ID, GitCredentialConfigForm } from "./GitCredentialConfigForm";

type CredentialSelection = { type: "create" } | { type: "edit"; id: string };

const gitCredentialsSettingsLoader = createAsyncLoader(() => settingsService.getGitCredentials());

function sameSelection(a: CredentialSelection | null, b: CredentialSelection | null): boolean {
  if (a == null || b == null) {
    return a === b;
  }
  if (a.type === "create" && b.type === "create") {
    return true;
  }
  if (a.type === "edit" && b.type === "edit") {
    return a.id === b.id;
  }
  return false;
}

type GitCredentialsSettingsPanelProps = {
  /** Whether the git-credentials tab is currently active. */
  active?: boolean;
};

export function GitCredentialsSettingsPanel({ active = true }: GitCredentialsSettingsPanelProps) {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(gitCredentialsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [selection, setSelection] = useState<CredentialSelection | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<SettingsFormHandle | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined ? settingsErrorMessage(loadErrorRaw, "加载 Git 凭证设置失败") : null;

  const credentials = snapshot?.credentials ?? [];

  useEffect(() => {
    if (credentials.length === 0) {
      if (selection?.type === "edit") {
        setSelection(null);
      }
      return;
    }
    if (selection == null) {
      setSelection({ type: "edit", id: credentials[0]!.id });
      return;
    }
    if (
      selection.type === "edit" &&
      !credentials.some((credential) => credential.id === selection.id)
    ) {
      setSelection({ type: "edit", id: credentials[0]!.id });
    }
  }, [credentials, selection]);

  const selectedCredential =
    selection?.type === "edit"
      ? (credentials.find((credential) => credential.id === selection.id) ?? null)
      : null;

  const { requestLeave } = useSettingsEditorLeave({
    active,
    editorOpen: selection != null,
    busy,
    dirty: editorDirty,
    formRef,
    closeEditor: () => {
      clearActionError();
      setEditorDirty(false);
      setFormKey((key) => key + 1);
    },
    onDiscard: () => {
      setEditorDirty(false);
      setFormKey((key) => key + 1);
      if (selection?.type === "create") {
        setSelection(credentials[0] ? { type: "edit", id: credentials[0].id } : null);
      }
    },
  });

  const select = async (next: CredentialSelection | null) => {
    if (sameSelection(selection, next)) {
      return;
    }
    const ok = await requestLeave();
    if (!ok) {
      return;
    }
    clearActionError();
    setEditorDirty(false);
    setFormKey((key) => key + 1);
    setSelection(next);
  };

  const handleSubmit = async (input: GitCredentialConfigWrite) => {
    const previousIds = new Set(credentials.map((credential) => credential.id));
    const result = await runMutation(
      () => settingsService.upsertGitCredential(input),
      input.id ? "保存 Git 凭证失败" : "添加 Git 凭证失败",
    );
    if (result == null) {
      return false;
    }
    setEditorDirty(false);
    if (input.id) {
      setSelection({ type: "edit", id: input.id });
    } else {
      const created = result.credentials.find((credential) => !previousIds.has(credential.id));
      if (created) {
        setSelection({ type: "edit", id: created.id });
      }
    }
    setFormKey((key) => key + 1);
    return true;
  };

  const handleRemove = async (id: string) => {
    const credential = credentials.find((item) => item.id === id);
    const confirmed = await confirmDialogApi.confirm({
      title: "删除 Git 凭证",
      description: credential
        ? `确定删除「${credential.host}」的凭证？此操作不可恢复。`
        : "确定删除该凭证？此操作不可恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }
    const result = await runMutation(
      () => settingsService.removeGitCredential(id),
      "删除 Git 凭证失败",
    );
    if (result == null) {
      return;
    }
    if (selection?.type === "edit" && selection.id === id) {
      const remaining = result.credentials;
      clearActionError();
      setEditorDirty(false);
      setFormKey((key) => key + 1);
      setSelection(remaining[0] ? { type: "edit", id: remaining[0].id } : null);
    }
  };

  if (isLoading && snapshot === undefined) {
    return <SettingsPanelLoading />;
  }

  if (loadError && snapshot === undefined) {
    return (
      <SettingsPanelLoadError
        message={loadError}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  const detailTitle =
    selection?.type === "create"
      ? "添加 Git 凭证"
      : selectedCredential
        ? selectedCredential.host
        : "Git 凭证";

  return (
    <div className={settingsPanelRootClass}>
      <SettingsMasterDetailShell>
        <SettingsRail
          label="域名凭证"
          listAriaLabel="Git 域名凭证列表"
          addLabel="添加凭证"
          addDisabled={busy}
          onAdd={() => {
            void select({ type: "create" });
          }}
        >
          {credentials.map((item) => (
            <li key={item.id}>
              <SettingsRailItem
                title={item.host}
                selected={selection?.type === "edit" && selection.id === item.id}
                badge={
                  <span className={settingsStatusBadgeClass}>
                    {item.hasSecret ? "已保存密钥" : "无密钥"}
                  </span>
                }
                meta={
                  <div className={settingsRailItemMetaLineClass} title={item.username}>
                    {item.username}
                  </div>
                }
                onSelect={() => {
                  void select({ type: "edit", id: item.id });
                }}
              />
            </li>
          ))}
        </SettingsRail>

        <SettingsDetailPane
          banner={
            actionError ? (
              <p className="shrink-0 px-3 pt-2 text-xs text-ctp-red">{actionError}</p>
            ) : null
          }
          header={
            selection != null ? (
              <>
                <div className="min-w-0">
                  <div className={settingsDualPaneDetailTitleRowClass}>
                    <h4 className={settingsListItemTitleClass}>{detailTitle}</h4>
                    {selectedCredential ? (
                      <span className="truncate text-2xs text-app-muted">
                        {selectedCredential.hasSecret ? "密钥已加密保存" : "未保存密钥"}
                      </span>
                    ) : null}
                  </div>
                  <div className={settingsListItemMetaClass}>
                    {selectedCredential ? (
                      <span className="truncate">{selectedCredential.username}</span>
                    ) : (
                      <span>按域名保存 HTTPS 用户名与密码/PAT，供后续远程操作使用</span>
                    )}
                  </div>
                </div>
                <div className={settingsHeaderActionsClass}>
                  {selectedCredential ? (
                    <Button
                      aria-label={`删除凭证 ${selectedCredential.host}`}
                      className={settingsGhostActionClass}
                      disabled={busy}
                      variant="ghost"
                      size="icon-md"
                      onClick={() => {
                        void handleRemove(selectedCredential.id);
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                    </Button>
                  ) : null}
                  <SettingsFormActions
                    busy={busy}
                    form={GIT_CREDENTIAL_CONFIG_FORM_ID}
                    submitLabel={selection.type === "create" ? "添加" : "保存"}
                  />
                </div>
              </>
            ) : undefined
          }
        >
          {selection == null ? (
            <SettingsPanelEmpty>还没有 Git 凭证，点击「添加凭证」开始。</SettingsPanelEmpty>
          ) : selection.type === "create" ? (
            <GitCredentialConfigForm
              key={`create-${formKey}`}
              busy={busy}
              error={actionError}
              formRef={formRef}
              onDirtyChange={setEditorDirty}
              onSubmit={handleSubmit}
            />
          ) : selectedCredential ? (
            <GitCredentialConfigForm
              key={`${selectedCredential.id}-${formKey}`}
              busy={busy}
              error={actionError}
              formRef={formRef}
              initial={selectedCredential}
              onDirtyChange={setEditorDirty}
              onSubmit={handleSubmit}
            />
          ) : (
            <SettingsPanelEmpty>请选择一条凭证。</SettingsPanelEmpty>
          )}
        </SettingsDetailPane>
      </SettingsMasterDetailShell>
    </div>
  );
}
