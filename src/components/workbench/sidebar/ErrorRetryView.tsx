export function ErrorRetryView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--error] text-2xl text-ctp-red" />
      <p>{message}</p>
      <button
        type="button"
        className="text-xs text-ctp-mauve underline-offset-2 hover:underline"
        onClick={onRetry}
      >
        重试
      </button>
    </div>
  );
}
