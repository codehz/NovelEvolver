import { contentDomainIconClass } from "#app/features/project-workbench/tree/content-tree-icons";
import { cn } from "#app/shared/lib/ui/cn";

const emptyStateClass = cn(
  "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center",
);

export function EditorEmptyState() {
  return (
    <div className={emptyStateClass}>
      <span
        aria-hidden="true"
        className={cn(contentDomainIconClass("manuscript"), "text-4xl text-ctp-overlay0")}
      />
      <p className="max-w-sm text-sm text-ctp-subtext0">
        尚未打开任何文稿。请从侧栏资源库选择文件，或待正文接入后从手稿区打开章节。
      </p>
    </div>
  );
}
