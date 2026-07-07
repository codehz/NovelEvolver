import { useEffect } from "react";
import { useLocation } from "wouter";

import { projectLibraryService } from "#app/lib/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/lib/async-loader";
import { useNotifyAction } from "#app/lib/notifications";
import type { ProjectMetadata } from "#shared/project";

import { ProjectListCard } from "./ProjectListCard";
import { ProjectListHeader } from "./ProjectListHeader";

const projectLoader = createAsyncLoader(() => projectLibraryService.recentProjects);

export function ProjectList() {
  const [, navigate] = useLocation();
  const projects = useAsyncLoader(projectLoader);
  const notifyAction = useNotifyAction();

  useEffect(() => {
    void projects.refresh();
  }, [projects.refresh]);

  const handleCreateDialog = async () => {
    const project = await notifyAction.wrap(() => projectLibraryService.showCreateDialog(), {
      errorMessage: "创建项目失败",
      toast: { source: "项目" },
    });
    if (project) {
      navigate(`/project/${project.id}`);
    }
  };

  const handleOpenDialog = async () => {
    const project = await notifyAction.wrap(() => projectLibraryService.showOpenDialog(), {
      errorMessage: "打开项目文件失败",
      toast: { source: "项目" },
    });
    if (project) {
      navigate(`/project/${project.id}`);
    }
  };

  const handleOpenProject = (id: number) => {
    navigate(`/project/${id}`);
  };

  const handleRemoveProject = async (id: number) => {
    const removed = await notifyAction.wrap(() => projectLibraryService.removeProject(id), {
      errorMessage: "从列表移除失败",
      toast: { source: "项目" },
    });
    if (removed) {
      await projects.refresh();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <ProjectListHeader
        pending={notifyAction.pending}
        onCreate={() => {
          void handleCreateDialog();
        }}
        onOpenDialog={() => {
          void handleOpenDialog();
        }}
      />

      {projects.error ? (
        <p className="text-sm text-ctp-red" role="alert">
          {projects.error as string}
        </p>
      ) : null}

      <ProjectListBody
        data={projects.data}
        onOpen={handleOpenProject}
        onRemove={(id) => {
          void handleRemoveProject(id);
        }}
      />
    </div>
  );
}

type ProjectListBodyProps = {
  data: ProjectMetadata[] | null | undefined;
  onOpen: (id: number) => void;
  onRemove: (id: number) => void;
};

function ProjectListBody({ data, onOpen, onRemove }: ProjectListBodyProps) {
  if (data == null) {
    return <p className="text-sm text-ctp-subtext0">加载中…</p>;
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-ctp-subtext0">
        暂无项目，可「新建项目」或「打开项目」选择 .npk 文件。
      </p>
    );
  }

  return (
    <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] content-start gap-3 overflow-auto">
      {data.map((project) => (
        <ProjectListCard key={project.id} project={project} onOpen={onOpen} onRemove={onRemove} />
      ))}
    </ul>
  );
}
