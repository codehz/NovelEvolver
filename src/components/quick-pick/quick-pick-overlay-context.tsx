import { createContext, useContext } from "react";

type QuickPickOverlayContextValue = {
  requestClose: (afterClose: () => void) => void;
};

const QuickPickOverlayContext = createContext<QuickPickOverlayContextValue | null>(null);

export function useQuickPickRequestClose(): QuickPickOverlayContextValue["requestClose"] {
  const value = useContext(QuickPickOverlayContext);
  if (value == null) {
    throw new Error("useQuickPickRequestClose must be used within QuickPickOverlay");
  }
  return value.requestClose;
}

export { QuickPickOverlayContext };
