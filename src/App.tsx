import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import { WindowFrame } from "./components/WindowFrame";
import { TitleBarPortalProvider } from "./lib/titlebar-portal";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <TitleBarPortalProvider>
      <Router hook={useHashLocation}>
        <WindowFrame>
          <AppRoutes />
        </WindowFrame>
      </Router>
    </TitleBarPortalProvider>
  );
}
