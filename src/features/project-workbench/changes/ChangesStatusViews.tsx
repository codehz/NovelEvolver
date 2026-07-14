import { cn } from "#app/shared/lib/ui/cn";

export function ChangesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--check] text-2xl text-ctp-green" />
      <p>没有变更。</p>
    </div>
  );
}

export function ChangesLoading() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
      <p>正在计算差异…</p>
    </div>
  );
}

type ChangesWarningBannerProps = {
  message: string;
  className?: string;
};

export function ChangesWarningBanner({ message, className }: ChangesWarningBannerProps) {
  return (
    <div className={cn(className)}>
      <div className="rounded border border-ctp-yellow/40 bg-ctp-yellow/10 px-2 py-1 text-[10px] text-ctp-yellow">
        {message}
      </div>
    </div>
  );
}
