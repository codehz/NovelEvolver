import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import { MarkdownStream } from "#app/shared/ui/MarkdownStream";
import { ScrollArea } from "#app/shared/ui/ScrollArea";
import type { AiChatMessage, AiChatReasoning, AiChatToolCall } from "#shared/rpc/ai-rpc";
import { SidebarHeaderActions, sidebarHeaderActionClass } from "#workbench/chrome";

import { useAiChatState } from "./use-ai-chat-state";

const panelSectionClass = cn("mx-auto flex w-full max-w-3xl flex-col");
const conversationRailClass = cn("gap-4 px-3 py-2.5");
// Only user-authored messages may use bubble chrome; assistant output stays flat and compact.
const assistantMessageBlockClass = cn("flex w-full flex-col gap-1");
const assistantMessageBodyClass = cn(
  "text-[0.8125rem] leading-5 text-app-foreground",
  "[&_a]:text-ctp-blue [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded-md [&_code]:bg-window-chrome [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.75rem]",
  "**:data-[streamdown='blockquote']:border-ctp-blue/40 **:data-[streamdown='blockquote']:text-app-muted",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/80",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-window-chrome",
  "**:data-[streamdown='heading-1']:text-base",
  "**:data-[streamdown='heading-1']:text-ctp-mauve **:data-[streamdown='heading-2']:text-ctp-mauve **:data-[streamdown='heading-3']:text-ctp-mauve",
  "**:data-[streamdown='inline-code']:text-ctp-green",
);
const reasoningPanelClass = cn("flex flex-col gap-1");
const reasoningToggleClass = cn(
  "flex w-full items-center gap-1.5 text-left text-2xs text-ctp-subtext1 focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
);
const reasoningLabelClass = cn("font-medium tracking-[0.02em] text-ctp-mauve");
const reasoningMetaClass = cn(
  "overflow-hidden text-2xs text-ellipsis whitespace-nowrap text-ctp-subtext1 tabular-nums",
);
const reasoningBodyClass = cn(
  "text-[0.75rem] leading-5 text-app-muted",
  "[&_code]:rounded-md [&_code]:bg-app-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono",
  "**:data-[streamdown='blockquote']:border-ctp-blue/30 **:data-[streamdown='blockquote']:text-ctp-subtext0",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface/80",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/70",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-app-background",
  "**:data-[streamdown='heading-1']:text-sm **:data-[streamdown='heading-2']:text-sm **:data-[streamdown='heading-3']:text-sm",
);
const userMessageRowClass = cn("flex justify-end");
const userMessageBubbleClass = cn(
  "max-w-[88%] rounded-xl bg-window-chrome px-3 py-2 text-[0.8125rem] leading-5 text-app-foreground shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--color-ctp-surface0)_24%,transparent)]",
);
const composerShellClass = cn(
  "mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl bg-app-background p-2",
);
const composerTextareaClass = cn(
  "field-sizing-content min-h-24 w-full resize-none border-0 bg-transparent p-1 text-[0.8125rem] leading-5 text-app-foreground outline-none placeholder:text-ctp-overlay0",
);
const sendButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-badge-background text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
);
const toolCallPanelClass = cn("flex flex-col gap-1");
const toolCallToggleClass = cn(
  "flex w-full items-center gap-1.5 text-left text-2xs text-ctp-subtext1 focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
);
const toolCallLabelClass = cn("font-medium tracking-[0.02em] text-ctp-blue");
const toolCallStatusClass = cn("text-2xs text-ctp-overlay0");
const toolCallBodyClass = cn(
  "flex flex-col gap-2 text-[0.75rem] leading-5 text-app-muted",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-app-background [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-2xs",
);
const toolInputShellClass = cn("flex flex-col gap-2 rounded-lg bg-app-background/70 p-2");
const toolInputTextareaClass = cn(
  "min-h-20 w-full resize-y rounded-md border border-titlebar-border bg-app-background px-2 py-1.5 text-[0.75rem] leading-5 text-app-foreground outline-none placeholder:text-ctp-overlay0",
);
const toolInputSubmitClass = cn(
  "inline-flex self-end rounded-md bg-badge-background px-2.5 py-1 text-2xs font-medium text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
);

function describeToolCallStatus(status: AiChatToolCall["status"]): string {
  switch (status) {
    case "pending":
      return "等待参数";
    case "running":
      return "执行中";
    case "awaiting_user":
      return "等待你的回答";
    case "complete":
      return "已完成";
    case "error":
      return "失败";
  }
}

type AskUserToolArguments = {
  question?: string;
  context?: string;
  placeholder?: string;
};

function formatToolArguments(argumentsText: string): string {
  if (argumentsText.trim() === "") {
    return "{}";
  }

  try {
    return JSON.stringify(JSON.parse(argumentsText), null, 2);
  } catch {
    return argumentsText;
  }
}

function describeAssistantMessageMeta(message: AiChatMessage): string {
  const parts: string[] = [];

  if (message.status === "streaming") {
    const hasRunningTool = message.toolCalls.some((toolCall) => toolCall.status === "running");
    parts.push(
      message.reasoning?.status === "streaming"
        ? "思考中"
        : hasRunningTool
          ? "执行工具中"
          : "流式输出中",
    );
  }

  if (message.toolCalls.length > 0) {
    parts.push(`工具 ${message.toolCalls.length}`);
  }

  if (typeof message.usage?.inputTokens === "number") {
    parts.push(`输入 ${message.usage.inputTokens} tok`);
  }
  if (typeof message.usage?.reasoningTokens === "number") {
    parts.push(`思考 ${message.usage.reasoningTokens} tok`);
  }
  if (typeof message.usage?.outputTokens === "number") {
    parts.push(`输出 ${message.usage.outputTokens} tok`);
  }
  if (typeof message.usage?.totalTokens === "number") {
    parts.push(`总计 ${message.usage.totalTokens} tok`);
  }

  return parts.length > 0 ? parts.join(" · ") : "已完成";
}

function parseAskUserToolArguments(argumentsText: string): AskUserToolArguments | null {
  try {
    const parsed = JSON.parse(argumentsText) as AskUserToolArguments;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function AskUserToolInput({
  toolCall,
  disabled,
  onSubmit,
}: {
  toolCall: AiChatToolCall;
  disabled: boolean;
  onSubmit: (toolCallId: string, text: string) => Promise<boolean>;
}) {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const [draft, setDraft] = useState("");

  if (!args?.question) {
    return null;
  }

  return (
    <div className={toolInputShellClass}>
      <div className="flex flex-col gap-1">
        <p className="text-2xs font-medium text-ctp-subtext0">问题</p>
        <p className="text-[0.75rem] leading-5 text-app-foreground">{args.question}</p>
        {args.context ? <p className="text-2xs text-ctp-subtext1">{args.context}</p> : null}
      </div>

      <textarea
        aria-label="回答工具问题"
        className={toolInputTextareaClass}
        disabled={disabled}
        placeholder={args.placeholder ?? "输入你的回答…"}
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />

      <button
        className={toolInputSubmitClass}
        disabled={disabled || draft.trim() === ""}
        type="button"
        onClick={() => {
          void onSubmit(toolCall.id, draft).then((submitted) => {
            if (submitted) {
              setDraft("");
            }
          });
        }}
      >
        提交回答
      </button>
    </div>
  );
}

function AiToolCallBlock({
  toolCall,
  awaitingToolCallId,
  onSubmitToolResponse,
}: {
  toolCall: AiChatToolCall;
  awaitingToolCallId: string | null;
  onSubmitToolResponse: (toolCallId: string, text: string) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusText = describeToolCallStatus(toolCall.status);
  const isAskUser = toolCall.name === "ask_user";
  const isAwaitingThisTool = awaitingToolCallId === toolCall.id;

  return (
    <section className={toolCallPanelClass}>
      <button
        aria-expanded={expanded}
        className={toolCallToggleClass}
        title={expanded ? "收起工具调用" : "展开工具调用"}
        type="button"
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        <DisclosureChevron expanded={expanded} />
        <span className={toolCallLabelClass}>工具</span>
        <span className="truncate font-mono text-ctp-green">{toolCall.name}</span>
        <span className={toolCallStatusClass}>{statusText}</span>
      </button>

      {expanded ? (
        <div className={toolCallBodyClass}>
          <div>
            <p className="mb-1 text-2xs font-medium text-ctp-subtext0">参数</p>
            <pre>{formatToolArguments(toolCall.argumentsText)}</pre>
          </div>

          {toolCall.status === "running" ? (
            <p className="text-ctp-subtext0">执行工具中...</p>
          ) : null}

          {isAskUser ? (
            <AskUserToolInput
              toolCall={toolCall}
              disabled={!isAwaitingThisTool}
              onSubmit={onSubmitToolResponse}
            />
          ) : null}

          {toolCall.resultText ? (
            <div>
              <p className="mb-1 text-2xs font-medium text-ctp-subtext0">结果</p>
              <pre>{toolCall.resultText}</pre>
            </div>
          ) : null}

          {toolCall.errorMessage ? <p className="text-ctp-red">{toolCall.errorMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function AiReasoningBlock({ reasoning }: { reasoning: AiChatReasoning }) {
  const [expanded, setExpanded] = useState(reasoning.status === "streaming");

  useEffect(() => {
    if (reasoning.status === "streaming") {
      setExpanded(true);
    }
  }, [reasoning.status]);

  const isAnimating = reasoning.status === "streaming";

  return (
    <section className={reasoningPanelClass}>
      <button
        aria-expanded={expanded}
        className={reasoningToggleClass}
        title={expanded ? "收起思维链" : "展开思维链"}
        type="button"
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        <DisclosureChevron expanded={expanded} />
        <span className={reasoningLabelClass}>思考</span>
      </button>

      {expanded ? (
        <div className={reasoningBodyClass}>
          {reasoning.text !== "" ? (
            <MarkdownStream isAnimating={isAnimating}>{reasoning.text}</MarkdownStream>
          ) : (
            <p className="text-ctp-subtext0">...</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function AiMessageBlock({
  message,
  awaitingToolCallId,
  onSubmitToolResponse,
}: {
  message: AiChatMessage;
  awaitingToolCallId: string | null;
  onSubmitToolResponse: (toolCallId: string, text: string) => Promise<boolean>;
}) {
  if (message.role === "user") {
    return (
      <div className={userMessageRowClass}>
        <div className={userMessageBubbleClass}>
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  const isStreaming = message.status === "streaming";
  const hasRunningTool = message.toolCalls.some((toolCall) => toolCall.status === "running");
  const metaText = describeAssistantMessageMeta(message);

  return (
    <article className={assistantMessageBlockClass}>
      {message.reasoning ? <AiReasoningBlock reasoning={message.reasoning} /> : null}

      {message.toolCalls.map((toolCall) => (
        <AiToolCallBlock
          key={toolCall.id}
          awaitingToolCallId={awaitingToolCallId}
          toolCall={toolCall}
          onSubmitToolResponse={onSubmitToolResponse}
        />
      ))}

      <div className={assistantMessageBodyClass}>
        {message.text !== "" ? (
          <MarkdownStream isAnimating={isStreaming}>{message.text}</MarkdownStream>
        ) : (
          <p className="text-ctp-subtext0">
            {message.reasoning || message.toolCalls.length > 0
              ? hasRunningTool
                ? "执行工具中..."
                : "..."
              : "思考中..."}
          </p>
        )}
      </div>

      <p className={reasoningMetaClass} title={metaText}>
        {metaText}
      </p>
    </article>
  );
}

export function AuxiliaryPanel() {
  const {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    submitToolResponse,
    resetConversation,
  } = useAiChatState();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRestoreComposerFocusRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [snapshot.messages, snapshot.pending]);

  useEffect(() => {
    if (loading || snapshot.pending || !shouldRestoreComposerFocusRef.current) {
      return;
    }

    composerRef.current?.focus();
    shouldRestoreComposerFocusRef.current = false;
  }, [loading, snapshot.pending]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const submitted = await sendMessage(draft);
    if (submitted) {
      shouldRestoreComposerFocusRef.current = true;
      setDraft("");
    }
  }, [draft, sendMessage]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleSendClick = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const errorMessage = subscriptionError ?? snapshot.errorMessage;

  return (
    <>
      <SidebarHeaderActions>
        <button
          aria-label="清空对话"
          className={sidebarHeaderActionClass}
          disabled={snapshot.pending}
          title="清空对话"
          type="button"
          onClick={() => {
            void resetConversation();
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--clear-all] text-sm" />
        </button>
      </SidebarHeaderActions>

      <ScrollArea className="min-h-0 flex-1" fill>
        <div className={cn(panelSectionClass, conversationRailClass, "text-sm")}>
          {errorMessage ? (
            <div className="rounded-xl border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0">
              正在连接 AI 会话…
            </div>
          ) : null}

          {!loading && snapshot.messages.length === 0 ? (
            <div className="px-1 py-4 text-xs text-ctp-subtext0">开始一段对话。</div>
          ) : null}

          {snapshot.messages.map((message) => (
            <AiMessageBlock
              key={message.id}
              awaitingToolCallId={snapshot.awaitingToolCallId}
              message={message}
              onSubmitToolResponse={submitToolResponse}
            />
          ))}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0"
            ref={endRef}
          />
        </div>
      </ScrollArea>

      <footer className="shrink-0 p-3">
        <form className={composerShellClass} onSubmit={handleSubmit}>
          <textarea
            aria-label="消息输入"
            className={composerTextareaClass}
            ref={composerRef}
            placeholder="输入章节目标、修改要求，或直接粘贴长段正文…"
            rows={6}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleComposerKeyDown}
            disabled={loading || snapshot.pending || snapshot.awaitingToolCallId !== null}
          />

          <div className="flex justify-end">
            <button
              aria-label="发送"
              className={sendButtonClass}
              disabled={
                loading ||
                snapshot.pending ||
                snapshot.awaitingToolCallId !== null ||
                draft.trim() === ""
              }
              title="发送"
              type="button"
              onClick={handleSendClick}
            >
              <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
            </button>
          </div>
        </form>
      </footer>
    </>
  );
}
