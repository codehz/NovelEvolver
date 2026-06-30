import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { useAtom } from "jotai";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  FloatingPickerListbox,
  FloatingPickerOption,
  FloatingPickerSearchField,
  FloatingPickerShell,
  floatingPickerEmptyStateClass,
  useFloatingPickerNavigation,
} from "@/components/floating-picker";
import { cn } from "@/lib/cn";

import { branchSwitcherOpenAtom, useBranchPickerSnapshot, useProjectContext } from "./branch-data";

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

export function BranchSwitcher() {
  const [open, setOpen] = useAtom(branchSwitcherOpenAtom);
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const listboxId = useId();

  const branches = snapshot.data?.branches ?? [];
  const headName = snapshot.data?.headName ?? null;

  const filtered = useMemo(() => filterBranches(branches, query), [branches, query]);
  const refreshSnapshot = snapshot.refresh;

  const selectBranch = useCallback(
    async (name: string) => {
      if (name === headName) {
        return;
      }
      await project.handle.switchBranch(name);
      await refreshSnapshot();
    },
    [headName, project.handle, refreshSnapshot],
  );

  const { highlightIndex, setHighlightIndex, listRef, onInputKeyDown, resetHighlight } =
    useFloatingPickerNavigation({
      itemCount: filtered.length,
      open,
      onActivate: (index) => {
        const branch = filtered[index];
        if (branch?.name) {
          void selectBranch(branch.name).then(() => {
            setOpen(false);
            setQuery("");
            resetHighlight();
          });
        }
      },
    });

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    resetHighlight();
  }, [resetHighlight, setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    resetHighlight();
    void refreshSnapshot();
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, refreshSnapshot, resetHighlight]);

  return (
    <FloatingPickerShell
      open={open}
      onClose={close}
      titleId={titleId}
      dismissAriaLabel="关闭分支切换器"
    >
      <p className="sr-only" id={titleId}>
        分支切换器
      </p>
      <FloatingPickerSearchField
        titleId={titleId}
        listboxId={listboxId}
        inputRef={inputRef}
        label="搜索或选择分支"
        placeholder="选择要切换的分支…"
        value={query}
        onChange={setQuery}
        onKeyDown={onInputKeyDown}
      />
      <FloatingPickerListbox listboxId={listboxId} listRef={listRef} ariaLabel="分支列表">
        {snapshot.isLoading && filtered.length === 0 ? (
          <li className={floatingPickerEmptyStateClass}>加载分支…</li>
        ) : null}
        {!snapshot.isLoading && filtered.length === 0 ? (
          <li className={floatingPickerEmptyStateClass}>无匹配分支</li>
        ) : null}
        {filtered.map((branch, index) => {
          const name = branch.name ?? "";
          const isCurrent = name !== "" && name === headName;
          const highlighted = index === highlightIndex;
          return (
            <FloatingPickerOption
              key={name || `branch-${index}`}
              index={index}
              highlighted={highlighted}
              emphasized={isCurrent}
              onHighlight={() => {
                setHighlightIndex(index);
              }}
              onSelect={() => {
                if (!branch.name) {
                  return;
                }
                if (branch.name === headName) {
                  close();
                  return;
                }
                void selectBranch(branch.name).then(close);
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
            </FloatingPickerOption>
          );
        })}
      </FloatingPickerListbox>
    </FloatingPickerShell>
  );
}
