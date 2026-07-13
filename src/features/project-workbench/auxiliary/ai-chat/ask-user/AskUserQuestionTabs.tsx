import { Tabs } from "@base-ui/react/tabs";

import { cn } from "#app/shared/lib/ui/cn";
import { scrollbarThinNativeClass } from "#app/shared/lib/ui/scrollbar";

const tabsRailClass = cn("flex gap-1.5 overflow-x-auto px-1 pb-1", scrollbarThinNativeClass);
const tabButtonClass = cn(
  "inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-left text-2xs transition-colors outline-none select-none",
  "border-titlebar-border bg-app-background text-ctp-subtext0 hover:bg-app-surface",
  "data-active:border-ctp-blue/50 data-active:bg-app-surface data-active:text-app-foreground",
  "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-badge-background",
);

/**
 * 多个待回答问题时切换激活条目的标签栏。按 pending input 的稳定 key 渲染，
 * 标签文本来自各条目 DTO 的 `prompt` 摘要。
 */
export function AskUserQuestionTabs({
  keys,
  summaries,
  activeKey,
  onSelectKey,
}: {
  keys: string[];
  summaries: string[];
  activeKey: string | null;
  onSelectKey: (key: string) => void;
}) {
  if (keys.length <= 1) {
    return null;
  }

  return (
    <Tabs.Root
      value={activeKey}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onSelectKey(next);
        }
      }}
    >
      <Tabs.List className={tabsRailClass}>
        {keys.map((key, index) => {
          const label = summaries[index] ?? `问题 ${index + 1}`;

          return (
            <Tabs.Tab key={key} value={key} className={tabButtonClass} title={label}>
              <span className="truncate">{label}</span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}
