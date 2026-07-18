import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import type { PlainTextEditorHandle } from "#workbench/editor/PlainTextEditor";
import { useManuscript, useResourceLibrary } from "#workbench/session/workspace-handles";

import {
  getWorkbenchEditorContentTabDocumentKey,
  getWorkbenchEditorContentTabNotificationSource,
  writeWorkbenchEditorContentTab,
} from "./editor-document-contributions";
import { pinWorkbenchEditorTab } from "./editor-tab-manager";
import { workbenchEditorMolecule } from "./state/molecules";
import type {
  ContentWorkbenchEditorTab,
  WorkbenchEditorDocument,
  WorkbenchEditorDocuments,
} from "./state/types";
import { useWorkbenchEditorDocumentSync } from "./use-workbench-editor-document-sync";

const AUTOSAVE_DEBOUNCE_MS = 600;

export type WorkbenchEditorDocumentRuntime = {
  getDocument: (tab: ContentWorkbenchEditorTab) => WorkbenchEditorDocument | undefined;
  registerEditor: (tab: ContentWorkbenchEditorTab, handle: PlainTextEditorHandle | null) => void;
  handleContentChange: (tab: ContentWorkbenchEditorTab, transient: boolean) => void;
};

function cancelStaleAutosaves(
  autosaveTimers: Map<string, ReturnType<typeof setTimeout>>,
  documents: WorkbenchEditorDocuments,
): void {
  for (const [key, timer] of autosaveTimers) {
    if (documents[key] === undefined) {
      clearTimeout(timer);
      autosaveTimers.delete(key);
    }
  }
}

export function useWorkbenchEditorDocumentRuntime(): WorkbenchEditorDocumentRuntime {
  const editorHandlesRef = useRef(new Map<string, PlainTextEditorHandle>());
  const autosaveTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const resources = useResourceLibrary();
  const manuscript = useManuscript();
  const resourcesRef = useRef(resources);
  const manuscriptRef = useRef(manuscript);
  const { documentsAtom, editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const documents = useAtomValue(documentsAtom);
  const setEditorState = useSetAtom(editorStateAtom);

  resourcesRef.current = resources;
  manuscriptRef.current = manuscript;

  useWorkbenchEditorDocumentSync(editorHandlesRef, autosaveTimersRef);

  useEffect(() => {
    cancelStaleAutosaves(autosaveTimersRef.current, documents);
    for (const key of editorHandlesRef.current.keys()) {
      if (documents[key] === undefined) {
        editorHandlesRef.current.delete(key);
      }
    }
  }, [documents]);

  useEffect(() => {
    const autosaveTimers = autosaveTimersRef.current;
    return () => {
      for (const timer of autosaveTimers.values()) {
        clearTimeout(timer);
      }
      autosaveTimers.clear();
      editorHandlesRef.current.clear();
    };
  }, []);

  const getDocument = useCallback(
    (tab: ContentWorkbenchEditorTab) => {
      return documents[getWorkbenchEditorContentTabDocumentKey(tab)];
    },
    [documents],
  );

  const registerEditor = useCallback(
    (tab: ContentWorkbenchEditorTab, handle: PlainTextEditorHandle | null) => {
      const key = getWorkbenchEditorContentTabDocumentKey(tab);
      if (handle === null) {
        editorHandlesRef.current.delete(key);
        return;
      }
      editorHandlesRef.current.set(key, handle);
    },
    [],
  );

  const handleContentChange = useCallback(
    (tab: ContentWorkbenchEditorTab, transient: boolean) => {
      if (transient) {
        setEditorState((state) => pinWorkbenchEditorTab(state, tab.id));
      }

      const key = getWorkbenchEditorContentTabDocumentKey(tab);
      const existingTimer = autosaveTimersRef.current.get(key);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
      }

      autosaveTimersRef.current.set(
        key,
        setTimeout(() => {
          autosaveTimersRef.current.delete(key);
          // Debounce 到期再 toString，避免每个 keystroke 全量拷贝。
          const liveContent = editorHandlesRef.current.get(key)?.getValue();
          if (liveContent === undefined) {
            return;
          }
          const write = Promise.resolve(
            writeWorkbenchEditorContentTab(tab, liveContent, {
              manuscript: manuscriptRef.current,
              resources: resourcesRef.current,
            }),
          );

          void write.catch((error) => {
            notificationApi.error(error instanceof Error ? error.message : "自动保存失败", {
              source: getWorkbenchEditorContentTabNotificationSource(tab),
            });
          });
        }, AUTOSAVE_DEBOUNCE_MS),
      );
    },
    [setEditorState],
  );

  return {
    getDocument,
    registerEditor,
    handleContentChange,
  };
}
