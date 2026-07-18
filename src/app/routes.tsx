import { AutoTransition } from "@codehz/auto-transition";
import { lazy, Suspense, type ComponentType } from "react";
import { Route, Switch } from "wouter";

import { cn } from "#app/shared/lib/ui/cn";

const ProjectList = lazy(() =>
  import("#app/features/project-list").then((module) => ({
    default: module.ProjectList as ComponentType,
  })),
);

const ProjectWorkbench = lazy(() =>
  import("#app/features/project-workbench").then((module) => ({
    default: module.ProjectWorkbench as ComponentType,
  })),
);

const routeFallbackClass = cn(
  "flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-ctp-subtext0",
);

function RouteFallback() {
  return <div className={routeFallbackClass}>加载中…</div>;
}

export function AppRoutes() {
  return (
    <AutoTransition as="div" className="contents">
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/project/:projectId" component={ProjectWorkbench} />
          <Route component={ProjectList} />
        </Switch>
      </Suspense>
    </AutoTransition>
  );
}
