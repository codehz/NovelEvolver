import { RpcTarget } from "capnweb";

import type {
  ResourceImportEntry,
  ResourceImportResult,
  ResourceLibraryHandle,
  WorktreeNodeIdResult,
} from "#shared/rpc/worktree/index";

import type { WorktreeSession } from "../../worktree/session";

export class ResourceLibraryHandleImpl extends RpcTarget implements ResourceLibraryHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  createFile(parentId: string, name: string): WorktreeNodeIdResult {
    return this.#session.createResourceFile(parentId, name);
  }

  createFolder(parentId: string, name: string): WorktreeNodeIdResult {
    return this.#session.createResourceFolder(parentId, name);
  }

  importEntries(
    targetParentId: string,
    entries: readonly ResourceImportEntry[],
  ): ResourceImportResult {
    return this.#session.importResourceEntries(targetParentId, entries);
  }

  readFile(id: string): string {
    return this.#session.readResourceFile(id);
  }

  writeFile(id: string, content: string): void {
    this.#session.writeResourceFile(id, content);
  }

  renameNode(id: string, name: string): void {
    this.#session.renameResourceNode(id, name);
  }

  deleteNode(id: string): void {
    this.#session.deleteResourceNode(id);
  }

  moveNode(id: string, targetParentId: string): void {
    this.#session.moveResourceNode(id, targetParentId);
  }
}
