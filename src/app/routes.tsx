import { AutoTransition } from "@codehz/auto-transition";
import { Route, Switch } from "wouter";

import { ProjectList } from "#app/features/project-list";
import { ProjectWorkbench } from "#app/features/project-workbench";

export function AppRoutes() {
  return (
    <AutoTransition as="div" className="contents">
      <Switch>
        <Route path="/project/:projectId" component={ProjectWorkbench} />
        <Route component={ProjectList} />
      </Switch>
    </AutoTransition>
  );
}
