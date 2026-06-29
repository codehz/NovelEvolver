import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { PlainTextEditor, type PlainTextEditorHandle } from "./PlainTextEditor";
import type { WorkbenchDemoTab } from "./types";

const initialDocumentLines = [
  "# 第一章",
  "",
  "夜色落在稿纸上，编辑器骨架已经就位。",
  "左侧是活动栏与侧边栏，中间是文稿区域，右侧留给 AI 助手。",
  "",
  "（以上为布局演示文本，可在此直接编辑。）",
];

export function EditorArea({ tabs }: { tabs: WorkbenchDemoTab[] }) {
  const editorRef = useRef<PlainTextEditorHandle>(null);
  const documentValueRef = useRef(initialDocumentLines.join("\n"));
  const handleDocumentChange = useCallback((next: string) => {
    documentValueRef.current = next;
  }, []);

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
              "flex max-w-xs items-center gap-2 px-3 text-sm",
              tab.active
                ? "bg-workbench-tab-active text-app-foreground"
                : "bg-workbench-tab-inactive text-ctp-subtext0",
            )}
            role="tab"
            aria-selected={tab.active}
          >
            <span aria-hidden="true" className="icon-[codicon--file] text-sm" />
            <span className="truncate">{tab.label}</span>
            <button
              aria-label={`关闭 ${tab.label}`}
              className="ml-1 rounded p-0.5 hover:bg-window-button-hover"
              type="button"
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
        <span className="text-app-foreground">第一章.md</span>
      </div>

      <PlainTextEditor
        ref={editorRef}
        defaultValue={documentValueRef.current}
        onChange={handleDocumentChange}
      />
    </section>
  );
}
