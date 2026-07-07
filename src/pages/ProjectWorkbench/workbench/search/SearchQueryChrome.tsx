import { useRef } from "react";

import { SlotText } from "#app/components/SlotText";
import { cn } from "#app/lib/cn";

const searchFieldRowClass = cn("flex h-7 items-center gap-1.5 rounded-sm bg-ctp-surface0 px-2");

const searchInputClass = cn(
  "min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0 text-xs leading-none text-ctp-text outline-none placeholder:text-ctp-overlay0",
  "appearance-none",
  "[&::-webkit-search-cancel-button]:hidden",
  "[&::-webkit-search-decoration]:hidden",
  "[&::-webkit-search-results-button]:hidden",
);

export function SearchQueryChrome({
  query,
  statsLine,
  onQueryChange,
}: {
  query: string;
  statsLine: string | null;
  onQueryChange: (value: string) => void;
}) {
  const lastStatsLineRef = useRef<string>("请输入搜索内容");
  if (statsLine !== null) {
    lastStatsLineRef.current = statsLine;
  }
  const displayStatsLine = statsLine ?? lastStatsLineRef.current;

  return (
    <div className="shrink-0 pt-1.5 pr-3 pl-5">
      <label className="sr-only" htmlFor="workbench-search-input">
        搜索
      </label>
      <div className={searchFieldRowClass}>
        <span
          aria-hidden="true"
          className={cn("shrink-0 text-sm text-ctp-overlay0", "icon-[codicon--search]")}
        />
        <input
          id="workbench-search-input"
          type="search"
          autoComplete="off"
          spellCheck={false}
          className={searchInputClass}
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
      <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-ctp-subtext0">
        <SlotText text={displayStatsLine} options={{ skipUnchanged: true, interrupt: false }} />
      </p>
    </div>
  );
}
