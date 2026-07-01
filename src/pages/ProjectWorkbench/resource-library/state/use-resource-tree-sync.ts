import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";
import { collectExpandedPathsNeedingLoad, folderExistsInTree } from "./tree-cache";

export function useResourceTreeSync(): void {
  const resources = useResourceLibrary();
  const { treeDataAtom, treeUiAtom } = useMolecule(resourceLibraryTreeMolecule);
  const data = useAtomValue(treeDataAtom);
  const ui = useAtomValue(treeUiAtom);
  const dispatchData = useSetAtom(treeDataAtom);
  const dispatchUi = useSetAtom(treeUiAtom);
  const loadingPathsRef = useRef(new Set<string>());

  const loadDirectory = useCallback(
    async (path: string, mode: "root" | "child", rootRefresh: boolean = false) => {
      if (loadingPathsRef.current.has(path)) {
        return;
      }
      loadingPathsRef.current.add(path);
      if (mode === "root") {
        if (!rootRefresh) {
          dispatchData({ type: "initStart" });
        }
      } else {
        dispatchData({ type: "setNodeLoading", path, loading: true });
      }
      try {
        const entries = await resources.ls(path);
        if (mode === "root") {
          dispatchData(
            rootRefresh ? { type: "reloadRootSuccess", entries } : { type: "initSuccess", entries },
          );
        } else {
          dispatchData({ type: "setNodeChildren", path, entries });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (mode === "root") {
          dispatchData({ type: "initError", message });
        } else {
          dispatchData({ type: "setNodeLoading", path, loading: false });
        }
      } finally {
        loadingPathsRef.current.delete(path);
      }
    },
    [dispatchData, resources],
  );

  useEffect(() => {
    if (data.status === "idle") {
      void loadDirectory("", "root");
    }
  }, [data.status, loadDirectory]);

  const reloadHead = data.reloadPaths[0];
  useEffect(() => {
    if (reloadHead === undefined) {
      return;
    }
    void (async () => {
      if (reloadHead === "") {
        await loadDirectory("", "root", true);
      } else {
        dispatchData({ type: "setNodeExpanded", path: reloadHead, expanded: true });
        await loadDirectory(reloadHead, "child");
      }
      dispatchData({ type: "shiftReloadQueue" });
    })();
  }, [reloadHead, dispatchData, loadDirectory]);

  useEffect(() => {
    if (!ui.expandRequest || data.status !== "ready") {
      return;
    }
    const path = ui.expandRequest;
    dispatchUi({ type: "clearExpandRequest" });
    if (path === "") {
      return;
    }
    if (!folderExistsInTree(data, path)) {
      return;
    }
    if (!(path in data.expandedPaths)) {
      dispatchData({ type: "setNodeExpanded", path, expanded: true });
    }
    const listing = data.listings[path];
    if (listing === undefined || listing.status === "idle") {
      void loadDirectory(path, "child");
    }
  }, [ui.expandRequest, data, dispatchData, dispatchUi, loadDirectory]);

  useEffect(() => {
    if (!ui.creating || data.status !== "ready") {
      return;
    }
    const parentPath = ui.creating.parentPath;
    if (parentPath === "") {
      return;
    }
    dispatchUi({ type: "requestExpand", path: parentPath });
  }, [ui.creating, data.status, dispatchUi]);

  useEffect(() => {
    if (data.status !== "ready") {
      return;
    }
    for (const path of collectExpandedPathsNeedingLoad(data)) {
      void loadDirectory(path, "child");
    }
  }, [data, loadDirectory]);
}
