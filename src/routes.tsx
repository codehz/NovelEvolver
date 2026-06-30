import { AutoTransition } from "@codehz/auto-transition";
import { Route, Switch } from "wouter";

import { ProjectList } from "@/pages/ProjectList";
import { ProjectWorkbench } from "@/pages/ProjectWorkbench";

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
