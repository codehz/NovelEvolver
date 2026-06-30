import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { statusBarMessageClass } from "./statusbar-chrome";

export type StatusBarMessageProps = ComponentPropsWithoutRef<"span">;

export function StatusBarMessage({ className, ...rest }: StatusBarMessageProps) {
  return <span className={cn(statusBarMessageClass, className)} {...rest} />;
}
