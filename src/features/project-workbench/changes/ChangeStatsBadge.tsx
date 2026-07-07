export function ChangeStatsBadge({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 font-mono text-[10px] leading-none">
      {added > 0 ? <span className="text-ctp-green">+{added}</span> : null}
      {removed > 0 ? <span className="text-ctp-red"> -{removed}</span> : null}
    </span>
  );
}
