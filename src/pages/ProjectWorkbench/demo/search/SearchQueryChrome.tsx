import { cn } from "#app/lib/cn";

export function SearchQueryChrome({
  query,
  statsLine,
  loading,
  onQueryChange,
}: {
  query: string;
  statsLine: string | null;
  loading: boolean;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="shrink-0 p-2">
      <label className="sr-only" htmlFor="workbench-search-input">
        搜索
      </label>
      <div className="flex items-center gap-1.5 rounded-sm bg-ctp-surface0 px-2 py-1">
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 text-sm text-ctp-overlay0",
            loading ? "icon-[codicon--loading] animate-spin" : "icon-[codicon--search]",
          )}
        />
        <input
          id="workbench-search-input"
          type="search"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-xs text-ctp-text outline-none placeholder:text-ctp-overlay0"
          placeholder="搜索正文与资源库"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query !== "" ? (
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded text-ctp-overlay0 hover:bg-ctp-surface1 hover:text-ctp-subtext1"
            title="清除"
            onClick={() => onQueryChange("")}
          >
            <span className="icon-[codicon--close] text-sm" />
          </button>
        ) : null}
      </div>
      {statsLine !== null ? (
        <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-ctp-subtext0">{statsLine}</p>
      ) : (
        <p className="mt-1.5 px-0.5 text-[10px] text-ctp-overlay0">输入关键词即时搜索</p>
      )}
    </div>
  );
}
