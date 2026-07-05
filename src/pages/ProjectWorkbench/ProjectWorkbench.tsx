import { AutoTransition } from "@codehz/auto-transition";
import { ScopeProvider, useMolecule } from "bunshi/react";
import { Suspense, use } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link, useParams } from "wouter";

import { WorkbenchLayout } from "#app/components/workbench";
import { cn } from "#app/lib/cn";
import { projectDisplayName } from "#app/lib/project-display-name";
import { convertRpcPromise } from "#app/lib/rpc-utils";
import { useTitleBarTitle } from "#app/lib/titlebar-title";

import { BranchScopeProvider } from "./workbench/branch/BranchScopeProvider";
import { projectIdScope, projectMolecule } from "./workbench/state/molecules";
import { WorkbenchStatusBar } from "./workbench/statusbar/WorkbenchStatusBar";
import { buildWorkbenchSlots } from "./workbench/workbench-slots";

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
          "inline-flex items-center gap-1 rounded-md border border-titlebar-border bg-app-surface px-3 py-1.5 text-sm font-medium text-app-foreground",
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

const projectPromiseMolecule = convertRpcPromise(projectMolecule);

function ProjectWorkbenchInner() {
  const project = use(useMolecule(projectPromiseMolecule));
  const displayName = projectDisplayName(project.metadata.path);
  useTitleBarTitle(displayName);
  return (
    <BranchScopeProvider>
      <WorkbenchLayout {...buildWorkbenchSlots(displayName)} />
      <WorkbenchStatusBar />
    </BranchScopeProvider>
  );
}
