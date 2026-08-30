import { Tooltip } from "@base-ui/react/tooltip";
import { ComposeContextProvider } from "foxact/compose-context-provider";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import { AppRoutes } from "#app/app/routes";
import {
  StatusBarLeftPortalProvider,
  StatusBarRightPortalProvider,
} from "#app/shared/lib/shell/statusbar-portal";
import { TitleBarActionsPortalProvider } from "#app/shared/lib/shell/titlebar-portal";
import { WindowFrame } from "#app/shell/WindowFrame";

const contexts = [
  <Tooltip.Provider key="tooltip" delay={400} closeDelay={0} timeout={400} />,
  <TitleBarActionsPortalProvider key="titlebar-actions" />,
  <StatusBarLeftPortalProvider key="statusbar-left" />,
  <StatusBarRightPortalProvider key="statusbar-right" />,
  <Router key="router" hook={useHashLocation}>
    {null}
  </Router>,
];

export default function App() {
  return (
    <div className="isolate flex min-h-0 flex-1 flex-col">
      <ComposeContextProvider contexts={contexts}>
        <WindowFrame>
          <AppRoutes />
        </WindowFrame>
      </ComposeContextProvider>
    </div>
  );
}
