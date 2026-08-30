import { useEffect, useState } from "react";

import { useProjectContext } from "#workbench/session/project-scope";

export function useMockAiAvailable(): boolean {
  const project = useProjectContext();
  const [mockAiAvailable, setMockAiAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve(project.getMockAiControl()).then((control) => {
      if (active) {
        setMockAiAvailable(control !== null);
      }
    });
    return () => {
      active = false;
    };
  }, [project]);

  return mockAiAvailable;
}
