import { useLocation } from "wouter";

import { projectsService } from "@/lib/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "@/lib/async-loader";
import { cn } from "@/lib/cn";
import { useNotifyAction } from "@/lib/notifications";
import { projectDisplayName } from "@/lib/project-display-name";
import { defaultWindowTitle, useTitleBarTitle } from "@/lib/titlebar-title";

function formatLastOpened(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

const projectCardActionClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0",
  "text-ctp-subtext0 transition-colors duration-150",
  "hover:bg-window-button-hover hover:text-ctp-red",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

const projectLoader = createAsyncLoader(() => projectsService.recents);

export function ProjectList() {
  useTitleBarTitle(defaultWindowTitle);
  const [, navigate] = useLocation();
  const projects = useAsyncLoader(projectLoader);
  const notifyAction = useNotifyAction();

  const handleCreateDialog = async () => {
    const project = await notifyAction.wrap(() => projectsService.createProjectDialog(), {
      errorMessage: "创建项目失败",
      toast: { source: "项目" },
    });
    if (project) {
      navigate(`/project/${project.id}`);
    }
  };

  const handleOpenDialog = async () => {
    const project = await notifyAction.wrap(() => projectsService.openProjectDialog(), {
      errorMessage: "打开项目文件失败",
      toast: { source: "项目" },
    });
    if (project) {
      navigate(`/project/${project.id}`);
    }
  };

  const handleOpenProject = async (id: number) => {
    navigate(`/project/${id}`);
  };

  const handleRemoveProject = async (id: number) => {
    const removed = await notifyAction.wrap(() => projectsService.removeRecent(id), {
      errorMessage: "从列表移除失败",
      toast: { source: "项目" },
    });
    if (removed) {
      await projects.refresh();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-app-foreground">项目</h1>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "rounded-md border border-titlebar-border bg-app-surface px-3 py-1.5 text-sm font-medium text-app-foreground",
              "hover:bg-ctp-surface0/40 disabled:opacity-50",
            )}
            disabled={notifyAction.pending}
            type="button"
            onClick={() => {
              void handleCreateDialog();
            }}
          >
            {notifyAction.pending ? "创建中…" : "新建项目"}
          </button>
          <button
            className={cn(
              "rounded-md bg-badge-background px-3 py-1.5 text-sm font-medium text-badge-foreground",
              "hover:opacity-90 disabled:opacity-50",
            )}
            disabled={notifyAction.pending}
            type="button"
            onClick={() => {
              void handleOpenDialog();
            }}
          >
            {notifyAction.pending ? "处理中…" : "打开项目"}
          </button>
        </div>
      </div>

      {projects.error ? (
        <p className="text-sm text-ctp-red" role="alert">
          {projects.error as string}
        </p>
      ) : null}

      {projects.data == null ? (
        <p className="text-sm text-ctp-subtext0">加载中…</p>
      ) : projects.data.length === 0 ? (
        <p className="text-sm text-ctp-subtext0">
          暂无项目，可「新建项目」或「打开项目」选择 .npk 文件。
        </p>
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] content-start gap-3 overflow-auto">
          {projects.data.map((project) => {
            const name = projectDisplayName(project.path);

            return (
              <li key={project.id}>
                <article
                  className={cn(
                    "group relative flex min-h-28 flex-col rounded-lg border border-titlebar-border",
                    "bg-app-surface transition-colors hover:border-ctp-surface1 hover:bg-ctp-surface0/30",
                  )}
                >
                  <button
                    aria-label={`从列表移除 ${name}`}
                    className={cn(
                      projectCardActionClass,
                      "absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100",
                    )}
                    type="button"
                    onClick={() => {
                      void handleRemoveProject(project.id);
                    }}
                  >
                    <span aria-hidden="true" className="icon-[codicon--trash] text-sm" />
                  </button>

                  <button
                    className="flex w-full min-w-0 flex-col gap-2 p-4 text-left"
                    type="button"
                    onClick={() => {
                      void handleOpenProject(project.id);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="icon-[codicon--file] text-xl text-ctp-mauve"
                    />
                    <span className="line-clamp-2 min-h-0 min-w-0 leading-snug font-medium text-app-foreground">
                      {name}
                    </span>
                    <span
                      className="line-clamp-2 min-h-0 min-w-0 text-xs leading-relaxed wrap-break-word text-ctp-subtext0"
                      title={project.path}
                    >
                      {project.displayPath}
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
