import { Route, Switch } from "wouter";

import { ProjectList } from "./components/ProjectList";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/project/:projectId" component={ProjectWorkspace} />
      <Route component={ProjectList} />
    </Switch>
  );
}