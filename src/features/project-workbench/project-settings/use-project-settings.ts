import { useEffect, useRef, useState } from "react";

import type { SettingsFormHandle } from "#app/features/settings/settings-leave-guard";
import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import type { ProjectMetadata } from "#shared/project";
import { useProjectContext } from "#workbench/session/project-scope";

import type { ProjectSettingsFormValues } from "./ProjectSettingsForm";

export type ProjectSettingsSnapshot = {
  displayName: string | null;
  remoteUrl: string | null;
  path: string;
  displayPath: string;
};

type UseProjectSettingsOptions = {
  open: boolean;
  /** Seed metadata while remoteUrl is loaded. */
  metadata: ProjectMetadata;
  onSaved: (result: { displayName: string | null }) => void;
};

function settingsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}

export function useProjectSettings({ open, metadata, onSaved }: UseProjectSettingsOptions) {
  const project = useProjectContext();
  const [snapshot, setSnapshot] = useState<ProjectSettingsSnapshot | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<SettingsFormHandle | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setActionError(null);
    setDirty(false);

    void (async () => {
      try {
        const remoteUrl = (await Promise.resolve(project.remoteUrl)) as string | null;
        const liveMetadata = (await Promise.resolve(project.metadata)) as ProjectMetadata;
        if (cancelled) {
          return;
        }
        setSnapshot({
          displayName: liveMetadata.displayName,
          remoteUrl,
          path: liveMetadata.path,
          displayPath: liveMetadata.displayPath,
        });
        setFormKey((key) => key + 1);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSnapshot({
          displayName: metadata.displayName,
          remoteUrl: null,
          path: metadata.path,
          displayPath: metadata.displayPath,
        });
        setActionError(settingsErrorMessage(error, "加载项目配置失败"));
        setFormKey((key) => key + 1);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, project, metadata]);

  const handleSubmit = async (values: ProjectSettingsFormValues): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }
    setBusy(true);
    setActionError(null);
    try {
      await Promise.resolve(project.setDisplayName(values.displayName));
      await Promise.resolve(project.setRemoteUrl(values.remoteUrl));
      setSnapshot((prev) =>
        prev === null
          ? prev
          : {
              ...prev,
              displayName: values.displayName,
              remoteUrl: values.remoteUrl,
            },
      );
      setDirty(false);
      onSaved({ displayName: values.displayName });
      return true;
    } catch (error) {
      setActionError(settingsErrorMessage(error, "保存项目配置失败"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** true = may close; false = stay open. */
  const requestClose = async (): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }
    if (!dirtyRef.current) {
      return true;
    }
    const choice = await confirmDialogApi.confirmUnsavedChanges();
    if (choice === "cancel") {
      return false;
    }
    if (choice === "discard") {
      setDirty(false);
      setActionError(null);
      setFormKey((key) => key + 1);
      return true;
    }
    const saved = (await formRef.current?.save()) ?? false;
    return saved;
  };

  return {
    actionError,
    busy,
    dirty,
    formKey,
    formRef,
    loading,
    onDirtyChange: setDirty,
    requestClose,
    snapshot,
    handleSubmit,
  };
}
