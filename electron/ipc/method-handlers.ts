import type { AppIpcMethodMap, UncategorizedAppIpcMethodChannels } from "@shared/ipc/app-maps";
import type { IpcMainMethodHandlers } from "@shared/ipc/types";
import type { IpcMainDeps } from "./deps";
import { createProjectsIpcMethodHandlers } from "./projects-handlers";
import { createWindowIpcMethodHandlers } from "./window-handlers";

type AssertAllAppIpcChannelsPartitioned = [UncategorizedAppIpcMethodChannels] extends [never]
  ? true
  : never;

const ipcChannelPartitionCheck: AssertAllAppIpcChannelsPartitioned = true;
void ipcChannelPartitionCheck;

export function createAppIpcMethodHandlers(
  deps: IpcMainDeps,
): IpcMainMethodHandlers<AppIpcMethodMap> {
  return {
    ...createWindowIpcMethodHandlers(),
    ...createProjectsIpcMethodHandlers(deps),
  } satisfies IpcMainMethodHandlers<AppIpcMethodMap>;
}
