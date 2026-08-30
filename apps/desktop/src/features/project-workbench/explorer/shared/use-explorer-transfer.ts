import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useCallback } from "react";

import type { WorktreeTransferInput, WorktreeTransferResult } from "#domain/worktree";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { useBranchWorkspace } from "#workbench/session/workspace-handles";

import { manuscriptTreeMolecule } from "../manuscript/state/manuscript-tree-molecule";
import { resourceLibraryTreeMolecule } from "../resource-library/state/resource-tree-molecule";
import { runExplorerTransfer } from "./explorer-transfer";

export function useExplorerTransfer() {
  const workspace = useBranchWorkspace();
  const { openTarget } = useWorkbenchEditorActions();
  const { treeAtom: manuscriptTreeAtom } = useMolecule(manuscriptTreeMolecule);
  const { treeAtom: resourceTreeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatchManuscript = useSetAtom(manuscriptTreeAtom);
  const dispatchResource = useSetAtom(resourceTreeAtom);

  return useCallback(
    async (input: WorktreeTransferInput): Promise<WorktreeTransferResult | null> => {
      return runExplorerTransfer({
        transfer: (payload) => Promise.resolve(workspace.transferNode(payload)),
        input,
        openTarget,
        onSuccess: (result) => {
          if (input.targetDomain === "manuscript") {
            dispatchManuscript({ type: "expand", id: input.targetParentId });
            const first = result.created[0];
            if (first !== undefined) {
              dispatchManuscript({ type: "select", id: first.nodeId });
              if (first.kind === "folder") {
                dispatchManuscript({ type: "expand", id: first.nodeId });
              }
            }
            return;
          }

          dispatchResource({ type: "expandPath", id: input.targetParentId });
          const first = result.created[0];
          if (first !== undefined) {
            dispatchResource({
              type: "select",
              id: first.nodeId,
              nodeType: first.kind === "folder" ? "folder" : "file",
            });
            if (first.kind === "folder") {
              dispatchResource({ type: "expandPath", id: first.nodeId });
            }
          }
        },
      });
    },
    [dispatchManuscript, dispatchResource, openTarget, workspace],
  );
}
