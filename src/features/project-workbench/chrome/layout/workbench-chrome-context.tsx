import { createContext, useContext, type ReactNode } from "react";

export type WorkbenchChromeContextValue = {
  activePrimaryViewId: string;
  primaryVisible: boolean;
  auxiliaryVisible: boolean;
};

const WorkbenchChromeContext = createContext<WorkbenchChromeContextValue | null>(null);

export function WorkbenchChromeProvider({
  value,
  children,
}: {
  value: WorkbenchChromeContextValue;
  children: ReactNode;
}) {
  return (
    <WorkbenchChromeContext.Provider value={value}>{children}</WorkbenchChromeContext.Provider>
  );
}

export function useWorkbenchChrome(): WorkbenchChromeContextValue {
  const value = useContext(WorkbenchChromeContext);
  if (value === null) {
    throw new Error("useWorkbenchChrome must be used within WorkbenchChromeProvider.");
  }
  return value;
}

/** 主侧栏某 view 是否处于前台（侧栏可见且为当前 activity）。 */
export function usePrimaryViewActive(viewId: string): boolean {
  const chrome = useWorkbenchChrome();
  return chrome.primaryVisible && chrome.activePrimaryViewId === viewId;
}

export function useAuxiliaryActive(): boolean {
  return useWorkbenchChrome().auxiliaryVisible;
}
