import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import { AppRoutes } from "#app/app/routes";
import {
  StatusBarLeftPortalProvider,
  StatusBarRightPortalProvider,
} from "#app/shared/lib/shell/statusbar-portal";
import { TitleBarActionsPortalProvider } from "#app/shared/lib/shell/titlebar-portal";
import { WindowFrame } from "#app/shell/WindowFrame";

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
