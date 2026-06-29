import { useMolecule } from "bunshi/react";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";

import { cn } from "@/lib/cn";

import { EditorTabPane } from "./EditorTabPane";
import { workbenchEditorMolecule } from "./molecules";
import type { WorkbenchDemoTab } from "./types";

const initialDemoTabs: WorkbenchDemoTab[] = [
  { id: "chapter-1", label: "第一章.md", active: true },
  { id: "outline", label: "大纲.md", active: false },
];

const tabDefaultDocuments: Record<string, string> = {
  "chapter-1": [
    "# 第一章",
    "",
    "夜色落在稿纸上，编辑器骨架已经就位。",
    "左侧是活动栏与侧边栏，中间是文稿区域，右侧留给 AI 助手。",
    "",
    "（以上为布局演示文本，可在此直接编辑。）",
  ].join("\n"),
  outline: ["# 大纲", "", "（演示标签页，切换后内容独立保留。）"].join("\n"),
};

export function EditorArea() {
  const { tabsAtom, activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const setActiveTabId = useSetAtom(activeTabIdAtom);

  useEffect(() => {
    if (tabs.length > 0) {
      return;
    }
    setTabs(initialDemoTabs);
    setActiveTabId("chapter-1");
  }, [setActiveTabId, setTabs, tabs.length]);

  const activateTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      setTabs((current) =>
        current.map((tab) => ({
          ...tab,
          active: tab.id === tabId,
        })),
      );
    },
    [setActiveTabId, setTabs],
  );

  const activeTab = tabs.find((tab) => tab.active) ?? tabs[0];

  return (
    <section
      aria-label="编辑器"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-workbench-editor"
    >
      <div
        className="flex h-workbench-tab shrink-0 items-stretch bg-workbench-tab-bar"
        role="tablist"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "flex max-w-xs cursor-pointer items-center gap-2 px-3 text-sm",
              tab.active
                ? "bg-workbench-tab-active text-app-foreground"
                : "bg-workbench-tab-inactive text-ctp-subtext0",
            )}
            role="tab"
            aria-selected={tab.active}
            onClick={() => {
              activateTab(tab.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateTab(tab.id);
              }
            }}
            tabIndex={0}
          >
            <span aria-hidden="true" className="icon-[codicon--file] text-sm" />
            <span className="truncate">{tab.label}</span>
            <button
              aria-label={`关闭 ${tab.label}`}
              className="ml-1 rounded p-0.5 hover:bg-window-button-hover"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--close] text-xs" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-1 bg-workbench-editor px-3 text-xs text-ctp-subtext0">
        <span className="icon-[codicon--chevron-right] text-sm" />
        <span>手稿</span>
        <span className="icon-[codicon--chevron-right] text-sm" />
        <span className="text-app-foreground">{activeTab?.label ?? "未打开文件"}</span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tabs.map((tab) => (
          <EditorTabPane
            key={tab.id}
            tabId={tab.id}
            active={tab.active}
            defaultValue={tabDefaultDocuments[tab.id] ?? ""}
          />
        ))}
      </div>
    </section>
  );
}
