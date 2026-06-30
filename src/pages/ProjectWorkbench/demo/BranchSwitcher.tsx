import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { useAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

import { branchSwitcherOpenAtom, useBranchPickerSnapshot, useProjectContext } from "./branch-data";
import {
  branchPickerDismissLayerClass,
  branchPickerInputClass,
  branchPickerInputWrapClass,
  branchPickerListClass,
  branchPickerPanelClass,
  branchPickerRowClass,
  branchPickerRowCurrentClass,
  branchPickerRowHighlightClass,
} from "./branch-switcher-chrome";

function filterBranches(branches: BranchInfo[], query: string): BranchInfo[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return branches;
  }
  return branches.filter((branch) => {
    const name = branch.name ?? "";
    return name.toLowerCase().includes(normalized);
  });
}

function moveHighlightIndex(current: number, delta: number, length: number): number {
  if (length === 0) {
    return -1;
  }
  if (current < 0) {
    return delta > 0 ? 0 : length - 1;
  }
  return (current + delta + length) % length;
}

export function BranchSwitcher() {
  const [open, setOpen] = useAtom(branchSwitcherOpenAtom);
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const titleId = useId();
  const listboxId = useId();

  const branches = snapshot.data?.branches ?? [];
  const headName = snapshot.data?.headName ?? null;

  const filtered = useMemo(() => filterBranches(branches, query), [branches, query]);
  const refreshSnapshot = snapshot.refresh;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlightIndex(0);
  }, [setOpen]);

  const selectBranch = useCallback(
    async (name: string) => {
      if (name === headName) {
        close();
        return;
      }
      await project.handle.switchBranch(name);
      await refreshSnapshot();
      close();
    },
    [close, headName, project.handle, refreshSnapshot],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setHighlightIndex(0);
    void refreshSnapshot();
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, refreshSnapshot]);

  useEffect(() => {
    setHighlightIndex((index) => {
      if (filtered.length === 0) {
        return -1;
      }
      if (index < 0 || index >= filtered.length) {
        return 0;
      }
      return index;
    });
  }, [filtered.length, query]);

  useEffect(() => {
    if (!open || highlightIndex < 0) {
      return;
    }
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-branch-index="${highlightIndex}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((index) => moveHighlightIndex(index, 1, filtered.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((index) => moveHighlightIndex(index, -1, filtered.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const branch = filtered[highlightIndex];
      if (branch?.name) {
        void selectBranch(branch.name);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <button
            aria-label="关闭分支切换器"
            className={branchPickerDismissLayerClass}
            type="button"
            onClick={close}
          />
          <motion.div
            aria-labelledby={titleId}
            className={branchPickerPanelClass}
            role="dialog"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
          >
            <p className="sr-only" id={titleId}>
              分支切换器
            </p>
            <div className={branchPickerInputWrapClass}>
              <label className="sr-only" htmlFor={`${titleId}-input`}>
                搜索或选择分支
              </label>
              <input
                ref={inputRef}
                id={`${titleId}-input`}
                className={branchPickerInputClass}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={listboxId}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                placeholder="选择要切换的分支…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onKeyDown={onInputKeyDown}
              />
            </div>
            <ul
              ref={listRef}
              id={listboxId}
              className={branchPickerListClass}
              role="listbox"
              aria-label="分支列表"
            >
              {snapshot.isLoading && filtered.length === 0 ? (
                <li className="px-3 py-2 text-workbench-status-bar-muted">加载分支…</li>
              ) : null}
              {!snapshot.isLoading && filtered.length === 0 ? (
                <li className="px-3 py-2 text-workbench-status-bar-muted">无匹配分支</li>
              ) : null}
              {filtered.map((branch, index) => {
                const name = branch.name ?? "";
                const isCurrent = name !== "" && name === headName;
                const highlighted = index === highlightIndex;
                return (
                  <li
                    key={name || `branch-${index}`}
                    data-branch-index={index}
                    role="option"
                    aria-selected={highlighted}
                  >
                    <button
                      type="button"
                      className={cn(
                        branchPickerRowClass,
                        highlighted && branchPickerRowHighlightClass,
                        isCurrent && branchPickerRowCurrentClass,
                      )}
                      onMouseEnter={() => {
                        setHighlightIndex(index);
                      }}
                      onClick={() => {
                        if (branch.name) {
                          void selectBranch(branch.name);
                        }
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "icon-[codicon--check] size-4 shrink-0",
                          isCurrent ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                      {branch.commit ? (
                        <span className="shrink-0 font-mono text-xs text-workbench-status-bar-muted">
                          {branch.commit.slice(0, 7)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
