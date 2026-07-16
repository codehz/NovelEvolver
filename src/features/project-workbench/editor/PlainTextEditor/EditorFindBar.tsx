import { Collapsible } from "@base-ui/react/collapsible";
import { Toggle } from "@base-ui/react/toggle";
import { getSearchQuery } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { collapsibleHeightMotionClass } from "#app/shared/lib/ui/interaction-chrome";
import { AppTooltip, Button, DisclosureChevron } from "#app/shared/ui";

import {
  applyEditorFindQuery,
  computeEditorFindMatchStats,
  type EditorFindMatchStats,
  runEditorFindNext,
  runEditorFindPrevious,
  runEditorReplaceAll,
  runEditorReplaceNext,
} from "./editor-find";
import {
  editorFindBarClass,
  editorFindFieldRowClass,
  editorFindIconButtonClass,
  editorFindInputClass,
  editorFindOptionButtonClass,
  editorFindOptionPressedClass,
  editorFindReplaceToggleClass,
  editorFindRowClass,
  editorFindStatsClass,
} from "./editor-find-chrome";

const replacePanelClass = cn(
  "h-(--collapsible-panel-height) overflow-hidden outline-none",
  collapsibleHeightMotionClass,
  "data-ending-style:h-0 data-starting-style:h-0",
  "[&[hidden]:not([hidden='until-found'])]:hidden",
);

/** Spacing lives inside the measured panel so collapse does not leave a residual flex gap. */
const replacePanelBodyClass = cn(editorFindRowClass, "pt-1");

type EditorFindBarProps = {
  view: EditorView;
  replaceExpanded: boolean;
  initialQuery: string;
  onReplaceExpandedChange: (open: boolean) => void;
  onClose: () => void;
  /** Parent binds this so CM updateListener can refresh match stats. */
  onBindRefresh: (refresh: (() => void) | null) => void;
};

