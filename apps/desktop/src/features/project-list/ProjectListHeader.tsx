import { useAtomValue } from "jotai";

import { settingsApi, settingsOpenAtom } from "#app/shared/lib/settings";
import { Button } from "#app/shared/ui";

type ProjectListHeaderProps = {
  pending: boolean;
  onCreate: () => void;
  onOpenDialog: () => void;
};

export function ProjectListHeader({ pending, onCreate, onOpenDialog }: ProjectListHeaderProps) {
  const settingsOpen = useAtomValue(settingsOpenAtom);

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-lg font-semibold text-app-foreground">项目</h1>
      <div className="flex items-center gap-2">
        <Button
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          aria-label="设置"
          disabled={pending}
          variant="secondary"
          size="icon-lg"
          onClick={() => {
            settingsApi.open();
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--settings-gear] text-base" />
        </Button>
        <Button disabled={pending} variant="secondary" size="md" onClick={onCreate}>
          {pending ? "创建中…" : "新建项目"}
        </Button>
        <Button disabled={pending} variant="primary" size="md" onClick={onOpenDialog}>
          {pending ? "处理中…" : "打开项目"}
        </Button>
      </div>
    </div>
  );
}
