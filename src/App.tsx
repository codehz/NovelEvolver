import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import { WindowFrame } from "./components/WindowFrame";
import { TitleBarPortalProvider } from "./lib/titlebar-portal";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TitleBarPortalProvider>
        <Router hook={useHashLocation}>
          <WindowFrame>
            <AppRoutes />
          </WindowFrame>
        </Router>
      </TitleBarPortalProvider>
    </div>
  );
}
