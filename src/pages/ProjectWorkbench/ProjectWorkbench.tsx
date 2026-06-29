import { ScopeProvider } from "bunshi/react";
import { Link, useParams } from "wouter";

import { TitleBarTitle } from "@/components/TitleBarTitle";
import { WorkbenchLayout } from "@/components/workbench";
import { skipToken, useQueryRequest } from "@/lib/app-query";
import { projectsService } from "@/lib/app-rpc";
import { cn } from "@/lib/cn";
import { projectDisplayName } from "@/lib/project-display-name";
import { projectScope } from "./demo/molecules";
import { buildWorkbenchDemoSlots } from "./demo/workbench-demo";

export function ProjectWorkbench() {
  const { projectId } = useParams<{ projectId: string }>();
  const parsedId = projectId ? Number.parseInt(projectId, 10) : Number.NaN;
  const validId = Number.isFinite(parsedId) && parsedId > 0;
  const projectQuery = useQueryRequest((id: number) => projectsService.openProject(id), {
    args: validId ? [parsedId] : skipToken,
    clearDataOnLoad: true,
    deps: [parsedId],
    errorMessage: "加载项目失败",
    initialData: null,
  });

  const project = projectQuery.data ?? null;
  const loading = validId ? projectQuery.loading : false;
  const error = !validId
    ? "无效的项目 ID"
    : projectQuery.error
      ? projectQuery.error
      : projectQuery.hasLoaded && !project?.metadata
        ? "未找到该项目，可能已从列表移除"
        : null;

  const titleBarLabel = !validId
    ? "无效的项目"
    : loading
      ? "加载中…"
      : error
        ? "项目"
        : project?.metadata
          ? projectDisplayName(project?.metadata.path)
          : "未找到项目";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TitleBarTitle>{titleBarLabel}</TitleBarTitle>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-ctp-subtext0">加载中…</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-ctp-red" role="alert">
            {error}
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
      ) : project ? (
        <ScopeProvider scope={projectScope} value={project}>
          <WorkbenchLayout
            {...buildWorkbenchDemoSlots(projectDisplayName(project.metadata.path))}
          />
        </ScopeProvider>
      ) : null}
    </div>
  );
}