export function EditorFindBar({
  view,
  replaceExpanded,
  initialQuery,
  onReplaceExpandedChange,
  onClose,
  onBindRefresh,
}: EditorFindBarProps) {
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacePanelId = useId();
  const findInputId = useId();
  const replaceInputId = useId();

  const [query, setQuery] = useState(initialQuery);
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [stats, setStats] = useState<EditorFindMatchStats>({ total: 0, current: 0 });

  const optionsRef = useRef({ query, replaceText, caseSensitive, wholeWord, regexp });
  optionsRef.current = { query, replaceText, caseSensitive, wholeWord, regexp };

  const refreshStats = () => {
    setStats(computeEditorFindMatchStats(view.state, getSearchQuery(view.state)));
  };

  useLayoutEffect(() => {
    onBindRefresh(refreshStats);
    return () => onBindRefresh(null);
  });

  // Seed CM query on mount (and when reopened with a new seed).
  useLayoutEffect(() => {
    applyEditorFindQuery(view, {
      search: initialQuery,
      replace: "",
      caseSensitive: false,
      wholeWord: false,
      regexp: false,
    });
    setStats(computeEditorFindMatchStats(view.state, getSearchQuery(view.state)));
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [view, initialQuery]);

  const pushQuery = (next: {
    query?: string;
    replaceText?: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regexp?: boolean;
    selectMatch?: boolean;
  }) => {
    const merged = {
      search: next.query ?? optionsRef.current.query,
      replace: next.replaceText ?? optionsRef.current.replaceText,
      caseSensitive: next.caseSensitive ?? optionsRef.current.caseSensitive,
      wholeWord: next.wholeWord ?? optionsRef.current.wholeWord,
      regexp: next.regexp ?? optionsRef.current.regexp,
    };
    applyEditorFindQuery(view, merged, { selectMatch: next.selectMatch ?? true });
    refreshStats();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    pushQuery({ query: value });
  };

  const handleReplaceTextChange = (value: string) => {
    setReplaceText(value);
    pushQuery({ replaceText: value, selectMatch: false });
  };

  const handleFindNext = () => {
    runEditorFindNext(view);
    refreshStats();
  };

  const handleFindPrevious = () => {
    runEditorFindPrevious(view);
    refreshStats();
  };

  const handleReplaceNext = () => {
    runEditorReplaceNext(view);
    refreshStats();
  };

  const handleReplaceAll = () => {
    runEditorReplaceAll(view);
    refreshStats();
  };

  const statsLabel =
    query === ""
      ? ""
      : stats.total === 0
        ? "无结果"
        : stats.current > 0
          ? `${stats.current}/${stats.total}`
          : `${stats.total}`;

  const canReplace = query !== "" && stats.total > 0;

  return (
    <div
      className={editorFindBarClass}
      role="search"
      aria-label="在编辑器中查找"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          view.focus();
        }
      }}
    >
      <div className={editorFindRowClass}>
        <AppTooltip label={replaceExpanded ? "隐藏替换" : "显示替换"} side="bottom">
          <button
            type="button"
            className={editorFindReplaceToggleClass}
            aria-label={replaceExpanded ? "隐藏替换" : "显示替换"}
            aria-expanded={replaceExpanded}
            aria-controls={replacePanelId}
            onClick={() => {
              const next = !replaceExpanded;
              onReplaceExpandedChange(next);
              if (next) {
                queueMicrotaskFocus(replaceInputRef);
              }
            }}
          >
            <DisclosureChevron expanded={replaceExpanded} />
          </button>
        </AppTooltip>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className={editorFindRowClass}>
            <label className="sr-only" htmlFor={findInputId}>
              查找
            </label>
            <div className={editorFindFieldRowClass}>
              <input
                ref={findInputRef}
                id={findInputId}
                type="search"
                autoComplete="off"
                spellCheck={false}
                className={editorFindInputClass}
                value={query}
                placeholder="查找"
                onChange={(event) => handleQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (event.shiftKey) {
                      handleFindPrevious();
                    } else {
                      handleFindNext();
                    }
                  }
                }}
              />
              <AppTooltip label="区分大小写" side="bottom">
                <Toggle
                  pressed={caseSensitive}
                  className={cn(editorFindOptionButtonClass, editorFindOptionPressedClass)}
                  aria-label="区分大小写"
                  onPressedChange={(pressed) => {
                    setCaseSensitive(pressed);
                    pushQuery({ caseSensitive: pressed });
                  }}
                >
                  <span className="icon-[codicon--case-sensitive] text-sm" />
                </Toggle>
              </AppTooltip>
              <AppTooltip label="全字匹配" side="bottom">
                <Toggle
                  pressed={wholeWord}
                  className={cn(editorFindOptionButtonClass, editorFindOptionPressedClass)}
                  aria-label="全字匹配"
                  onPressedChange={(pressed) => {
                    setWholeWord(pressed);
                    pushQuery({ wholeWord: pressed });
                  }}
                >
                  <span className="icon-[codicon--whole-word] text-sm" />
                </Toggle>
              </AppTooltip>
              <AppTooltip label="使用正则表达式" side="bottom">
                <Toggle
                  pressed={regexp}
                  className={cn(editorFindOptionButtonClass, editorFindOptionPressedClass)}
                  aria-label="使用正则表达式"
                  onPressedChange={(pressed) => {
                    setRegexp(pressed);
                    pushQuery({ regexp: pressed });
                  }}
                >
                  <span className="icon-[codicon--regex] text-sm" />
                </Toggle>
              </AppTooltip>
            </div>

            <span className={editorFindStatsClass} aria-live="polite">
              {statsLabel}
            </span>

            <AppTooltip label="上一个" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                className={editorFindIconButtonClass}
                aria-label="上一个匹配"
                disabled={query === "" || stats.total === 0}
                onClick={handleFindPrevious}
              >
                <span className="icon-[codicon--arrow-up] text-sm" />
              </Button>
            </AppTooltip>
            <AppTooltip label="下一个" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                className={editorFindIconButtonClass}
                aria-label="下一个匹配"
                disabled={query === "" || stats.total === 0}
                onClick={handleFindNext}
              >
                <span className="icon-[codicon--arrow-down] text-sm" />
              </Button>
            </AppTooltip>
            <AppTooltip label="关闭" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                className={editorFindIconButtonClass}
                aria-label="关闭查找"
                onClick={() => {
                  onClose();
                  view.focus();
                }}
              >
                <span className="icon-[codicon--close] text-sm" />
              </Button>
            </AppTooltip>
          </div>

          <Collapsible.Root open={replaceExpanded} onOpenChange={onReplaceExpandedChange}>
            <Collapsible.Panel id={replacePanelId} className={replacePanelClass}>
              <div className={replacePanelBodyClass}>
                <label className="sr-only" htmlFor={replaceInputId}>
                  替换
                </label>
                <div className={cn(editorFindFieldRowClass, "min-w-0 flex-1")}>
                  <input
                    ref={replaceInputRef}
                    id={replaceInputId}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    className={editorFindInputClass}
                    value={replaceText}
                    placeholder="替换"
                    onChange={(event) => handleReplaceTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (event.ctrlKey || event.metaKey) {
                          if (canReplace) {
                            handleReplaceAll();
                          }
                          return;
                        }
                        if (canReplace) {
                          handleReplaceNext();
                        }
                      }
                    }}
                  />
                </div>
                <AppTooltip label="替换" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={editorFindIconButtonClass}
                    aria-label="替换当前匹配"
                    disabled={!canReplace}
                    onClick={handleReplaceNext}
                  >
                    <span className="icon-[codicon--replace] text-sm" />
                  </Button>
                </AppTooltip>
                <AppTooltip label="全部替换" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={editorFindIconButtonClass}
                    aria-label="全部替换"
                    disabled={!canReplace}
                    onClick={handleReplaceAll}
                  >
                    <span className="icon-[codicon--replace-all] text-sm" />
                  </Button>
                </AppTooltip>
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        </div>
      </div>
    </div>
  );
}

function queueMicrotaskFocus(ref: React.RefObject<HTMLInputElement | null>) {
  queueMicrotask(() => {
    ref.current?.focus();
    ref.current?.select();
  });
}
