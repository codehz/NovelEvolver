import { Dialog } from "@base-ui/react/dialog";

import { Button } from "#app/shared/ui";
import type { ProjectMetadata } from "#shared/project";

import {
  projectSettingsBackdropClass,
  projectSettingsBodyClass,
  projectSettingsFooterClass,
  projectSettingsHeaderClass,
  projectSettingsIconButtonClass,
  projectSettingsPanelClass,
  projectSettingsTitleClass,
} from "./project-settings-chrome";
import { PROJECT_SETTINGS_FORM_ID, ProjectSettingsForm } from "./ProjectSettingsForm";
import { useProjectSettings } from "./use-project-settings";

type ProjectSettingsDialogProps = {
  open: boolean;
  metadata: ProjectMetadata;
  onDismiss: () => void;
  onSaved: (result: { displayName: string | null }) => void;
};

export function ProjectSettingsDialog({
  open,
  metadata,
  onDismiss,
  onSaved,
}: ProjectSettingsDialogProps) {
  const {
    actionError,
    busy,
    formKey,
    formRef,
    loading,
    onDirtyChange,
    requestClose,
    snapshot,
    handleSubmit,
  } = useProjectSettings({
    open,
    metadata,
    onSaved: (result) => {
      onSaved(result);
      onDismiss();
    },
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void requestClose().then((ok) => {
            if (ok) {
              onDismiss();
            }
          });
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={projectSettingsBackdropClass} />
        <Dialog.Popup className={projectSettingsPanelClass}>
          <header className={projectSettingsHeaderClass}>
            <Dialog.Title className={projectSettingsTitleClass}>
              <span aria-hidden="true" className="icon-[codicon--repo] text-sm" />
              项目设置
            </Dialog.Title>
            <Dialog.Close aria-label="关闭" className={projectSettingsIconButtonClass}>
              <span aria-hidden="true" className="icon-[codicon--close] text-sm" />
            </Dialog.Close>
          </header>

          <div className={projectSettingsBodyClass}>
            {loading || snapshot === null ? (
              <p className="text-xs text-app-muted">加载中…</p>
            ) : (
              <ProjectSettingsForm
                key={formKey}
                busy={busy}
                error={actionError}
                formRef={formRef}
                initial={snapshot}
                onDirtyChange={onDirtyChange}
                onSubmit={handleSubmit}
              />
            )}
          </div>

          <footer className={projectSettingsFooterClass}>
            <Button
              disabled={busy || loading || snapshot === null}
              type="button"
              variant="ghost"
              onClick={() => {
                void requestClose().then((ok) => {
                  if (ok) {
                    onDismiss();
                  }
                });
              }}
            >
              取消
            </Button>
            <Button
              disabled={busy || loading || snapshot === null}
              form={PROJECT_SETTINGS_FORM_ID}
              type="submit"
              variant="primary"
            >
              {busy ? "保存中…" : "保存"}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
