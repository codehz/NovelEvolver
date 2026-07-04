import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { ResourceLibraryHandle, ResourceNode } from "#shared/rpc/projects-rpc";

import {
  assertResourceLibraryFilePath,
  assertResourceLibraryFolderCreatePath,
  assertResourceLibraryListPath,
  assertResourceLibraryMovePaths,
  assertResourceLibraryRemovablePath,
  ensureResourcesDirectory,
  joinWorktreeChild,
  parentWorktreePath,
  RESOURCES_DIR,
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
    assertResourceLibraryListPath(path);
    ensureResourcesDirectory(this.#worktree);
    const dirPath = toWorktreePath(path);
    this.#assertDirectory(dirPath, path);
    return this.#worktree
      .readdir(dirPath)
      .filter((entry) => entry.kind === "blob" || entry.kind === "tree")
      .map(
        (entry): ResourceNode => ({
          name: entry.name,
          type: entry.kind === "tree" ? "folder" : "file",
        }),
      );
  }

  readFile(path: string): string {
    assertResourceLibraryFilePath(path);
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    this.#assertFile(filePath, path);
    return this.#worktree.readFile(filePath).toString("utf-8");
  }

  writeFile(path: string, content: string): void {
    assertResourceLibraryFilePath(path);
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    this.#assertNotDirectory(filePath, path);
    const parent = parentWorktreePath(filePath);
    if (parent !== null) {
      this.#assertParentDirectoryForWrite(parent);
      this.#worktree.mkdir(parent, { recursive: true });
    }
    this.#worktree.writeFile(filePath, Buffer.from(content, "utf-8"));
  }

  createFolder(path: string): void {
    assertResourceLibraryFolderCreatePath(path);
    ensureResourcesDirectory(this.#worktree);
    const folderPath = toWorktreePath(path);
    this.#assertNotFile(folderPath, path);
    this.#worktree.mkdir(folderPath, { recursive: true });
  }

  unlink(path: string): void {
    assertResourceLibraryRemovablePath(path);
    ensureResourcesDirectory(this.#worktree);
    const worktreePath = toWorktreePath(path);
    this.#assertPathExists(worktreePath, path);
    this.#unlinkWorktreePath(worktreePath);
  }

  move(from: string, to: string): void {
    assertResourceLibraryMovePaths(from, to);
    this.#assertMoveDoesNotNestInside(from, to);
    ensureResourcesDirectory(this.#worktree);
    const fromWorktree = toWorktreePath(from);
    const toWorktree = toWorktreePath(to);
    this.#assertPathExists(fromWorktree, from);
    const toParent = parentWorktreePath(toWorktree);
    if (toParent !== null) {
      this.#assertDirectory(toParent, this.#rpcPathFromWorktree(toParent));
    }
    const toStat = this.#worktree.stat(toWorktree);
    if (toStat !== null && toStat.kind === "tree") {
      throw new Error(`Cannot move onto an existing folder: ${to}`);
    }
    this.#worktree.move(fromWorktree, toWorktree);
  }

  #rpcPathFromWorktree(worktreePath: string): string {
    if (worktreePath === RESOURCES_DIR) {
      return "";
    }
    const prefix = `${RESOURCES_DIR}/`;
    if (!worktreePath.startsWith(prefix)) {
      throw new Error(`Path is outside the resource library: ${worktreePath}`);
    }
    return worktreePath.slice(prefix.length);
  }

  #assertPathExists(worktreePath: string, rpcPath: string): void {
    if (!this.#worktree.exists(worktreePath)) {
      throw new Error(`Path does not exist: ${rpcPath}`);
    }
  }

  #assertDirectory(worktreePath: string, rpcPath: string): void {
    const stat = this.#worktree.stat(worktreePath);
    if (stat === null) {
      throw new Error(`Folder does not exist: ${rpcPath}`);
    }
    if (stat.kind !== "tree") {
      throw new Error(`Not a folder: ${rpcPath}`);
    }
  }

  #assertFile(worktreePath: string, rpcPath: string): void {
    const stat = this.#worktree.stat(worktreePath);
    if (stat === null) {
      throw new Error(`File does not exist: ${rpcPath}`);
    }
    if (stat.kind !== "blob") {
      throw new Error(`Not a file: ${rpcPath}`);
    }
  }

  #assertNotDirectory(worktreePath: string, rpcPath: string): void {
    const stat = this.#worktree.stat(worktreePath);
    if (stat !== null && stat.kind === "tree") {
      throw new Error(`Cannot write a file at an existing folder path: ${rpcPath}`);
    }
  }

  #assertNotFile(worktreePath: string, rpcPath: string): void {
    const stat = this.#worktree.stat(worktreePath);
    if (stat !== null && stat.kind === "blob") {
      throw new Error(`Cannot create a folder at an existing file path: ${rpcPath}`);
    }
  }

  #assertParentDirectoryForWrite(parentWorktreePath: string): void {
    if (!this.#worktree.exists(parentWorktreePath)) {
      return;
    }
    const stat = this.#worktree.stat(parentWorktreePath);
    if (stat !== null && stat.kind !== "tree") {
      throw new Error(
        `Cannot create file under a non-folder parent: ${this.#rpcPathFromWorktree(parentWorktreePath)}`,
      );
    }
  }

  #assertMoveDoesNotNestInside(from: string, to: string): void {
    if (to === from || to.startsWith(`${from}/`)) {
      throw new Error("Cannot move a folder into itself or one of its descendants.");
    }
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
