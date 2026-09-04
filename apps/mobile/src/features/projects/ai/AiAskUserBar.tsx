import type { AiChatOpenInteraction } from "@novelevolver/domain/ai";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
import IconArrowUp from "~icons/codicon/arrow-up";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";

type AiAskUserBarProps = {
  interactions: AiChatOpenInteraction[];
  onSubmit: (id: string, text: string) => void;
  onCancel: (id: string) => void;
};

export function AiAskUserBar({ interactions, onSubmit, onCancel }: AiAskUserBarProps) {
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const current = interactions[Math.min(index, interactions.length - 1)];
  if (current === undefined) {
    return null;
  }

  const canSubmit = draft.trim() !== "";
  const promptMaxHeight = Math.round(height * 0.42);

  const submit = () => {
    const text = draft.trim();
    if (text === "") {
      return;
    }
    onSubmit(current.id, text);
    setDraft("");
  };

  return (
    <KeyboardGestureArea interpolator="ios" enableSwipeToDismiss>
      <View style={aiStyles.composer}>
        {interactions.length > 1 ? (
          <View style={aiStyles.askUserPager}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="上一问"
              disabled={index <= 0}
              onPress={() => {
                setIndex((value) => Math.max(0, value - 1));
                setDraft("");
              }}
            >
              <Text style={aiStyles.actionLabel}>上一问</Text>
            </Pressable>
            <Text style={aiStyles.metaText}>
              {Math.min(index, interactions.length - 1) + 1}/{interactions.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="下一问"
              disabled={index >= interactions.length - 1}
              onPress={() => {
                setIndex((value) => Math.min(interactions.length - 1, value + 1));
                setDraft("");
              }}
            >
              <Text style={aiStyles.actionLabel}>下一问</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{ maxHeight: promptMaxHeight }}
          contentContainerStyle={aiStyles.askUserPrompt}
        >
          <Text style={aiStyles.askUserQuestion}>{current.question}</Text>
          {current.context ? <Text style={aiStyles.askUserContext}>{current.context}</Text> : null}
          {current.choices?.map((choice) => (
            <Pressable
              key={choice.title}
              accessibilityRole="button"
              accessibilityState={{ selected: draft === choice.title }}
              style={[
                aiStyles.choiceRow,
                draft === choice.title ? aiStyles.choiceRowSelected : null,
              ]}
              onPress={() => {
                setDraft(choice.title);
              }}
            >
              <Text style={aiStyles.listRowTitle}>{choice.title}</Text>
              {choice.description ? (
                <Text style={aiStyles.listRowMeta}>{choice.description}</Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={current.placeholder ?? "输入回答…"}
          placeholderTextColor={color.placeholder}
          cursorColor={color.accent}
          selectionColor={color.accent}
          multiline
          style={aiStyles.askUserInput}
        />
        <View style={aiStyles.composerToolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="跳过此问"
            onPress={() => onCancel(current.id)}
          >
            <Text style={aiStyles.dangerLabel}>跳过此问</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="提交"
            style={[aiStyles.sendButton, canSubmit ? null : aiStyles.sendButtonDisabled]}
            disabled={!canSubmit}
            onPress={submit}
          >
            <IconArrowUp width={18} height={18} color={color.primaryForeground} />
          </Pressable>
        </View>
      </View>
    </KeyboardGestureArea>
  );
}
