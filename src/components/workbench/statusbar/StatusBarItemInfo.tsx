import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { statusBarItemInfoClass, statusBarItemInfoNumericClass } from "./statusbar-chrome";

export type StatusBarItemInfoProps = ComponentPropsWithoutRef<"span"> & {
  /** Use tabular figures for numeric readouts (line/column). */
  numeric?: boolean;
};

export function StatusBarItemInfo({ numeric = false, className, ...rest }: StatusBarItemInfoProps) {
  return (
    <span
      className={cn(numeric ? statusBarItemInfoNumericClass : statusBarItemInfoClass, className)}
      {...rest}
    />
  );
}
