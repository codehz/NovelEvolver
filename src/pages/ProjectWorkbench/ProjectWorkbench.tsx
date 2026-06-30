import { AutoTransition } from "@codehz/auto-transition";
import { ScopeProvider, useMolecule } from "bunshi/react";
import { Suspense, use } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link, useParams } from "wouter";

import { WorkbenchLayout } from "@/components/workbench";
import { cn } from "@/lib/cn";
import { projectDisplayName } from "@/lib/project-display-name";
import { useTitleBarTitle } from "@/lib/titlebar-title";

import { projectMolecule, projectIdScope, projectScope } from "./demo/molecules";
import { StatusBar } from "./demo/StatusBar";
import { buildWorkbenchDemoSlots } from "./demo/workbench-demo";

export function ProjectWorkbench() {
  const { projectId } = useParams<{ projectId: string }>();
  const parsedId = projectId ? Number.parseInt(projectId, 10) : Number.NaN;

  return (
    <AutoTransition as="div" patch className="flex min-h-0 flex-1 flex-col">
      <ScopeProvider scope={projectIdScope} value={parsedId}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center p-6">
                <p className="text-sm text-ctp-subtext0">加载中…</p>
              </div>
            }
          >
            <ProjectWorkbenchInner />
          </Suspense>
        </ErrorBoundary>
      </ScopeProvider>
    </AutoTransition>
  );
}

function ErrorFallback({ error }: { error: unknown }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-ctp-red" role="alert">
        {String(error)}
      </p>
      <Link
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-titlebar-border bg-titlebar-background px-3 py-1.5 text-sm font-medium text-app-foreground",
          "hover:bg-ctp-surface0/40",
        )}
        href="/"
      >
        <span aria-hidden="true" className="icon-[codicon--arrow-left] text-sm" />
        返回项目列表
      </Link>
    </div>
  );
}

function ProjectWorkbenchInner() {
  const project = use(useMolecule(projectMolecule));
  const displayName = projectDisplayName(project.metadata.path);
  useTitleBarTitle(displayName);
  return (
    <ScopeProvider scope={projectScope} value={project}>
      <WorkbenchLayout {...buildWorkbenchDemoSlots(displayName)} />
      <StatusBar />
    </ScopeProvider>
  );
}
