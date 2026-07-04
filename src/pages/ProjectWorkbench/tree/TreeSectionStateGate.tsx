import type { ReactNode } from "react";

type TreeSectionStatus = "idle" | "loading" | "ready" | "error";

type TreeSectionStateGateProps = {
  status: TreeSectionStatus;
  error: string | null;
  isEmpty: boolean;
  loadingLabel: string;
  emptyLabel: string;
  children: ReactNode;
};

export function TreeSectionStateGate({
  status,
  error,
  isEmpty,
  loadingLabel,
  emptyLabel,
  children,
}: TreeSectionStateGateProps) {
  if (status === "idle" || status === "loading") {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">{loadingLabel}</p>;
  }

  if (status === "error") {
    return (
      <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
        {error}
      </p>
    );
  }

  if (isEmpty) {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">{emptyLabel}</p>;
  }

  return children;
}
