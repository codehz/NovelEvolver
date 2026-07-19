import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { parseAskUserToolArguments } from "../tools/ask-user-prompt";
import { maybeErrorTechnicalFields } from "../tools/presenter-detail";
import { toolActionLabel, toolIcon, truncateText } from "../tools/presenter-format";
import { getString, parseObject } from "../tools/presenter-parse";
import {
  elevatedCardBodyClass,
  elevatedCardHeaderClass,
  elevatedCardPanelClass,
  toolCallErrorMessageClass,
  toolCallIconClass,
  toolCallIconErrorClass,
  toolCallIconRunningClass,
  toolCallQuestionClass,
} from "../ui/ai-chat-chrome";

type AiAskUserCardProps = {
  toolCall: AiChatToolCall;
};

/**
 * Elevated ask_user card — never aggregated into Work.
 * Interaction stays in the bottom AskUserComposerPanel via openInteractions.
 */
export function AiAskUserCard({ toolCall }: AiAskUserCardProps): ReactNode {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const question = args?.question ?? "等待补充信息";
  const answer = getString(parseObject(toolCall.resultText), "answer");
  const selectedChoice = args?.choices?.find((choice) => choice.title === answer);
  const isError = toolCall.status === "error";
  const isAwaiting = toolCall.status === "awaiting_user";
  const isLive =
    toolCall.status === "pending" ||
    toolCall.status === "running" ||
    toolCall.status === "awaiting_user";
  const showChoices = !answer && (args?.choices?.length ?? 0) > 0;

  const iconClass = cn(
    isError ? toolCallIconErrorClass : isLive ? toolCallIconRunningClass : toolCallIconClass,
    isLive && "animate-pulse",
  );

  const statusLabel =
    toolCall.status === "complete"
      ? "已回答"
      : isAwaiting
        ? "等待回答"
        : isError
          ? "失败"
          : isLive
            ? "进行中"
            : null;

  return (
    <article className={elevatedCardPanelClass} data-assistant-segment="ask_user">
      <div className={elevatedCardHeaderClass}>
        <span aria-hidden="true" className={cn(toolIcon("ask_user"), iconClass)} />
        <span className="shrink-0 font-medium tracking-[0.02em] text-ctp-subtext1">
          {toolActionLabel("ask_user")}
        </span>
        <span className="min-w-0 flex-1 truncate text-ctp-subtext0">
          {truncateText(question, 64)}
        </span>
        {statusLabel ? (
          <span
            className={cn(
              "shrink-0 text-2xs tabular-nums",
              isError ? "text-ctp-red" : "text-ctp-overlay0",
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className={elevatedCardBodyClass}>
        <div className="flex flex-col gap-1">
          <p className="wrap-break-word text-app-foreground">{question}</p>
          {args?.context ? (
            <p className="text-2xs wrap-break-word text-ctp-subtext0">{args.context}</p>
          ) : null}

          {showChoices ? (
            <ul className="flex flex-col gap-1">
              {args!.choices!.map((choice) => (
                <li
                  key={`${choice.title}:${choice.description ?? ""}`}
                  className="rounded-sm border border-titlebar-border/50 bg-app-background/40 px-2 py-1 text-chat-meta text-app-muted"
                >
                  <span className="text-app-foreground">{choice.title}</span>
                  {choice.description ? (
                    <span className="text-ctp-subtext0"> — {choice.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {answer ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-2xs text-ctp-overlay0">{selectedChoice ? "已选" : "回答"}</span>
              <p className="wrap-break-word text-app-foreground">
                {selectedChoice ? (
                  <>
                    {selectedChoice.title}
                    {selectedChoice.description ? (
                      <span className="text-ctp-subtext0"> — {selectedChoice.description}</span>
                    ) : null}
                  </>
                ) : (
                  answer
                )}
              </p>
            </div>
          ) : null}

          {isAwaiting ? <p className={toolCallQuestionClass}>请在底部输入框回答。</p> : null}

          {toolCall.errorMessage ? (
            <p className={toolCallErrorMessageClass}>{toolCall.errorMessage}</p>
          ) : null}

          {isError
            ? maybeErrorTechnicalFields(toolCall.status, [{ label: "工具", value: "ask_user" }])
            : null}
        </div>
      </div>
    </article>
  );
}
