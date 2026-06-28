import { Route, Routes } from "react-router-dom";

import { ProjectList } from "./components/ProjectList";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProjectList />} index />
      <Route element={<ProjectWorkspace />} path="project/:projectId" />
    </Routes>
  );
}