import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { useAtom } from "jotai";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  FloatingPickerListbox,
  FloatingPickerOption,
  FloatingPickerSearchField,
  FloatingPickerShell,
  floatingPickerEmptyStateClass,
  floatingPickerInputClass,
  floatingPickerInputWrapClass,
  floatingPickerRowClass,
  useFloatingPickerNavigation,
} from "@/components/floating-picker";
import { cn } from "@/lib/cn";
import { notificationApi } from "@/lib/notifications";

import {
  branchSwitcherOpenAtom,
  createDemoBranchInfo,
  demoCreatedBranchesAtom,
  demoHeadOverrideAtom,
  getBranchNameValidationError,
  isDemoOnlyBranch,
  mergeBranchLists,
  normalizeBranchNameInput,
  useBranchPickerSnapshot,
  useProjectContext,
} from "./branch-data";

type PickerView = "list" | "create";

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

function branchNameExactMatch(branches: BranchInfo[], name: string): boolean {
  const lower = name.toLowerCase();
  return branches.some((branch) => (branch.name ?? "").toLowerCase() === lower);
}

const createBranchListFooterButtonClass = cn(
  floatingPickerRowClass,
  "border-t border-badge-background text-workbench-sidebar-title",
);

export function BranchSwitcher() {
  const [open, setOpen] = useAtom(branchSwitcherOpenAtom);
  const [demoCreated, setDemoCreated] = useAtom(demoCreatedBranchesAtom);
  const [demoHeadOverride, setDemoHeadOverride] = useAtom(demoHeadOverrideAtom);
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<PickerView>("list");
  const [query, setQuery] = useState("");
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const titleId = useId();
  const listboxId = useId();
  const createFormTitleId = useId();

  const serverBranches = snapshot.data?.branches ?? [];
  const serverHeadName = snapshot.data?.headName ?? null;
  const allBranches = useMemo(
    () => mergeBranchLists(serverBranches, demoCreated),
    [demoCreated, serverBranches],
  );
  const effectiveHeadName = demoHeadOverride ?? serverHeadName;

  const filtered = useMemo(() => filterBranches(allBranches, query), [allBranches, query]);
  const refreshSnapshot = snapshot.refresh;

  const createFromQueryName = useMemo(() => {
    const name = normalizeBranchNameInput(query);
    if (name === "" || branchNameExactMatch(allBranches, name)) {
      return null;
    }
    return getBranchNameValidationError(name, allBranches) === null ? name : null;
  }, [allBranches, query]);

  const listItemCount = filtered.length + (createFromQueryName != null ? 1 : 0);

  const commitCreateBranch = useCallback(
    (rawName: string) => {
      const name = normalizeBranchNameInput(rawName);
      const validationError = getBranchNameValidationError(name, allBranches);
      if (validationError != null) {
        setCreateError(validationError);
        return false;
      }
      setDemoCreated((prev) => [...prev, createDemoBranchInfo(name)]);
      setDemoHeadOverride(name);
      notificationApi.info(`已创建并切换到分支「${name}」（演示，未写入仓库）`, {
        source: "分支",
      });
      setOpen(false);
      setView("list");
      setQuery("");
      setCreateName("");
      setCreateError(null);
      return true;
    },
    [allBranches, setDemoCreated, setDemoHeadOverride, setOpen],
  );

  const selectBranch = useCallback(
    async (name: string) => {
      if (name === effectiveHeadName) {
        return;
      }
      if (isDemoOnlyBranch(name, serverBranches)) {
        setDemoHeadOverride(name);
        return;
      }
      await project.handle.switchBranch(name);
      setDemoHeadOverride(null);
      await refreshSnapshot();
    },
    [effectiveHeadName, project.handle, refreshSnapshot, serverBranches, setDemoHeadOverride],
  );

  const { highlightIndex, setHighlightIndex, listRef, onInputKeyDown, resetHighlight } =
    useFloatingPickerNavigation({
      itemCount: view === "list" ? listItemCount : 0,
      open: open && view === "list",
      onActivate: (index) => {
        if (createFromQueryName != null && index === 0) {
          commitCreateBranch(createFromQueryName);
          resetHighlight();
          return;
        }
        const branchIndex = createFromQueryName != null ? index - 1 : index;
        const branch = filtered[branchIndex];
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
    setView("list");
    setQuery("");
    setCreateName("");
    setCreateError(null);
    resetHighlight();
  }, [resetHighlight, setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setView("list");
    setQuery("");
    setCreateName("");
    setCreateError(null);
    resetHighlight();
    void refreshSnapshot();
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, refreshSnapshot, resetHighlight]);

  useEffect(() => {
    if (!open || view !== "create") {
      return;
    }
    const frame = requestAnimationFrame(() => {
      createNameRef.current?.focus();
      createNameRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, view]);

  useEffect(() => {
    if (!open || view !== "create") {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setView("list");
      setCreateError(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, view]);

  const openCreateForm = useCallback(() => {
    setCreateName(normalizeBranchNameInput(query));
    setCreateError(null);
    setView("create");
  }, [query]);

  const submitCreateForm = useCallback(() => {
    if (commitCreateBranch(createName)) {
      resetHighlight();
    }
  }, [commitCreateBranch, createName, resetHighlight]);

  return (
    <FloatingPickerShell
      open={open}
      onClose={close}
      titleId={view === "create" ? createFormTitleId : titleId}
      dismissAriaLabel="关闭分支切换器"
    >
      {view === "create" ? (
        <>
          <p className="sr-only" id={createFormTitleId}>
            创建新分支
          </p>
          <div className={floatingPickerInputWrapClass}>
            <label className="sr-only" htmlFor="branch-create-name">
              请提供新的分支名称
            </label>
            <input
              ref={createNameRef}
              id="branch-create-name"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="例如 feature/my-chapter"
              className={floatingPickerInputClass}
              value={createName}
              onChange={(event) => {
                setCreateName(event.target.value);
                setCreateError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitCreateForm();
                }
              }}
            />
            {createError ? (
              <p className="mt-1 text-xs text-notification-error" role="alert">
                {createError}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 border-t border-badge-background px-3 py-2 text-xs text-workbench-status-bar-muted">
            请提供新的分支名称（按 &quot;Enter&quot; 以确认或按 &quot;Esc&quot; 以取消）
          </p>
        </>
      ) : (
        <>
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
            {snapshot.isLoading && filtered.length === 0 && createFromQueryName == null ? (
              <li className={floatingPickerEmptyStateClass}>加载分支…</li>
            ) : null}
            {!snapshot.isLoading && filtered.length === 0 && createFromQueryName == null ? (
              <li className={floatingPickerEmptyStateClass}>无匹配分支</li>
            ) : null}
            {createFromQueryName != null ? (
              <FloatingPickerOption
                index={0}
                highlighted={highlightIndex === 0}
                onHighlight={() => {
                  setHighlightIndex(0);
                }}
                onSelect={() => {
                  commitCreateBranch(createFromQueryName);
                  resetHighlight();
                }}
              >
                <span aria-hidden="true" className="icon-[codicon--add] size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">创建分支「{createFromQueryName}」</span>
              </FloatingPickerOption>
            ) : null}
            {filtered.map((branch, index) => {
              const listIndex = createFromQueryName != null ? index + 1 : index;
              const name = branch.name ?? "";
              const isCurrent = name !== "" && name === effectiveHeadName;
              const highlighted = listIndex === highlightIndex;
              return (
                <FloatingPickerOption
                  key={name || `branch-${index}`}
                  index={listIndex}
                  highlighted={highlighted}
                  emphasized={isCurrent}
                  onHighlight={() => {
                    setHighlightIndex(listIndex);
                  }}
                  onSelect={() => {
                    if (!branch.name) {
                      return;
                    }
                    if (branch.name === effectiveHeadName) {
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
          <div className="shrink-0">
            <button
              type="button"
              className={createBranchListFooterButtonClass}
              onClick={openCreateForm}
            >
              <span aria-hidden="true" className="icon-[codicon--add] size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">创建新分支…</span>
            </button>
          </div>
        </>
      )}
    </FloatingPickerShell>
  );
}
