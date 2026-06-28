import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";

import type { ProjectListItem } from "../../shared/project";
import { TitleBarTitle } from "../components/TitleBarTitle";
import { buildWorkbenchDemoSlots } from "../components/workbench/demo/workbench-demo";
import { WorkbenchLayout } from "../components/workbench/WorkbenchLayout";
import { cn } from "../lib/cn";
import { projectDisplayName } from "../lib/project-display-name";

export function ProjectWorkbench() {
  const { projectId } = useParams<{ projectId: string }>();
  const parsedId = projectId ? Number.parseInt(projectId, 10) : Number.NaN;
  const validId = Number.isFinite(parsedId) && parsedId > 0;

  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validId) {
      setLoading(false);
      setError("无效的项目 ID");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void window
      .invokeIpc("projects:get", parsedId)
      .then((record) => {
        if (cancelled) {
          return;
        }
        if (!record) {
          setProject(null);
          setError("未找到该项目，可能已从列表移除");
          return;
        }
        setProject(record);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载项目失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [parsedId, validId]);

  const titleBarLabel = !validId
    ? "无效的项目"
    : loading
      ? "加载中…"
      : error
        ? "项目"
        : project
          ? projectDisplayName(project.path)
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
        <WorkbenchLayout {...buildWorkbenchDemoSlots(projectDisplayName(project.path))} />
      ) : null}
    </div>
  );
}
