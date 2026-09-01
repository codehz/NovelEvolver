import type { ManuscriptHandle } from "@novelevolver/desktop-rpc/worktree/manuscript-handle";
import type {
  ExternalImportEntry,
  ManuscriptImportResult,
  WorktreeNodeIdResult,
} from "@novelevolver/domain/worktree/manuscript";
import type { WorktreeSession } from "@novelevolver/worktree";
import { RpcTarget } from "capnweb";

export class ManuscriptHandleImpl extends RpcTarget implements ManuscriptHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  createFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    return this.#session.createManuscriptFolder(parentId, title, index);
  }

  createChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    return this.#session.createManuscriptChapter(parentId, title, index);
  }

  importEntries(
    targetParentId: string,
    entries: readonly ExternalImportEntry[],
    index?: number,
  ): ManuscriptImportResult {
    return this.#session.importManuscriptEntries(targetParentId, entries, index);
  }

  renameNode(id: string, title: string): void {
    this.#session.renameManuscriptNode(id, title);
  }

  moveNode(id: string, targetParentId: string, index?: number): void {
    this.#session.moveManuscriptNode(id, targetParentId, index);
  }

  deleteNode(id: string): void {
    this.#session.deleteManuscriptNode(id);
  }

  readChapter(id: string): string {
    return this.#session.readChapter(id);
  }

  writeChapter(id: string, content: string): void {
    this.#session.writeChapter(id, content);
  }
}
