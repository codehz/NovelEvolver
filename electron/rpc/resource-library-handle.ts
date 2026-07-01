import type { ResourceLibraryHandle, ResourceNode } from "@shared/rpc/projects-rpc";
import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import {
  ensureResourcesDirectory,
  joinWorktreeChild,
  parentWorktreePath,
  toWorktreePath,
} from "../resource-library-path";

function debugLog(method: string, detail: Record<string, unknown>): void {
  console.debug("[ResourceLibraryHandle]", method, detail);
}

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
    debugLog("ls", { path });
    ensureResourcesDirectory(this.#worktree);
    const dirPath = toWorktreePath(path);
    const nodes: ResourceNode[] = this.#worktree
      .readdir(dirPath)
      .filter((entry) => entry.kind === "blob" || entry.kind === "tree")
      .map(
        (entry): ResourceNode => ({
          name: entry.name,
          type: entry.kind === "tree" ? "folder" : "file",
        }),
      );
    debugLog("ls:done", { path, count: nodes.length });
    return nodes;
  }

  readFile(path: string): string {
    debugLog("readFile", { path });
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    const content = this.#worktree.readFile(filePath).toString("utf-8");
    debugLog("readFile:done", { path, bytes: Buffer.byteLength(content, "utf-8") });
    return content;
  }

  writeFile(path: string, content: string): void {
    debugLog("writeFile", { path, bytes: Buffer.byteLength(content, "utf-8") });
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    const parent = parentWorktreePath(filePath);
    if (parent !== null) {
      this.#worktree.mkdir(parent, { recursive: true });
    }
    this.#worktree.writeFile(filePath, Buffer.from(content, "utf-8"));
    debugLog("writeFile:done", { path });
  }

  createFolder(path: string): void {
    debugLog("createFolder", { path });
    ensureResourcesDirectory(this.#worktree);
    this.#worktree.mkdir(toWorktreePath(path), { recursive: true });
    debugLog("createFolder:done", { path });
  }

  unlink(path: string): void {
    debugLog("unlink", { path });
    ensureResourcesDirectory(this.#worktree);
    if (path === "") {
      throw new Error("Cannot remove the resource library root.");
    }
    this.#unlinkWorktreePath(toWorktreePath(path));
    debugLog("unlink:done", { path });
  }

  move(from: string, to: string): void {
    debugLog("move", { from, to });
    ensureResourcesDirectory(this.#worktree);
    if (from === "" || to === "") {
      throw new Error("Cannot move the resource library root.");
    }
    this.#worktree.move(toWorktreePath(from), toWorktreePath(to));
    debugLog("move:done", { from, to });
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
