import { ProjectSession } from "@novelevolver/desktop-rpc/session";
import { createScope, molecule, use } from "bunshi";
import { useMolecule } from "bunshi/react";
import { RpcPromise } from "capnweb";

import { workspaceService } from "#app/shared/lib/rpc/app-rpc";
import { wrapDisposable } from "#app/shared/lib/rpc/rpc-utils";

export const projectIdScope = createScope<number>(-1);

export const projectMolecule = molecule(() => {
  const id = use(projectIdScope);

  return wrapDisposable(workspaceService.openProject(id));
});

export function useProjectContext(): RpcPromise<ProjectSession> {
  return useMolecule(projectMolecule);
}
