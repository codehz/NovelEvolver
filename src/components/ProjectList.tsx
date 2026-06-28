import { useCallback, useEffect, useState } from "react";

import type { ProjectRecord } from "../../shared/project";
import { cn } from "../lib/cn";

function formatLastOpened(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function projectName(path: string): string {
  const segments = path.replace(/\/$/, "").split(/[/\\]/);
  return segments.at(-1) ?? path;
}

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await window.invokeIpc("projects:list");
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载项目列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpenDialog = async () => {
    setOpening(true);
    setError(null);
    try {
      const project = await window.invokeIpc("projects:open-dialog");
      if (project) {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开文件夹失败");
    } finally {
      setOpening(false);
    }
  };

  const handleOpenProject = async (id: number) => {
    setError(null);
    try {
      await window.invokeIpc("projects:record-open", id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新打开时间失败");
    }
  };

  return (
    <div className="flex size-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-app-foreground">项目</h1>
        <button
          className={cn(
            "rounded-md bg-badge-background px-3 py-1.5 text-sm font-medium text-badge-foreground",
            "hover:opacity-90 disabled:opacity-50",
          )}
          disabled={opening}
          type="button"
          onClick={() => {
            void handleOpenDialog();
          }}
        >
          {opening ? "选择中…" : "打开项目"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-ctp-red" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ctp-subtext0">加载中…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-ctp-subtext0">暂无项目，点击「打开项目」选择文件夹。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-md border border-titlebar-border",
                  "bg-titlebar-background px-3 py-2 text-left transition-colors hover:bg-ctp-surface0/40",
                )}
                type="button"
                onClick={() => {
                  void handleOpenProject(project.id);
                }}
              >
                <span className="font-medium text-app-foreground">{projectName(project.path)}</span>
                <span className="truncate text-xs text-ctp-subtext0">{project.path}</span>
                <span className="text-xs text-ctp-subtext1">
                  上次打开：{formatLastOpened(project.lastOpenedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}