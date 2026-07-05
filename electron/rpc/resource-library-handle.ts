import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type {
  ResourceLibraryHandle,
  ResourceNode,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/projects-rpc";

import {
  assertResourceLibraryFilePath,
  assertResourceLibraryFolderCreatePath,
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
  readonly #onDidChange: () => void;

  constructor(worktree: VirtualWorktree, onDidChange: () => void = () => undefined) {
    super();
    this.#worktree = worktree;
    this.#onDidChange = onDidChange;
    ensureResourcesDirectory(worktree);
  }

  getTree(): ResourceTreeSnapshot {
    ensureResourcesDirectory(this.#worktree);
    return this.#readTree();
  }

  createFile(path: string): ResourceTreeSnapshot {
    assertResourceLibraryFilePath(path);
    ensureResourcesDirectory(this.#worktree);
    const filePath = toWorktreePath(path);
    this.#assertNotDirectory(filePath, path);
    const parent = parentWorktreePath(filePath);
    if (parent !== null) {
      this.#assertParentDirectoryForWrite(parent);
      this.#worktree.mkdir(parent, { recursive: true });
    }
    this.#worktree.writeFile(filePath, Buffer.from("", "utf-8"));
    this.#onDidChange();
    return this.#readTree();
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
    this.#onDidChange();
  }

  createFolder(path: string): ResourceTreeSnapshot {
    assertResourceLibraryFolderCreatePath(path);
    ensureResourcesDirectory(this.#worktree);
    const folderPath = toWorktreePath(path);
    this.#assertNotFile(folderPath, path);
    this.#worktree.mkdir(folderPath, { recursive: true });
    this.#onDidChange();
    return this.#readTree();
  }

  unlink(path: string): ResourceTreeSnapshot {
    assertResourceLibraryRemovablePath(path);
    ensureResourcesDirectory(this.#worktree);
    const worktreePath = toWorktreePath(path);
    this.#assertPathExists(worktreePath, path);
    this.#unlinkWorktreePath(worktreePath);
    this.#onDidChange();
    return this.#readTree();
  }

  move(from: string, to: string): ResourceTreeSnapshot {
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
    this.#onDidChange();
    return this.#readTree();
  }

  #readTree(): ResourceTreeSnapshot {
    const nodes: Record<string, ResourceTreeNode> = {
      "": {
        path: "",
        name: "",
        type: "folder",
        children: [],
      },
    };

    const visitDirectory = (rpcPath: string): void => {
      const worktreePath = toWorktreePath(rpcPath);
      this.#assertDirectory(worktreePath, rpcPath);
      const entries = sortEntries(
        this.#worktree
          .readdir(worktreePath)
          .filter((entry) => entry.kind === "blob" || entry.kind === "tree")
          .map(
            (entry): ResourceNode => ({
              name: entry.name,
              type: entry.kind === "tree" ? "folder" : "file",
            }),
          ),
      );

      const childPaths: string[] = [];
      for (const entry of entries) {
        const childRpcPath = rpcPath === "" ? entry.name : `${rpcPath}/${entry.name}`;
        childPaths.push(childRpcPath);
        if (entry.type === "folder") {
          nodes[childRpcPath] = {
            path: childRpcPath,
            name: entry.name,
            type: "folder",
            children: [],
          };
          visitDirectory(childRpcPath);
        } else {
          nodes[childRpcPath] = {
            path: childRpcPath,
            name: entry.name,
            type: "file",
          };
        }
      }

      const node = nodes[rpcPath];
      if (node?.type !== "folder") {
        throw new Error(`Expected folder node at path: ${rpcPath}`);
      }
      node.children = childPaths;
    };

    visitDirectory("");

    return {
      version: 1,
      rootPath: "",
      nodes,
    };
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

function sortEntries(entries: ResourceNode[]): ResourceNode[] {
  return [...entries].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "folder" ? -1 : 1;
  });
}
