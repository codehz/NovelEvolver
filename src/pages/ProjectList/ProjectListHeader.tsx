import { cn } from "@/lib/cn";

type ProjectListHeaderProps = {
  pending: boolean;
  onCreate: () => void;
  onOpenDialog: () => void;
};

export function ProjectListHeader({ pending, onCreate, onOpenDialog }: ProjectListHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-lg font-semibold text-app-foreground">项目</h1>
      <div className="flex items-center gap-2">
        <button
          className={cn(
            "rounded-md border border-titlebar-border bg-app-surface px-3 py-1.5 text-sm font-medium text-app-foreground",
            "hover:bg-ctp-surface0/40 disabled:opacity-50",
          )}
          disabled={pending}
          type="button"
          onClick={onCreate}
        >
          {pending ? "创建中…" : "新建项目"}
        </button>
        <button
          className={cn(
            "rounded-md bg-badge-background px-3 py-1.5 text-sm font-medium text-badge-foreground",
            "hover:opacity-90 disabled:opacity-50",
          )}
          disabled={pending}
          type="button"
          onClick={onOpenDialog}
        >
          {pending ? "处理中…" : "打开项目"}
        </button>
      </div>
    </div>
  );
}
