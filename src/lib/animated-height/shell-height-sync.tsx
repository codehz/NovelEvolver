import { createContext, useContext, type ReactNode } from "react";

const AnimatedShellHeightContext = createContext(false);

export function AnimatedShellHeightProvider({
  isShellHeightAnimating,
  children,
}: {
  isShellHeightAnimating: boolean;
  children: ReactNode;
}) {
  return (
    <AnimatedShellHeightContext.Provider value={isShellHeightAnimating}>
      {children}
    </AnimatedShellHeightContext.Provider>
  );
}

/** True while the parent panel shell height is spring-animating (`useAnimatedContentHeight`). */
export function useIsAnimatedShellHeightAnimating(): boolean {
  return useContext(AnimatedShellHeightContext);
}
