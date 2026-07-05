import type { RpcTarget } from "capnweb";

// ==================== 通用类型 ====================

/** 字符级差异统计 */
export type DiffStats = { added: number; removed: number };

// ==================== 扁平 Diff Item 模型 ====================

export type DiffItemKind = "add" | "remove" | "modify" | "move" | "reorder";

/**
 * 单个原子 diff 操作。
 *
 * 后端返回扁平列表，前端按顺序渲染即可。
 * 每个 item 自带渲染所需的元数据和 revert 所需的信息。
 */
export type DiffItem = {
  /** 唯一标识，用于 revert */
  revertId: string;
  /** 操作类型 */
  kind: DiffItemKind;
  /** 显示路径（如 "正文/第一章" 或 "images/cover.png"） */
  path: string;
  /** 树深度（用于缩进渲染，0 = 根级） */
  depth: number;
  /** 显示标签（节点标题或文件名） */
  label: string;
  /** 变更统计 */
  stats?: DiffStats;
  /** 是否为目录 */
  isDir: boolean;

  // ---- reorder 专用 ----
  reorderInfo?: {
    /** 被移动的子节点 ID */
    childId: string;
    /** 文件夹 ID */
    folderId: string;
    /** 原始子节点序列（base 中的顺序，仅保留仍存在的子节点） */
    before: string[];
  };
};

// ==================== 总结果 ====================

export type WorktreeDiffResult = {
  manuscript: DiffItem[];
  resources: DiffItem[];
};

// ==================== RPC 接口 ====================

export interface WorktreeDiffHandle extends RpcTarget {
  /** 计算当前工作树与 base tree 的差异 */
  compute(): WorktreeDiffResult;

  /**
   * 按 revertId 还原单个操作，返回还原后的最新 diff。
   * - node:... → 还原正文节点变更
   * - resource:... → 还原资源变更
   * - reorder:... → 还原排序变更
   * - folder:... → 还原整个文件夹的全部变更
   */
  revert(revertId: string): WorktreeDiffResult;
}
