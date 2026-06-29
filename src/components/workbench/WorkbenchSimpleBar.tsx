import type { CSSProperties, ReactNode } from "react";
import SimpleBar from "simplebar-react";

import { cn } from "../../lib/cn";

const workbenchSimpleBarRootClass = cn("workbench-simplebar min-h-0");

export function WorkbenchSimpleBar({
  id,
  className,
  style,
  children,
  fill,
}: {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** When true, participate in flex column growth (sidebar section body). */
  fill?: boolean;
}) {
  return (
    <SimpleBar
      autoHide
      className={cn(workbenchSimpleBarRootClass, fill && "h-0 flex-1", className)}
      id={id}
      style={style}
    >
      {children}
    </SimpleBar>
  );
}
