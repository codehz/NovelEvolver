import { Toggle } from "@base-ui/react/toggle";
import { useRef } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass } from "#app/shared/lib/ui/interaction-chrome";
import { IconTooltip, SlotText } from "#app/shared/ui";

const searchFieldRowClass = cn("flex h-7 items-center gap-1.5 rounded-sm bg-ctp-surface0 px-2");

const searchInputClass = cn(
  "min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0 text-xs leading-none text-ctp-text outline-none placeholder:text-ctp-overlay0",
  "appearance-none",
  "[&::-webkit-search-cancel-button]:hidden",
  "[&::-webkit-search-decoration]:hidden",
  "[&::-webkit-search-results-button]:hidden",
);

const searchOptionButtonClass = cn(
  "flex size-5 shrink-0 items-center justify-center rounded-sm text-ctp-overlay0",
  "hover:bg-ctp-surface1 hover:text-ctp-subtext1",
  controlFocusVisibleClass,
);

const searchRegexToggleClass = cn(
  searchOptionButtonClass,
  "data-pressed:bg-ctp-blue/20 data-pressed:text-ctp-blue",
  "hover:data-pressed:bg-ctp-blue/25 hover:data-pressed:text-ctp-blue",
);

type SearchQueryBarProps = {
  query: string;
  isRegex: boolean;
  statsLine: string | null;
  onQueryChange: (value: string) => void;
  onToggleRegex: () => void;
};

export function SearchQueryBar({
  query,
  isRegex,
  statsLine,
  onQueryChange,
  onToggleRegex,
}: SearchQueryBarProps) {
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
          placeholder={isRegex ? "正则表达式" : undefined}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <IconTooltip label="使用正则表达式" side="bottom">
          <Toggle
            pressed={isRegex}
            className={searchRegexToggleClass}
            aria-label="使用正则表达式"
            onPressedChange={() => {
              onToggleRegex();
            }}
          >
            <span className="icon-[codicon--regex] text-sm" />
          </Toggle>
        </IconTooltip>
        {query !== "" ? (
          <IconTooltip label="清除" side="bottom">
            <button
              type="button"
              className={searchOptionButtonClass}
              aria-label="清除"
              onClick={() => onQueryChange("")}
            >
              <span className="icon-[codicon--close] text-sm" />
            </button>
          </IconTooltip>
        ) : null}
      </div>
      <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-ctp-subtext0">
        <SlotText text={displayStatsLine} options={{ skipUnchanged: true, interrupt: false }} />
      </p>
    </div>
  );
}
