import type { AiChatToolCall } from "@novelevolver/domain/ai";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { aiStyles } from "./ai-chrome";
import { presentMobileToolCall } from "./mobile-tool-presenter";

type CardProps = { toolCall: AiChatToolCall };

export function AiSubagentCard({ toolCall }: CardProps) {
  const [open, setOpen] = useState(toolCall.status !== "complete");
  const [reportOpen, setReportOpen] = useState(false);
  const view = toolCall.view?.kind === "subagent" ? toolCall.view : null;
  const summary = view
    ? `${view.agentName} · ${view.phase}`
    : presentMobileToolCall(toolCall).subject;
  return (
    <View style={aiStyles.elevatedCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? "收起子代理" : "展开子代理"}
        onPress={() => setOpen((value) => !value)}
      >
        <View style={aiStyles.workHeader}>
          <Text style={aiStyles.timelineIcon}>◎</Text>
          <Text style={aiStyles.partTitle}>子代理</Text>
          <Text numberOfLines={1} style={aiStyles.workSummary}>
            {summary}
          </Text>
          <Text style={aiStyles.disclosure}>{open ? "⌄" : "›"}</Text>
        </View>
      </Pressable>
      {!open && view?.report ? (
        <Text numberOfLines={1} style={aiStyles.detailText}>
          {view.report}
        </Text>
      ) : null}
      {open ? (
        <View style={aiStyles.cardBody}>
          {view ? (
            <>
              <Text style={aiStyles.messageText}>{view.task}</Text>
              {view.constraints ? (
                <Text style={aiStyles.detailText}>约束：{view.constraints}</Text>
              ) : null}
              <Text style={aiStyles.metaText}>
                第 {view.round}/{view.maxRounds} 轮 · {view.steps.length} 步 ·{" "}
                {view.artifacts.wrote ? "已写回" : "只读"}
              </Text>
              {view.steps.map((step) => (
                <Text
                  key={step.id}
                  style={step.status === "error" ? aiStyles.errorText : aiStyles.detailText}
                >
                  {step.name}
                  {step.subject ? ` · ${step.subject}` : ""}
                  {step.outcome ? ` · ${step.outcome}` : ""}
                </Text>
              ))}
              {view.report ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setReportOpen((value) => !value)}
                  >
                    <Text style={aiStyles.partTitle}>报告 {reportOpen ? "⌄" : "›"}</Text>
                  </Pressable>
                  {reportOpen ? <Text style={aiStyles.messageText}>{view.report}</Text> : null}
                </>
              ) : null}
            </>
          ) : (
            <Text style={aiStyles.detailText}>子代理执行中…</Text>
          )}
          {toolCall.errorMessage ? (
            <Text style={aiStyles.errorText}>{toolCall.errorMessage}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function AiAskUserCard({ toolCall }: CardProps) {
  const view = toolCall.view?.kind === "ask_user" ? toolCall.view : null;
  if (!view)
    return (
      <View style={aiStyles.elevatedCard}>
        <Text style={aiStyles.partTitle}>询问用户</Text>
        <Text style={aiStyles.messageText}>{toolCall.argumentsText}</Text>
      </View>
    );
  const status =
    toolCall.status === "awaiting_user"
      ? "等待回答"
      : toolCall.status === "error"
        ? "失败"
        : toolCall.status === "complete"
          ? view.answer
            ? "已回答"
            : "已取消"
          : "进行中";
  return (
    <View style={aiStyles.elevatedCard}>
      <View style={aiStyles.workHeader}>
        <Text style={aiStyles.timelineIcon}>?</Text>
        <Text style={aiStyles.partTitle}>询问用户</Text>
        <Text style={aiStyles.metaText}>{status}</Text>
      </View>
      <View style={aiStyles.cardBody}>
        <Text style={aiStyles.messageText}>{view.question}</Text>
        {view.context ? <Text style={aiStyles.detailText}>{view.context}</Text> : null}
        {!view.answer ? (
          view.choices?.map((choice) => (
            <View key={choice.title} style={aiStyles.choiceRow}>
              <Text style={aiStyles.messageText}>{choice.title}</Text>
              {choice.description ? (
                <Text style={aiStyles.detailText}>{choice.description}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={aiStyles.detailText}>回答：{view.answer}</Text>
        )}
        {toolCall.errorMessage ? (
          <Text style={aiStyles.errorText}>{toolCall.errorMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}
