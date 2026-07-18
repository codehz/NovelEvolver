import type { ReactNode } from "react";

type DetailFieldProps = {
  label: string;
  children: ReactNode;
};

export function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-ctp-subtext0">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-app-foreground">{children}</dd>
    </div>
  );
}

type DetailListProps = {
  children: ReactNode;
};

export function DetailList({ children }: DetailListProps) {
  return <dl className="flex flex-col gap-1.5">{children}</dl>;
}
