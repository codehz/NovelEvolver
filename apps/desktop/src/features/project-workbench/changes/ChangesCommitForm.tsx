import { useActiveBranchName } from "#app/features/project-workbench/session/branch-scope";
import { cn } from "#app/shared/lib/ui/cn";
import { fieldSurfaceClass } from "#app/shared/lib/ui/interaction-chrome";
import { Button } from "#app/shared/ui";

type ChangesCommitFormProps = {
  commitMessage: string;
  committing: boolean;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
};

export function ChangesCommitForm({
  commitMessage,
  committing,
  onCommitMessageChange,
  onCommit,
}: ChangesCommitFormProps) {
  const branchName = useActiveBranchName();
  const canCommit = commitMessage.trim() !== "" && !committing;
  const placeholder = `消息 (Ctrl+Enter 在 "${branchName}" 提交)`;

  return (
    <div className="shrink-0 py-0.5 pr-3 pl-5">
      <textarea
        className={cn(
          fieldSurfaceClass,
          "field-sizing-content min-h-0 w-full resize-none px-2 py-1.5 text-xs leading-tight text-app-foreground placeholder:text-app-muted",
        )}
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
      <Button
        variant="primary"
        size="sm"
        className="mt-1 flex w-full items-center justify-center gap-1.5"
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
      </Button>
    </div>
  );
}
