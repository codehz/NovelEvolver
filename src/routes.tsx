import { Route, Switch } from "wouter";

import { ProjectList } from "./components/ProjectList";
import { ProjectWorkbench } from "./pages/ProjectWorkbench";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/project/:projectId" component={ProjectWorkbench} />
      <Route component={ProjectList} />
    </Switch>
  );
}
