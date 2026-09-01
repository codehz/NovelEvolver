import type { AiChatOpenInteraction } from "@novelevolver/domain/ai";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";

type AiAskUserBarProps = {
  interactions: AiChatOpenInteraction[];
  onSubmit: (id: string, text: string) => void;
  onCancel: (id: string) => void;
};

export function AiAskUserBar({ interactions, onSubmit, onCancel }: AiAskUserBarProps) {
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const current = interactions[Math.min(index, interactions.length - 1)];
  if (current === undefined) {
    return null;
  }

  const submit = () => {
    const text = draft.trim();
    if (text === "") {
      return;
    }
    onSubmit(current.id, text);
    setDraft("");
  };

  return (
    <View style={aiStyles.composer}>
      {interactions.length > 1 ? (
        <View style={aiStyles.rowActions}>
          <Pressable
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
      <Text style={aiStyles.partTitle}>{current.prompt}</Text>
      <Text style={aiStyles.messageText}>{current.question}</Text>
      {current.context ? <Text style={aiStyles.metaText}>{current.context}</Text> : null}
      {current.choices?.map((choice) => (
        <Pressable
          key={choice.title}
          style={[aiStyles.choiceRow, draft === choice.title ? aiStyles.choiceRowSelected : null]}
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
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={current.placeholder ?? "输入回答…"}
        placeholderTextColor={color.placeholder}
        style={aiStyles.input}
      />
      <View style={aiStyles.rowActions}>
        <Pressable onPress={() => onCancel(current.id)}>
          <Text style={aiStyles.dangerLabel}>跳过此问</Text>
        </Pressable>
        <Pressable
          style={[aiStyles.sendButton, draft.trim() === "" ? aiStyles.sendButtonDisabled : null]}
          disabled={draft.trim() === ""}
          onPress={submit}
        >
          <Text style={aiStyles.sendLabel}>提交</Text>
        </Pressable>
      </View>
    </View>
  );
}
