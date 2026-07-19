import type { RpcTarget } from "capnweb";

import type { WorktreeDomain } from "./worktree-domain";

/** 与变更域对齐：手稿正文树 vs 资源库树。 @deprecated Prefer {@link WorktreeDomain}. */
export type WorktreeSearchDomain = WorktreeDomain;

/** `all` 表示两个域都搜；结果仍分栏返回，便于 UI 区分。 */
export type WorktreeSearchScope = WorktreeSearchDomain | "all";

export type WorktreeSearchQuery = {
  /** 关键词；首尾空白会被忽略，空串时返回空结果。 */
  query: string;
  scope?: WorktreeSearchScope;
  /**
   * 是否将 `query` 作为正则表达式（ECMAScript）。
   * 默认 `false`（字面匹配，大小写不敏感）。
   * 正则模式下同样大小写不敏感；非法模式由实现抛错。
   */
  isRegex?: boolean;
  /** 每个域最多返回多少条命中，默认 100。 */
  maxResultsPerDomain?: number;
};

export type WorktreeReplaceTarget = {
  domain: "manuscript" | "resource";
  nodeId: string;
};

export type WorktreeReplaceQuery = {
  query: string;
  replacement: string;
  isRegex?: boolean;
  scope?: WorktreeSearchScope;
  targets?: WorktreeReplaceTarget[];
  /** absolute UTF-16 start for single-occurrence replace; requires exactly one target */
  occurrenceStart?: number;
};

export type WorktreeReplaceFileResult = {
  domain: WorktreeSearchDomain;
  nodeId: string;
  label: string;
  displayPath: string;
  matchCount: number;
  updated: boolean;
};

export type WorktreeReplaceResult = {
  query: string;
  replacement: string;
  isRegex: boolean;
  files: WorktreeReplaceFileResult[];
  totalReplacements: number;
  filesUpdated: number;
  revision: number;
};

type WorktreeSearchHitBase = {
  domain: WorktreeSearchDomain;
  /** 树节点 id，用于打开编辑器 / 定位侧栏项。 */
  nodeId: string;
  label: string;
  /** 手稿为章节路径标题；资源为 `resources/` 下相对路径。 */
  displayPath: string;
  /**
   * 命中所在行的上下文片段（单行）。
   * 等于 `snippetBefore + matchText + snippetAfter`，供纯文本消费者使用。
   */
  snippet: string;
  /** 匹配前的上下文（可含前导 `…`）。 */
  snippetBefore: string;
  /** 本条 hit 的匹配原文（零宽匹配时为空串）。 */
  matchText: string;
  /** 匹配后的上下文（可含尾随 `…`）。 */
  snippetAfter: string;
  /** 命中行号，1-based。 */
  line: number;
  /** 该行内首个命中列，0-based UTF-16 偏移。 */
  column: number;
  /** 该行内首个命中的 UTF-16 长度。 */
  matchLength: number;
  /** UTF-16 offset in full document content. */
  matchStart: number;
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
  /** 本次搜索是否按正则解释 `query`。 */
  isRegex: boolean;
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
  replace(options: WorktreeReplaceQuery): WorktreeReplaceResult;
}
