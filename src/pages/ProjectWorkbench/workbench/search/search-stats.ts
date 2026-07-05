import type { WorktreeSearchHit } from "#shared/rpc/worktree-search";

export type SearchDomainStats = {
  /** 至少出现一条命中的条目数（章节/文件）。 */
  itemCount: number;
  resultCount: number;
};

export function summarizeSearchHits(hits: readonly WorktreeSearchHit[]): SearchDomainStats {
  const itemCount = new Set(hits.map((hit) => hit.nodeId)).size;
  return { itemCount, resultCount: hits.length };
}

export function formatSearchStatsLine(stats: SearchDomainStats): string {
  if (stats.resultCount === 0) {
    return "无结果";
  }
  return `${stats.itemCount} 个条目中有 ${stats.resultCount} 处命中`;
}
