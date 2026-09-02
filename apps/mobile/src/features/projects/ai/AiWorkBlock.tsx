import type { AssistantWorkStep } from "@novelevolver/domain/ai";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { aiStyles } from "./ai-chrome";
import { describeMobileWork, presentMobileToolCall } from "./mobile-tool-presenter";

type AiWorkBlockProps = { id: string; steps: readonly AssistantWorkStep[]; keepExpanded: boolean };

function WorkRow({ step, last }: { step: AssistantWorkStep; last: boolean }) {
  const [open, setOpen] = useState(step.type === "reasoning" && step.status === "streaming");
  const live =
    step.type === "reasoning"
      ? step.status === "streaming"
      : step.status === "pending" || step.status === "running" || step.status === "awaiting_user";
  const error = step.type === "tool_call" && step.status === "error";
  const tool = step.type === "tool_call" ? presentMobileToolCall(step) : null;
  const hasDetail = step.type === "reasoning" ? step.text !== "" : tool!.detail.length > 0;

  useEffect(() => {
    if (step.type === "reasoning" && step.status === "streaming") setOpen(true);
  }, [step]);

  const body = (
    <View style={aiStyles.timelineRowBody}>
      <View style={aiStyles.timelineRowHeader}>
        <Text
          style={[
            aiStyles.timelineIcon,
            live && aiStyles.timelineIconLive,
            error && aiStyles.timelineIconError,
          ]}
        >
          {step.type === "reasoning" ? "…" : tool!.icon}
        </Text>
        <Text style={aiStyles.timelineLabel}>
          {step.type === "reasoning" ? "思考" : tool!.label}
        </Text>
        {step.type === "tool_call" ? (
          <Text style={aiStyles.timelineSubject}>{tool!.subject}</Text>
        ) : null}
        {live ? <Text style={aiStyles.timelineStatus}>进行中</Text> : null}
        {hasDetail ? <Text style={aiStyles.disclosure}>{open ? "⌄" : "›"}</Text> : null}
      </View>
      {open && hasDetail ? (
        <View style={aiStyles.timelineDetail}>
          {step.type === "reasoning" ? (
            <Text style={aiStyles.messageText}>{step.text || "…"}</Text>
          ) : (
            tool!.detail.map((line, index) => (
              <Text key={`${line}-${index}`} style={aiStyles.detailText}>
                {line}
              </Text>
            ))
          )}
        </View>
      ) : null}
      {!last ? <View style={aiStyles.timelineLine} /> : null}
    </View>
  );

  return hasDetail ? (
    <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function AiWorkBlock({ id, steps, keepExpanded }: AiWorkBlockProps) {
  const [open, setOpen] = useState(keepExpanded);
  const [wasLive, setWasLive] = useState(keepExpanded);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (keepExpanded && !wasLive) {
      setOpen(true);
      setPinned(false);
    } else if (!keepExpanded && wasLive && !pinned) {
      setOpen(false);
    }
    setWasLive(keepExpanded);
  }, [id, keepExpanded, pinned, wasLive]);

  return (
    <View style={aiStyles.workBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? "收起工作步骤" : "展开工作步骤"}
        onPress={() => {
          setOpen((value) => !value);
          setPinned(!open);
        }}
      >
        <View style={aiStyles.workHeader}>
          <Text style={aiStyles.partTitle}>工作</Text>
          <Text style={aiStyles.workSummary}>
            {keepExpanded &&
            !steps.some((step) =>
              step.type === "reasoning"
                ? step.status === "streaming"
                : step.status === "pending" ||
                  step.status === "running" ||
                  step.status === "awaiting_user",
            )
              ? "进行中"
              : describeMobileWork(steps)}
          </Text>
          <Text style={aiStyles.disclosure}>{open ? "⌄" : "›"}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={aiStyles.timeline}>
          {steps.map((step, index) => (
            <WorkRow key={step.id} step={step} last={index === steps.length - 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
