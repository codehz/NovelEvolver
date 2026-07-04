import { cn } from "#app/lib/cn";
import { notificationApi } from "#app/lib/notifications";

const toolbarClass = cn(
  "flex shrink-0 flex-wrap gap-1 border-t border-workbench-tab-border bg-app-surface p-2",
);

const demoButtonClass = cn("rounded-sm px-2 py-1 text-xs text-ctp-mauve hover:bg-ctp-text/8");

export function NotificationDemoToolbar() {
  return (
    <div aria-label="通知演示" className={toolbarClass} role="group">
      <button
        className={demoButtonClass}
        type="button"
        onClick={() => {
          notificationApi.info("布局演示：这是一条信息通知", { source: "演示" });
        }}
      >
        信息
      </button>
      <button
        className={demoButtonClass}
        type="button"
        onClick={() => {
          notificationApi.warning("演示：需要确认的警告", {
            source: "演示",
            actions: [
              {
                label: "知道了",
                onClick: () => {
                  notificationApi.info("已确认警告");
                },
              },
            ],
          });
        }}
      >
        警告
      </button>
      <button
        className={demoButtonClass}
        type="button"
        onClick={() => {
          notificationApi.error("演示：操作失败", { source: "演示" });
        }}
      >
        错误
      </button>
      <button
        className={demoButtonClass}
        type="button"
        onClick={() => {
          const id = notificationApi.progress("演示：正在同步…", { source: "演示" });
          let progress = 0;
          const timer = setInterval(() => {
            progress += 25;
            notificationApi.update(id, { progress });
            if (progress >= 100) {
              clearInterval(timer);
              notificationApi.update(id, {
                severity: "info",
                message: "演示：同步完成",
                progress: undefined,
              });
            }
          }, 400);
        }}
      >
        进度
      </button>
      <button
        className={demoButtonClass}
        type="button"
        onClick={() => {
          notificationApi.info("同一条 dedupe 通知会合并", {
            source: "演示",
            dedupeKey: "demo-dedupe",
          });
        }}
      >
        去重
      </button>
    </div>
  );
}
