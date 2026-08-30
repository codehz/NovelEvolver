import { createContext, useContext } from "react";

import type { SplitLayout, SplitPane } from "./types";

export type SplitContextValue = {
  layout: SplitLayout;
  pane: SplitPane;
  showMaster: () => void;
  showDetail: () => void;
};

export const SplitContext = createContext<SplitContextValue | null>(null);

export function useSplitLayout(): SplitContextValue {
  const value = useContext(SplitContext);
  if (value == null) {
    throw new Error("useSplitLayout must be used within a split navigator.");
  }
  return value;
}
