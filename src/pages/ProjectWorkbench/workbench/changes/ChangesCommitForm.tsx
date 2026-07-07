import { cn } from "#app/shared/lib/ui/cn";

import { useActiveBranchName } from "../branch/branch-scopes";

export function ChangesCommitForm({
  commitMessage,
  committing,
  onCommitMessageChange,
  onCommit,
}: {
  commitMessage: string;
  committing: boolean;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
}) {
  const branchName = useActiveBranchName();
  const canCommit = commitMessage.trim() !== "" && !committing;
  const placeholder = `消息 (Ctrl+Enter 在 "${branchName}" 提交)`;

  return (
    <div className="shrink-0 py-0.5 pr-3 pl-5">
      <textarea
        className="field-sizing-content min-h-0 w-full resize-none rounded-sm bg-ctp-surface0 px-2 py-1.5 text-xs leading-tight text-ctp-text outline-none placeholder:text-ctp-overlay0"
        rows={1}
        placeholder={placeholder}
        value={commitMessage}
        onChange={(e) => onCommitMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit();
          }
        }}
        disabled={committing}
      />
      <button
        type="button"
        className={cn(
          "mt-1 flex w-full items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium",
          canCommit
            ? "bg-ctp-mauve text-ctp-crust hover:brightness-110"
            : "cursor-not-allowed bg-ctp-surface0 text-ctp-overlay0",
        )}
        disabled={!canCommit}
        onClick={onCommit}
      >
        {committing ? (
          <>
            <span className="icon-[codicon--loading] animate-spin text-sm" />
            提交中…
          </>
        ) : (
          <>
            <span className="icon-[codicon--check] text-sm" />
            提交
          </>
        )}
      </button>
    </div>
  );
}
