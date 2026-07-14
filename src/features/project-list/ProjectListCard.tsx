import { projectDisplayName } from "#app/shared/lib/project-display-name";
import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import type { ProjectMetadata } from "#shared/project";

import { formatLastOpened } from "./format-last-opened";

const projectCardActionClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-0",
  "text-ctp-subtext0 transition-colors duration-150",
  iconButtonHoverClass,
  "hover:text-ctp-red",
  controlFocusVisibleClass,
);

type ProjectListCardProps = {
  project: ProjectMetadata;
  onOpen: (id: number) => void;
  onRemove: (id: number) => void;
};

export function ProjectListCard({ project, onOpen, onRemove }: ProjectListCardProps) {
  const name = projectDisplayName(project.path);

  return (
    <li>
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
            onRemove(project.id);
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--trash] text-sm" />
        </button>

        <button
          className="flex w-full min-w-0 flex-col gap-2 p-4 text-left"
          type="button"
          onClick={() => {
            onOpen(project.id);
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--repo] text-xl text-ctp-blue" />
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
}
