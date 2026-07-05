import { cn } from "#app/lib/cn";

export function ScmCommitForm({
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
  const canCommit = commitMessage.trim() !== "" && !committing;

  return (
    <div className="shrink-0 p-2">
      <textarea
        className="w-full resize-none rounded-sm border border-ctp-surface0 bg-ctp-base px-2 py-1.5 text-xs leading-tight text-ctp-text outline-none placeholder:text-ctp-overlay0 focus:border-ctp-mauve"
        rows={3}
        placeholder="提交信息…"
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
          "mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium",
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
      <p className="mt-1 text-center text-[10px] text-ctp-overlay0">Ctrl+Enter 提交</p>
    </div>
  );
}
