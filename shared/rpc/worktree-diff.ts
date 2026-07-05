import type { RpcTarget } from "capnweb";

import type { ManuscriptNodeType } from "./projects-rpc";

// ==================== 通用类型 ====================

/** 字符级差异统计 */
export type DiffStats = { added: number; removed: number };

// ==================== 正文 Diff 类型 ====================

/** 节点在基线中的完整快照（删除节点还原所需） */
export type BaseNodeSnapshot = {
  title: string;
  parent: string | null;
  /** folder 的子节点列表，chapter 为 null */
  children: string[] | null;
  /** chapter 的旧正文内容，folder 为 null */
  content: string | null;
};

/** 文件夹子节点变更 */
export type FolderChildrenChange = {
  before: string[];
  after: string[];
};

/** 内容变更（携带旧内容用于还原） */
export type ContentChange = {
  stats: DiffStats;
  /** 旧正文内容（还原时直接写回 bodies/{id}.md） */
  oldContent: string;
};

/**
 * 单个正文节点的变更描述。
 *
 * 采用多维度可叠加模型：每个变更维度是独立的可选字段，
 * 一个节点可以同时被重命名、移动、修改内容。
 *
 * - `base === null` → 节点是新增的（仅 current 中存在）
 * - `title === null` → 节点是被删除的（仅 base 中存在）
 * - 两者都非 null → 节点在两边都存在，可能有多种变更维度
 */
export type NodeDiff = {
  id: string;
  type: ManuscriptNodeType;

  // ---- 存在性维度 ----
  /** null = 节点被删除（仅 base 中存在） */
  title: string | null;
  /** null = 节点是新增的；非 null = 节点在 base 中存在 */
  base: BaseNodeSnapshot | null;

  // ---- 标题维度 ----
  titleChanged?: { from: string; to: string };

  // ---- 父节点维度 ----
  /** 当前父节点（null = 根节点） */
  parent: string | null;
  parentChanged?: { from: string | null; to: string | null };

  // ---- 内容维度（仅 chapter）----
  contentChanged?: ContentChange;

  // ---- 子节点维度（仅 folder）----
  childrenChanged?: FolderChildrenChange;
};

/** 正文差异 */
export type ManuscriptDiff = {
  nodes: NodeDiff[];
};

// ==================== 资源 Diff 类型 ====================

export type ResourceDiffEntry =
  | { kind: "added"; path: string; resourceKind: "file"; stats: DiffStats }
  | { kind: "added"; path: string; resourceKind: "folder" }
  | { kind: "removed"; path: string; resourceKind: "file"; stats: DiffStats; oldContent: string }
  | { kind: "removed"; path: string; resourceKind: "folder" }
  | { kind: "modified"; path: string; stats: DiffStats; oldContent: string };

// ==================== 总结果 ====================

export type WorktreeDiffResult = {
  manuscript: ManuscriptDiff;
  resources: ResourceDiffEntry[];
};

// ==================== 还原目标 ====================

export type ManuscriptRevertTarget =
  | { id: string; dimension: "all" }
  | { id: string; dimension: "title" }
  | { id: string; dimension: "parent" }
  | { id: string; dimension: "content" }
  | { id: string; dimension: "children" };

export type ResourceRevertTarget = { path: string; dimension: "all" };

// ==================== RPC 接口 ====================

export interface WorktreeDiffHandle extends RpcTarget {
  /** 计算当前工作树与 base tree 的差异 */
  compute(): WorktreeDiffResult;

  /** 还原正文节点的变更 */
  revertManuscript(target: ManuscriptRevertTarget): void;

  /** 还原资源的变更 */
  revertResource(target: ResourceRevertTarget): void;
}
