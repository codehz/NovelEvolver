import type {
  AiProjectStructureManuscriptNode,
  AiProjectStructureResourceNode,
  WorktreeSession,
} from "../../../worktree/session";
import { computeTextStats, type TextStats } from "../../tools/text-stats";
import { MAX_FOCUS_CONTENT_CHARS, MAX_FOCUS_TARGETS } from "./policy";

/** Minimal focus target shape (matches run_subagent focus entries). */
export type FocusTargetRef = {
  domain: "manuscript" | "resource";
  id: string;
};

/** Optional budgets when resolving / formatting focus for a subagent run. */
export type FocusInjectLimits = {
  maxFocusTargets?: number;
  maxFocusContentChars?: number;
};

function resolveMaxFocusTargets(limits?: FocusInjectLimits): number {
  const value = limits?.maxFocusTargets;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return MAX_FOCUS_TARGETS;
}

function resolveMaxFocusContentChars(limits?: FocusInjectLimits): number {
  const value = limits?.maxFocusContentChars;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return MAX_FOCUS_CONTENT_CHARS;
}

export type FocusTextSnapshot = {
  domain: "manuscript" | "resource";
  id: string;
  kind: "chapter" | "file";
  label: string;
  displayPath: string;
  status: "ok" | "truncated";
  content: string;
  originalCharCount: number;
  stats: TextStats;
  revision: number;
};

export type FocusFolderSnapshot = {
  domain: "manuscript" | "resource";
  id: string;
  kind: "folder";
  label: string;
  displayPath: string;
  status: "ok";
  /** Compact child list for prompt injection (no full tree dump). */
  children: Array<{
    id: string;
    kind: string;
    label: string;
    displayPath: string;
    charCount: number | null;
  }>;
};

export type FocusErrorSnapshot = {
  domain: "manuscript" | "resource";
  id: string;
  kind: null;
  label: null;
  displayPath: null;
  status: "error";
  error: string;
};

export type FocusSnapshot = FocusTextSnapshot | FocusFolderSnapshot | FocusErrorSnapshot;

function truncateContent(
  content: string,
  maxChars: number,
): { text: string; status: "ok" | "truncated" } {
  if (content.length <= maxChars) {
    return { text: content, status: "ok" };
  }
  return {
    text: `${content.slice(0, maxChars)}\n…[已截断，完整正文请 read_document]`,
    status: "truncated",
  };
}

function resolveTextSnapshot(
  worktree: WorktreeSession,
  domain: "manuscript" | "resource",
  id: string,
  kind: "chapter" | "file",
  label: string,
  displayPath: string,
  maxContentChars: number,
): FocusTextSnapshot {
  const content =
    domain === "manuscript" ? worktree.readChapter(id) : worktree.readResourceFile(id);
  const { text, status } = truncateContent(content, maxContentChars);
  return {
    domain,
    id,
    kind,
    label,
    displayPath,
    status,
    content: text,
    originalCharCount: content.length,
    stats: computeTextStats(content),
    revision: worktree.getDocumentContentRevision(domain, id),
  };
}

function mapManuscriptChildren(
  nodes: readonly AiProjectStructureManuscriptNode[],
  parentId: string,
): FocusFolderSnapshot["children"] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.title,
      displayPath: node.displayPath,
      charCount: node.charCount ?? null,
    }));
}

function mapResourceChildren(
  nodes: readonly AiProjectStructureResourceNode[],
  parentId: string,
): FocusFolderSnapshot["children"] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.name,
      displayPath: node.displayPath,
      charCount: node.charCount ?? null,
    }));
}

function resolveFolderSnapshot(
  worktree: WorktreeSession,
  domain: "manuscript" | "resource",
  id: string,
  label: string,
  displayPath: string,
): FocusFolderSnapshot {
  const structure = worktree.getProjectStructure({ domain, id });
  const children =
    domain === "manuscript"
      ? mapManuscriptChildren(structure.manuscript?.nodes ?? [], id)
      : mapResourceChildren(structure.resource?.nodes ?? [], id);

  return {
    domain,
    id,
    kind: "folder",
    label,
    displayPath,
    status: "ok",
    children,
  };
}

function errorSnapshot(
  domain: "manuscript" | "resource",
  id: string,
  error: string,
): FocusErrorSnapshot {
  return {
    domain,
    id,
    kind: null,
    label: null,
    displayPath: null,
    status: "error",
    error,
  };
}

