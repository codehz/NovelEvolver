import { AutoTransition } from "@codehz/auto-transition";
import { ScopeProvider, useMolecule } from "bunshi/react";
import { Suspense, use, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link, useParams } from "wouter";

import { projectDisplayName } from "#app/shared/lib/project-display-name";
import { convertRpcPromise } from "#app/shared/lib/rpc/rpc-utils";
import { useTitleBarTitle } from "#app/shared/lib/shell/titlebar-title";
import { cn } from "#app/shared/lib/ui/cn";
import { AiChatPanel } from "#workbench/auxiliary/ai-chat/AiChatPanel";
import { AiChatStateProvider } from "#workbench/auxiliary/ai-chat/state/use-ai-chat-state";
import { WorkbenchLayout, type WorkbenchPrimaryView } from "#workbench/chrome";
import { EditorArea } from "#workbench/editor/EditorArea";
import { BranchScopeProvider } from "#workbench/session/BranchScopeProvider";
import { projectIdScope, projectMolecule } from "#workbench/session/project-scope";
import { ChangesSidebarSection } from "#workbench/sidebar/ChangesSidebarSection";
import { ExplorerSidebar } from "#workbench/sidebar/ExplorerSidebar";
import { SearchSidebarSection } from "#workbench/sidebar/SearchSidebarSection";
import { WorkbenchStatusBar } from "#workbench/statusbar/WorkbenchStatusBar";

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

const projectMetadataPromiseMolecule = convertRpcPromise(
  projectMolecule,
  async (projectPromise) => (await projectPromise).metadata,
);

function ProjectWorkbenchInner() {
  const metadata = use(useMolecule(projectMetadataPromiseMolecule));
  const displayName = projectDisplayName(metadata.path);
  useTitleBarTitle(displayName);
  const primaryViews = useMemo<readonly WorkbenchPrimaryView[]>(
    () => [
      {
        id: "explorer",
        title: "资源管理器",
        iconClass: cn("icon-[codicon--files]"),
        content: <ExplorerSidebar projectLabel={displayName} />,
      },
      {
        id: "search",
        title: "搜索",
        iconClass: cn("icon-[codicon--search]"),
        content: <SearchSidebarSection />,
      },
      {
        id: "changes",
        title: "更改",
        iconClass: cn("icon-[codicon--source-control]"),
        content: <ChangesSidebarSection />,
      },
    ],
    [displayName],
  );
  const editorSlot = useMemo(() => <EditorArea />, []);
  const auxiliarySlot = useMemo(() => <AiChatPanel />, []);

  return (
    <BranchScopeProvider>
      <AiChatStateProvider>
        <WorkbenchLayout
          primaryViews={primaryViews}
          editor={editorSlot}
          auxiliary={auxiliarySlot}
        />
        <WorkbenchStatusBar />
      </AiChatStateProvider>
    </BranchScopeProvider>
  );
}
