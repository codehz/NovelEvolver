import { Collapsible } from "@base-ui/react/collapsible";
import { Toggle } from "@base-ui/react/toggle";
import { motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import {
  collapsibleHeightMotionClass,
  controlFocusVisibleClass,
  fieldSurfaceFocusWithinClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import { Button, AppTooltip, DisclosureChevron, SlotText } from "#app/shared/ui";

/** Matches DisclosureChevron / collapsible height ease. */
const replaceToggleLayoutTransition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Base UI Collapsible.Panel shell — height via `--collapsible-panel-height`. */
const replacePanelClass = cn(
  "h-(--collapsible-panel-height) overflow-hidden outline-none",
  collapsibleHeightMotionClass,
  "data-ending-style:h-0 data-starting-style:h-0",
  "[&[hidden]:not([hidden='until-found'])]:hidden",
);

/** Spacing lives inside the measured panel so collapse does not leave a residual flex gap. */
const replacePanelBodyClass = cn("flex items-center gap-1 pt-1");

const searchFieldRowClass = cn(fieldSurfaceFocusWithinClass, "flex h-7 items-center gap-1.5 px-2");

const searchInputClass = cn(
  "min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0 text-xs leading-none text-app-foreground outline-none placeholder:text-app-muted",
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

/**
 * Replace disclosure in the pl-5 gutter with 2px side gaps:
 * -ml-4.5 + w-4 + gap-0.5 → 2px | 16px button | 2px before the field column.
 * Stretches the full find/replace stack height.
 */
const replaceToggleClass = cn(
  "-ml-4.5 flex w-4 shrink-0 items-center justify-center self-stretch rounded-sm p-0 text-ctp-overlay0",
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

type SearchQueryBarProps = {
  query: string;
  replaceText: string;
  isRegex: boolean;
  statsLine: string | null;
  replaceBusy?: boolean;
  canReplaceAll?: boolean;
  onQueryChange: (value: string) => void;
  onReplaceTextChange: (value: string) => void;
  onToggleRegex: () => void;
  onReplaceAll: () => void;
};

export function SearchQueryBar({
  query,
  replaceText,
  isRegex,
  statsLine,
  replaceBusy = false,
  canReplaceAll = false,
  onQueryChange,
  onReplaceTextChange,
  onToggleRegex,
  onReplaceAll,
}: SearchQueryBarProps) {
  const [replaceExpanded, setReplaceExpanded] = useState(false);
  const replacePanelId = useId();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const lastStatsLineRef = useRef<string>("请输入搜索内容");
  if (statsLine !== null) {
    lastStatsLineRef.current = statsLine;
  }
  const displayStatsLine = statsLine ?? lastStatsLineRef.current;
  const replaceAllEnabled = canReplaceAll && !replaceBusy;

  useEffect(() => {
    if (!replaceExpanded) {
      return;
    }
    replaceInputRef.current?.focus();
  }, [replaceExpanded]);

  return (
    <div className="shrink-0 pt-1.5 pr-3 pl-5">
      <div className="flex items-stretch gap-0.5">
        <AppTooltip label={replaceExpanded ? "隐藏替换" : "显示替换"} side="bottom">
          <motion.button
            type="button"
            layout
            transition={replaceToggleLayoutTransition}
            className={replaceToggleClass}
            aria-label={replaceExpanded ? "隐藏替换" : "显示替换"}
            aria-expanded={replaceExpanded}
            aria-controls={replacePanelId}
            onClick={() => setReplaceExpanded((value) => !value)}
          >
            <motion.span layout transition={replaceToggleLayoutTransition} className="inline-flex">
              <DisclosureChevron expanded={replaceExpanded} />
            </motion.span>
          </motion.button>
        </AppTooltip>

        <div className="flex min-w-0 flex-1 flex-col">
          <label className="sr-only" htmlFor="workbench-search-input">
            搜索
          </label>
          <div className={searchFieldRowClass}>
            <input
              id="workbench-search-input"
              type="search"
              autoComplete="off"
              spellCheck={false}
              className={searchInputClass}
              value={query}
              placeholder="搜索"
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <AppTooltip label="使用正则表达式" side="bottom">
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
            </AppTooltip>
            {query !== "" ? (
              <AppTooltip label="清除" side="bottom">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={searchOptionButtonClass}
                  aria-label="清除"
                  onClick={() => onQueryChange("")}
                >
                  <span className="icon-[codicon--close] text-sm" />
                </Button>
              </AppTooltip>
            ) : null}
          </div>

          <Collapsible.Root open={replaceExpanded} onOpenChange={setReplaceExpanded}>
            <Collapsible.Panel id={replacePanelId} className={replacePanelClass}>
              <div className={replacePanelBodyClass}>
                <label className="sr-only" htmlFor="workbench-replace-input">
                  替换
                </label>
                <div className={cn(searchFieldRowClass, "min-w-0 flex-1")}>
                  <input
                    ref={replaceInputRef}
                    id="workbench-replace-input"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    className={searchInputClass}
                    value={replaceText}
                    placeholder="替换"
                    onChange={(event) => onReplaceTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && replaceAllEnabled) {
                        event.preventDefault();
                        onReplaceAll();
                      }
                    }}
                  />
                </div>
                <AppTooltip label="全部替换" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={searchOptionButtonClass}
                    aria-label="全部替换"
                    disabled={!replaceAllEnabled}
                    onClick={onReplaceAll}
                  >
                    <span className="icon-[codicon--replace-all] text-sm" />
                  </Button>
                </AppTooltip>
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        </div>
      </div>

      <p className="mt-1.5 px-0.5 text-2xs leading-snug text-ctp-subtext0">
        <SlotText text={displayStatsLine} options={{ skipUnchanged: true, interrupt: false }} />
      </p>
    </div>
  );
}
