import type { AssistantWorkStep } from "@novelevolver/domain/ai";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import IconChevronDown from "~icons/codicon/chevron-down";
import IconChevronRight from "~icons/codicon/chevron-right";
import IconCommentDiscussion from "~icons/codicon/comment-discussion";
import IconDiff from "~icons/codicon/diff";
import IconEdit from "~icons/codicon/edit";
import IconEye from "~icons/codicon/eye";
import IconHistory from "~icons/codicon/history";
import IconLightbulb from "~icons/codicon/lightbulb";
import IconListTree from "~icons/codicon/list-tree";
import IconSearch from "~icons/codicon/search";
import IconSparkle from "~icons/codicon/sparkle";
import IconSymbolEvent from "~icons/codicon/symbol-event";
import IconTools from "~icons/codicon/tools";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";
import {
  describeMobileWork,
  type MobileToolIcon,
  presentMobileToolCall,
} from "./mobile-tool-presenter";
import { useAutoCollapseExpand } from "./use-auto-collapse-expand";

type AiWorkBlockProps = { id: string; steps: readonly AssistantWorkStep[]; keepExpanded: boolean };

function ToolIcon({ name, color: iconColor }: { name: MobileToolIcon; color: string }) {
  const props = { width: 16, height: 16, color: iconColor };
  switch (name) {
    case "search":
      return <IconSearch {...props} />;
    case "eye":
      return <IconEye {...props} />;
    case "list-tree":
      return <IconListTree {...props} />;
    case "edit":
      return <IconEdit {...props} />;
    case "diff":
      return <IconDiff {...props} />;
    case "history":
      return <IconHistory {...props} />;
    case "sparkle":
      return <IconSparkle {...props} />;
    case "comment-discussion":
      return <IconCommentDiscussion {...props} />;
    case "symbol-event":
      return <IconSymbolEvent {...props} />;
    default:
      return <IconTools {...props} />;
  }
}

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
  }, [step.status, step.type]);

  const body = (
    <View style={[aiStyles.timelineRowBody, !last ? aiStyles.timelineRowSpacing : null]}>
      <View style={aiStyles.timelineRowHeader}>
        {step.type === "reasoning" ? (
          <IconLightbulb width={16} height={16} color={color.accent} />
        ) : (
          <ToolIcon name={tool!.icon} color={error ? color.error : color.accent} />
        )}
        <Text style={aiStyles.timelineLabel}>
          {step.type === "reasoning" ? "思考" : tool!.label}
        </Text>
        {step.type === "tool_call" ? (
          <Text numberOfLines={1} style={aiStyles.timelineSubject}>
            {tool!.subject}
          </Text>
        ) : null}
        {live ? <Text style={aiStyles.timelineStatus}>{tool?.indicator ?? "进行中"}</Text> : null}
        {hasDetail ? (
          open ? (
            <IconChevronDown width={16} height={16} color={color.muted} />
          ) : (
            <IconChevronRight width={16} height={16} color={color.muted} />
          )
        ) : null}
      </View>
      {open && hasDetail ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={aiStyles.timelineDetail}
        >
          {step.type === "reasoning" ? (
            <Text style={aiStyles.messageText}>{step.text || "…"}</Text>
          ) : (
            tool!.detail.map((line, index) => (
              <Text key={`${line}-${index}`} style={aiStyles.detailText}>
                {line}
              </Text>
            ))
          )}
        </Animated.View>
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
  const { open, onOpenChange } = useAutoCollapseExpand({ isLive: keepExpanded, resetKey: id });

  return (
    <View style={aiStyles.workBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? "收起工作步骤" : "展开工作步骤"}
        onPress={() => onOpenChange(!open)}
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
          {open ? (
            <IconChevronDown width={16} height={16} color={color.muted} />
          ) : (
            <IconChevronRight width={16} height={16} color={color.muted} />
          )}
        </View>
      </Pressable>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={aiStyles.timeline}
        >
          {steps.map((step, index) => (
            <WorkRow key={step.id} step={step} last={index === steps.length - 1} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}
