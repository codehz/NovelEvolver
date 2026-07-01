import { cn } from "#app/lib/cn";

const emptyStateClass = cn(
  "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center",
);

export function EditorEmptyState() {
  return (
    <div className={emptyStateClass}>
      <span aria-hidden="true" className={cn("icon-[codicon--book] text-4xl text-ctp-overlay0")} />
      <p className="max-w-sm text-sm text-ctp-subtext0">
        尚未打开任何文稿。请从侧栏资源库选择文件，或待正文接入后从手稿区打开章节。
      </p>
    </div>
  );
}
