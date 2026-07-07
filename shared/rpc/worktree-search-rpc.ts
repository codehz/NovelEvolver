import type { RpcTarget } from "capnweb";

/** 与 SCM `ScmChangeDomain` 对齐：手稿正文树 vs 资源库树。 */
export type WorktreeSearchDomain = "manuscript" | "resource";

/** `all` 表示两个域都搜；结果仍分栏返回，便于 UI 区分。 */
export type WorktreeSearchScope = WorktreeSearchDomain | "all";

export type WorktreeSearchQuery = {
  /** 关键词；首尾空白会被忽略，空串时返回空结果。 */
  query: string;
  scope?: WorktreeSearchScope;
  /** 每个域最多返回多少条命中，默认 100。 */
  maxResultsPerDomain?: number;
};

type WorktreeSearchHitBase = {
  domain: WorktreeSearchDomain;
  /** 树节点 id，用于打开编辑器 / 定位侧栏项。 */
  nodeId: string;
  label: string;
  /** 手稿为章节路径标题；资源为 `resources/` 下相对路径。 */
  displayPath: string;
  /** 命中所在行的上下文片段（单行，不含高亮标记）。 */
  snippet: string;
  /** 命中行号，1-based。 */
  line: number;
  /** 该行内首个命中列，0-based UTF-16 偏移。 */
  column: number;
  /** 该行内首个命中的 UTF-16 长度。 */
  matchLength: number;
};

export type ManuscriptSearchHit = WorktreeSearchHitBase & {
  domain: "manuscript";
  entityKind: "chapter";
};

export type ResourceSearchHit = WorktreeSearchHitBase & {
  domain: "resource";
  entityKind: "file";
};

export type WorktreeSearchHit = ManuscriptSearchHit | ResourceSearchHit;

export type WorktreeSearchResult = {
  query: string;
  scope: WorktreeSearchScope;
  /** 手稿正文命中。 */
  manuscript: ManuscriptSearchHit[];
  /** 资源库文件内容命中。 */
  resources: ResourceSearchHit[];
};

/**
 * 当前分支 worktree 内的全文搜索（只读，不订阅）。
 *
 * 搜索范围由 `scope` 控制；`manuscript` 与 `resources` 在结果中始终分字段返回。
 */
export interface WorktreeSearchHandle extends RpcTarget {
  search(options: WorktreeSearchQuery): WorktreeSearchResult;
}
