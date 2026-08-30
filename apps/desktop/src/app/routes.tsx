import { AutoTransition } from "@codehz/auto-transition";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Route, Switch } from "wouter";

import { ProjectList } from "#app/features/project-list";
import { ProjectWorkbench } from "#app/features/project-workbench";
import { Button } from "#app/shared/ui";

export function AppRoutes() {
  return (
    <ErrorBoundary FallbackComponent={AppRouteErrorFallback}>
      <AutoTransition as="div" className="contents">
        <Switch>
          <Route path="/project/:projectId" component={ProjectWorkbench} />
          <Route component={ProjectList} />
        </Switch>
      </AutoTransition>
    </ErrorBoundary>
  );
}

function AppRouteErrorFallback({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-ctp-red" role="alert">
        {message}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={() => {
          window.location.reload();
        }}
      >
        <span aria-hidden="true" className="icon-[codicon--refresh] text-sm" />
        重启
      </Button>
    </div>
  );
}
