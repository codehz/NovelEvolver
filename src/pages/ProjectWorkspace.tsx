import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";

import type { ProjectListItem } from "../../shared/project";
import { cn } from "../lib/cn";

export function ProjectWorkspace() {
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

  return (
    <div className="flex size-full min-h-0 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
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

      {loading ? (
        <p className="text-sm text-ctp-subtext0">加载中…</p>
      ) : error ? (
        <p className="text-sm text-ctp-red" role="alert">
          {error}
        </p>
      ) : project ? (
        <div className="flex flex-col gap-3 rounded-lg border border-titlebar-border bg-titlebar-background p-6">
          <h1 className="text-lg font-semibold text-app-foreground">项目工作区（占位）</h1>
          <p className="text-sm text-ctp-subtext0">
            路由已生效。后续将在此加载编辑器与项目内容。
          </p>
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-ctp-subtext1">项目 ID</dt>
              <dd className="text-app-foreground">{project.id}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-ctp-subtext1">路径</dt>
              <dd className="wrap-break-word text-app-foreground" title={project.path}>
                {project.path}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-ctp-subtext1">显示路径</dt>
              <dd className="wrap-break-word text-app-foreground">{project.displayPath}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}