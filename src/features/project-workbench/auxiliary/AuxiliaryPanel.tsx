import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";

import { NotificationToolbar } from "./NotificationToolbar";

const placeholderMessages = [
  {
    role: "assistant" as const,
    text: "你好，我是 AI 助手占位面板。后续可在此对话、改写章节或整理设定。",
  },
  {
    role: "user" as const,
    text: "请根据第一章的语气，给出一个开篇钩子（演示）。",
  },
  {
    role: "assistant" as const,
    text: "布局已就绪：右侧辅助栏独立于编辑区，便于对照文稿与建议。",
  },
];

export function AuxiliaryPanel() {
  return (
    <>
      <ScrollArea className="min-h-0 flex-1" fill>
        <div className="flex flex-col gap-3 p-3 text-sm">
          {placeholderMessages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "rounded-lg px-3 py-2",
                message.role === "user" ? "ml-4 bg-app-background" : "mr-4 bg-app-background",
              )}
            >
              <p className="mb-1 text-xs font-medium text-ctp-subtext0">
                {message.role === "user" ? "你" : "助手"}
              </p>
              <p className="text-app-foreground">{message.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      <NotificationToolbar />

      <footer className="shrink-0 p-3">
        <div className="flex items-end gap-2 rounded-lg bg-app-background p-2">
          <textarea
            aria-label="消息输入（演示）"
            className="min-h-16 flex-1 resize-none border-0 bg-transparent text-sm text-app-foreground outline-none placeholder:text-ctp-overlay0"
            placeholder="向 AI 提问…（仅布局演示）"
            readOnly
            rows={3}
          />
          <button
            aria-label="发送（演示）"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-badge-background text-badge-foreground hover:opacity-90"
            type="button"
          >
            <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
          </button>
        </div>
      </footer>
    </>
  );
}
