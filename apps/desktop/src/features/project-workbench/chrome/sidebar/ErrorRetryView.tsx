import { Button } from "#app/shared/ui";

type ErrorRetryViewProps = { message: string; onRetry: () => void };

export function ErrorRetryView({ message, onRetry }: ErrorRetryViewProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--error] text-2xl text-ctp-red" />
      <p>{message}</p>
      <Button variant="link" className="text-xs" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}
