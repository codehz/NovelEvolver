import type { ResourceLibraryHandle } from "@shared/rpc/projects-rpc";
import type { RpcStub } from "capnweb";
import { useEffect, useState } from "react";

import { useProjectContext } from "../demo/branch/branch-data";
import { useResourceLibraryAvailability } from "./effective-branch";

export type ResourceLibraryHandleState =
  | { status: "idle" | "loading" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; resources: RpcStub<ResourceLibraryHandle> };

export function useResourceLibraryHandle(): ResourceLibraryHandleState {
  const project = useProjectContext();
  const availability = useResourceLibraryAvailability();
  const [state, setState] = useState<ResourceLibraryHandleState>({ status: "idle" });

  useEffect(() => {
    if (availability.status !== "ready") {
      setState({
        status: "unavailable",
        message: availability.message,
      });
      return;
    }

    let canceled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const worktree = await project.handle.openWorktree(availability.branchName);
        const resources = worktree.resources;
        if (!canceled) {
          setState({ status: "ready", resources });
        }
      } catch (error) {
        if (!canceled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    availability.status,
    availability.status === "ready" ? availability.branchName : null,
    project.handle,
  ]);

  return state;
}