/**
 * Resolve focus node ids into content/structure snapshots for subagent prompt injection.
 * Soft-fails per target (error snapshot) so one bad id does not abort the whole run.
 */
export function resolveFocusSnapshots(
  worktree: WorktreeSession,
  focus: readonly FocusTargetRef[],
  limits?: FocusInjectLimits,
): FocusSnapshot[] {
  const maxFocusTargets = resolveMaxFocusTargets(limits);
  const maxContentChars = resolveMaxFocusContentChars(limits);
  const limited = focus.slice(0, maxFocusTargets);
  const snapshots: FocusSnapshot[] = [];

  for (const target of limited) {
    try {
      const info = worktree.getProjectNodeInfo(target.domain, target.id);
      if (info.kind === "chapter" || info.kind === "file") {
        snapshots.push(
          resolveTextSnapshot(
            worktree,
            target.domain,
            target.id,
            info.kind,
            info.label,
            info.displayPath,
            maxContentChars,
          ),
        );
        continue;
      }
      if (info.kind === "folder") {
        snapshots.push(
          resolveFolderSnapshot(worktree, target.domain, target.id, info.label, info.displayPath),
        );
        continue;
      }
      snapshots.push(
        errorSnapshot(target.domain, target.id, `不支持的节点类型：${String(info.kind)}`),
      );
    } catch (error) {
      snapshots.push(
        errorSnapshot(
          target.domain,
          target.id,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  if (focus.length > maxFocusTargets) {
    snapshots.push(
      errorSnapshot(
        focus[maxFocusTargets]!.domain,
        focus[maxFocusTargets]!.id,
        `focus 超过上限 ${maxFocusTargets}，其余 ${focus.length - maxFocusTargets} 个未预载。`,
      ),
    );
  }

  return snapshots;
}

/** Format resolved focus snapshots into a prompt section for the subagent user message. */
export function formatFocusSnapshotsForPrompt(
  snapshots: readonly FocusSnapshot[],
  limits?: Pick<FocusInjectLimits, "maxFocusContentChars">,
): string {
  if (snapshots.length === 0) {
    return "";
  }

  const maxContentChars = resolveMaxFocusContentChars(limits);
  const lines: string[] = [
    "## 焦点预载（系统注入）",
    "下列内容已按 focus id 自动读入；优先直接使用，无需再 read_document 获取同一版本。",
    "若条目标记为截断/错误，或写回后 revision 冲突，再调用工具补读。",
    "写回时可将下方 revision 用作 expected_revision：每条 revision 仅对该文档有效，写其他文档不会使其失效；可跨会话沿用直至该文档正文再次变更。",
  ];

  snapshots.forEach((snapshot, index) => {
    lines.push("");
    if (snapshot.status === "error") {
      lines.push(`### [${index + 1}] ${snapshot.domain} id=${snapshot.id} · 预载失败`);
      lines.push(`- error: ${snapshot.error}`);
      return;
    }

    lines.push(`### [${index + 1}] ${snapshot.domain} · ${snapshot.kind} · ${snapshot.label}`);
    lines.push(`- id: ${snapshot.id}`);
    lines.push(`- path: ${snapshot.displayPath}`);

    if (snapshot.kind === "folder") {
      if (snapshot.children.length === 0) {
        lines.push("- 直接子节点: （无）");
        return;
      }
      lines.push("- 直接子节点:");
      for (const child of snapshot.children) {
        const size = child.charCount === null ? "" : ` char_count=${child.charCount}`;
        lines.push(`  - ${child.kind} id=${child.id} path="${child.displayPath}"${size}`);
      }
      lines.push("- 需要正文时再对具体 chapter/file 调用 read_document。");
      return;
    }

    lines.push(`- revision: ${snapshot.revision}`);
    lines.push(
      `- stats: char_count=${snapshot.stats.char_count} line_count=${snapshot.stats.line_count} word_count=${snapshot.stats.word_count}`,
    );
    if (snapshot.status === "truncated") {
      lines.push(
        `- 注意: 原文 ${snapshot.originalCharCount} 字，已截断至 ${maxContentChars} 字；完整正文请 read_document。`,
      );
    }
    lines.push("");
    lines.push("```text");
    lines.push(snapshot.content);
    lines.push("```");
  });

  return lines.join("\n");
}
