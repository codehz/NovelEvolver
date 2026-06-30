import type { ResourceLibraryHandle, ResourceNode } from "@shared/rpc/projects-rpc";
import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import {
  ensureResourcesDirectory,
  joinWorktreeChild,
  parentWorktreePath,
  toWorktreePath,
} from "../resource-library-path";

/**
 * RPC view of the branch worktree's `resources/` directory.
 */
export class ResourceLibraryHandleImpl extends RpcTarget implements ResourceLibraryHandle {
  readonly #worktree: VirtualWorktree;

  constructor(worktree: VirtualWorktree) {
    super();
    this.#worktree = worktree;
    ensureResourcesDirectory(worktree);
  }

  ls(path: string): ResourceNode[] {
    ensureResourcesDirectory(this.#worktree);
    const dirPath = toWorktreePath(path);
    return this.#worktree
      .readdir(dirPath)
      .filter((entry) => entry.kind === "blob" || entry.kind === "tree")
      .map((entry) => ({
        name: entry.name,
        type: entry.kind === "tree" ? "folder" : "file",
      }));
  }

  readFile(path: string): string {
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    return this.#worktree.readFile(filePath).toString("utf-8");
  }

  writeFile(path: string, content: string): void {
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    const parent = parentWorktreePath(filePath);
    if (parent !== null) {
      this.#worktree.mkdir(parent, { recursive: true });
    }
    this.#worktree.writeFile(filePath, Buffer.from(content, "utf-8"));
  }

  createFolder(path: string): void {
    ensureResourcesDirectory(this.#worktree);
    this.#worktree.mkdir(toWorktreePath(path), { recursive: true });
  }

  unlink(path: string): void {
    ensureResourcesDirectory(this.#worktree);
    if (path === "") {
      throw new Error("Cannot remove the resource library root.");
    }
    this.#unlinkWorktreePath(toWorktreePath(path));
  }

  move(from: string, to: string): void {
    ensureResourcesDirectory(this.#worktree);
    if (from === "" || to === "") {
      throw new Error("Cannot move the resource library root.");
    }
    this.#worktree.move(toWorktreePath(from), toWorktreePath(to));
  }

  #unlinkWorktreePath(worktreePath: string): void {
    const stat = this.#worktree.stat(worktreePath);
    if (stat !== null && stat.kind === "tree") {
      for (const entry of this.#worktree.readdir(worktreePath)) {
        this.#unlinkWorktreePath(joinWorktreeChild(worktreePath, entry.name));
      }
    }
    this.#worktree.delete(worktreePath);
  }
}
