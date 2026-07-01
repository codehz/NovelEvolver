import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import { WindowFrame } from "#app/components/WindowFrame";
import {
  StatusBarLeftPortalProvider,
  StatusBarRightPortalProvider,
} from "#app/lib/statusbar-portal";
import { TitleBarActionsPortalProvider } from "#app/lib/titlebar-portal";
import { AppRoutes } from "#app/routes";

export default function App() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TitleBarActionsPortalProvider>
        <StatusBarLeftPortalProvider>
          <StatusBarRightPortalProvider>
            <Router hook={useHashLocation}>
              <WindowFrame>
                <AppRoutes />
              </WindowFrame>
            </Router>
          </StatusBarRightPortalProvider>
        </StatusBarLeftPortalProvider>
      </TitleBarActionsPortalProvider>
    </div>
  );
}
