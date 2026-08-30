import type { ReactNode } from "react";

export type WorkbenchPrimaryView = {
  id: string;
  title: string;
  iconClass: string;
  content: ReactNode;
};
