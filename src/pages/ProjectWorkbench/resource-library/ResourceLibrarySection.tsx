import { useCallback, useState } from "react";

import { cn } from "@/lib/cn";
import { notificationApi } from "@/lib/notifications";
import { isQuickPickDismissedError, quickPickApi } from "@/lib/quick-pick";

import { useWorkbenchEditorActions } from "../demo/editor/use-workbench-editor-actions";
import { ResourceLibraryTree } from "./ResourceLibraryTree";
import { useResourceLibraryHandle } from "./use-resource-library-handle";

const toolbarClass = cn("flex shrink-0 gap-1 border-b border-workbench-tab-border p-1");

const toolbarButtonClass = cn(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ctp-subtext0",
  "hover:bg-workbench-tab-active/60",
);

export function ResourceLibrarySectionBody() {
  const library = useResourceLibraryHandle();
  const { openResourceTab } = useWorkbenchEditorActions();
  const [treeRevision, setTreeRevision] = useState(0);

  const bumpTree = useCallback(() => {
    setTreeRevision((value) => value + 1);
  }, []);

  const listDirectory = useCallback(
    async (path: string) => {
      if (library.status !== "ready") {
        return [];
      }
      return library.resources.ls(path);
    },
    [library],
  );

  const onOpenFile = useCallback(
    (path: string) => {
      if (library.status !== "ready") {
        return;
      }
      void openResourceTab(path, (p) => library.resources.readFile(p));
    },
    [library, openResourceTab],
  );

  const createAtRoot = useCallback(
    async (kind: "file" | "folder") => {
      if (library.status !== "ready") {
        return;
      }
      try {
        const name = await quickPickApi.showInput({
          title: kind === "file" ? "新建文件" : "新建文件夹",
          inputLabel: "相对路径",
          placeholder: kind === "file" ? "例如 设定/世界观.md" : "例如 设定",
          dismissAriaLabel: "关闭",
          validate: (value) => (value.trim() === "" ? "名称不能为空" : null),
        });
        const path = name.trim();
        if (kind === "folder") {
          await library.resources.createFolder(path);
        } else {
          await library.resources.writeFile(path, "");
        }
        bumpTree();
        if (kind === "file") {
          void openResourceTab(path, (p) => library.resources.readFile(p));
        }
      } catch (error) {
        if (isQuickPickDismissedError(error)) {
          return;
        }
        notificationApi.error(error instanceof Error ? error.message : "创建失败", {
          source: "资源库",
        });
      }
    },
    [bumpTree, library, openResourceTab],
  );

  if (library.status === "idle" || library.status === "loading") {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">连接资源库…</p>;
  }

  if (library.status === "unavailable" || library.status === "error") {
    return (
      <p className="px-2 py-1 text-xs text-ctp-subtext0" role="status">
        {library.message}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={toolbarClass}>
        <button
          className={toolbarButtonClass}
          type="button"
          onClick={() => void createAtRoot("file")}
        >
          <span aria-hidden="true" className="icon-[codicon--new-file] text-sm" />
          新建文件
        </button>
        <button
          className={toolbarButtonClass}
          type="button"
          onClick={() => void createAtRoot("folder")}
        >
          <span aria-hidden="true" className="icon-[codicon--new-folder] text-sm" />
          新建文件夹
        </button>
      </div>
      <ResourceLibraryTree
        key={treeRevision}
        listDirectory={listDirectory}
        onOpenFile={onOpenFile}
      />
    </div>
  );
}
