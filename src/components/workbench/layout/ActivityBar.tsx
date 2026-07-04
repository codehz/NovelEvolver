import { Link } from "wouter";

import { cn } from "#app/lib/cn";

type ActivityItem = {
  id: string;
  label: string;
  iconClass: string;
};

const activityButtonClass = cn(
  "flex size-activity-bar shrink-0 items-center justify-center border-0 bg-transparent p-2.5",
  "text-ctp-overlay0 transition-colors duration-150",
  "hover:text-ctp-mauve",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

const activityIconClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center text-activity-bar-icon leading-none",
);

export function ActivityBar({
  items,
  activeView,
  primarySidebarVisible,
  onSelectView,
}: {
  items: readonly ActivityItem[];
  activeView: string | null;
  primarySidebarVisible: boolean;
  onSelectView: (viewId: string) => void;
}) {
  return (
    <nav
      aria-label="活动栏"
      className="relative z-30 flex h-full min-h-0 w-activity-bar shrink-0 flex-col bg-window-chrome"
    >
      <div className="flex flex-col">
        {items.map((item) => {
          const isActive = primarySidebarVisible && activeView === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? "page" : undefined}
              aria-expanded={isActive ? true : undefined}
              aria-label={item.label}
              className={cn(activityButtonClass, isActive && "text-ctp-mauve")}
              title={item.label}
              type="button"
              onClick={() => onSelectView(item.id)}
            >
              <span aria-hidden="true" className={cn(activityIconClass, item.iconClass)} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col">
        <Link
          aria-label="返回项目列表"
          className={cn(activityButtonClass, "app-region-no-drag")}
          href="/"
          title="返回项目列表"
        >
          <span aria-hidden="true" className={cn(activityIconClass, "icon-[codicon--home]")} />
        </Link>
      </div>
    </nav>
  );
}
