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

const projectCardActionClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0",
  "text-ctp-subtext0 transition-colors duration-150",
  "hover:bg-window-button-hover hover:text-ctp-red",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

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

  const handleRemoveProject = async (id: number) => {
    setError(null);
    try {
      await window.invokeIpc("projects:remove", id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "从列表移除失败");
    }
  };

  return (
    <div className="flex size-full min-h-0 flex-col gap-4 p-6">
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
        <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 overflow-auto">
          {projects.map((project) => {
            const name = projectName(project.path);

            return (
              <li key={project.id}>
                <article
                  className={cn(
                    "group relative flex h-full min-h-28 flex-col rounded-lg border border-titlebar-border",
                    "bg-titlebar-background transition-colors hover:border-ctp-surface1 hover:bg-ctp-surface0/30",
                  )}
                >
                  <button
                    aria-label={`从列表移除 ${name}`}
                    className={cn(projectCardActionClass, "absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100")}
                    type="button"
                    onClick={() => {
                      void handleRemoveProject(project.id);
                    }}
                  >
                    <span aria-hidden="true" className="icon-[codicon--trash] text-sm" />
                  </button>

                  <button
                    className="flex min-h-28 flex-1 flex-col gap-2 p-4 pr-10 text-left"
                    type="button"
                    onClick={() => {
                      void handleOpenProject(project.id);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="icon-[codicon--folder] text-xl text-ctp-mauve"
                    />
                    <span className="line-clamp-2 leading-snug font-medium text-app-foreground">
                      {name}
                    </span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-ctp-subtext0">
                      {project.path}
                    </span>
                    <span className="mt-auto text-xs text-ctp-subtext1">
                      {formatLastOpened(project.lastOpenedAt)}
                    </span>
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}