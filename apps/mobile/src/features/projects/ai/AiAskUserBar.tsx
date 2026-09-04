import type { AiChatOpenInteraction } from "@novelevolver/domain/ai";
import { useEffect, useState } from "react";
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

function isDraftReady(draft: string): boolean {
  return draft.trim() !== "";
}

function tabLabel(input: AiChatOpenInteraction, index: number): string {
  const prompt = input.prompt.trim() || input.question.trim();
  return prompt === "" ? `问题 ${index + 1}` : prompt;
}

export function AiAskUserBar({ interactions, onSubmit, onCancel }: AiAskUserBarProps) {
  const { height } = useWindowDimensions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftsById, setDraftsById] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = interactions.map((input) => input.id);
    if (ids.length === 0) {
      setActiveId(null);
      setDraftsById({});
      return;
    }
    setActiveId((current) => (current !== null && ids.includes(current) ? current : ids[0]!));
    setDraftsById((current) => {
      const stale = Object.keys(current).some((id) => !ids.includes(id));
      if (!stale) {
        return current;
      }
      const next: Record<string, string> = {};
      for (const id of ids) {
        const draft = current[id];
        if (draft != null) {
          next[id] = draft;
        }
      }
      return next;
    });
  }, [interactions]);

  const current =
    activeId === null
      ? undefined
      : (interactions.find((input) => input.id === activeId) ?? interactions[0]);
  if (current === undefined) {
    return null;
  }

  const activeDraft = draftsById[current.id] ?? "";
  const allReady = interactions.every((input) => isDraftReady(draftsById[input.id] ?? ""));
  const promptMaxHeight = Math.round(height * 0.42);
  const showTabs = interactions.length > 1;

  const setActiveDraft = (draft: string) => {
    setDraftsById((currentDrafts) => ({ ...currentDrafts, [current.id]: draft }));
  };

  const submit = () => {
    if (!allReady) {
      return;
    }
    for (const input of interactions) {
      const text = (draftsById[input.id] ?? "").trim();
      if (input.kind === "ask_user" && text !== "") {
        onSubmit(input.id, text);
      }
    }
  };

  return (
    <KeyboardGestureArea interpolator="ios" enableSwipeToDismiss>
      <View style={aiStyles.composer}>
        {showTabs ? (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={aiStyles.askUserTabsContent}
          >
            {interactions.map((input, index) => {
              const selected = input.id === current.id;
              const ready = isDraftReady(draftsById[input.id] ?? "");
              return (
                <Pressable
                  key={input.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected, disabled: false }}
                  accessibilityLabel={tabLabel(input, index)}
                  style={[aiStyles.askUserTab, selected ? aiStyles.askUserTabActive : null]}
                  onPress={() => {
                    setActiveId(input.id);
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      aiStyles.askUserTabLabel,
                      ready ? aiStyles.askUserTabLabelReady : null,
                      selected ? aiStyles.askUserTabLabelActive : null,
                    ]}
                  >
                    {tabLabel(input, index)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
              accessibilityState={{ selected: activeDraft === choice.title }}
              style={[
                aiStyles.choiceRow,
                activeDraft === choice.title ? aiStyles.choiceRowSelected : null,
              ]}
              onPress={() => {
                setActiveDraft(choice.title);
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
          value={activeDraft}
          onChangeText={setActiveDraft}
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
            accessibilityLabel={showTabs ? "提交全部" : "提交"}
            style={[aiStyles.sendButton, allReady ? null : aiStyles.sendButtonDisabled]}
            disabled={!allReady}
            onPress={submit}
          >
            <IconArrowUp width={18} height={18} color={color.primaryForeground} />
          </Pressable>
        </View>
      </View>
    </KeyboardGestureArea>
  );
}
