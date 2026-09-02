import type { AiPromptConfigPublic } from "@novelevolver/domain/settings/ai-settings";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getMobileSettings } from "../../../shared/settings/session";
import { SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import type { SettingsDetailActionChange } from "../settings-detail-actions";
import { useSettingsDetailActions } from "../settings-detail-actions";
import { setSettingsDirty, useSettingsFormDirty } from "../settings-leave-guard";
import { useSettingsLeaveGuard } from "../use-settings-leave-guard";

type AiPromptsListProps = {
  selectedId?: string;
  adding: boolean;
  onOpen: (id: string) => void;
  onAdd: () => void;
};

export function AiPromptsList({ selectedId, adding, onOpen, onAdd }: AiPromptsListProps) {
  const [tick, setTick] = useState(0);
  const snapshot = getMobileSettings().prompts.getSnapshot();
  void tick;

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  return (
    <View style={settingsStyles.detail}>
      <ScrollView
        style={settingsStyles.list}
        contentContainerStyle={settingsStyles.cardListContent}
      >
        {snapshot.prompts.length === 0 ? (
          <Text style={settingsStyles.empty}>还没有自定义提示词。</Text>
        ) : (
          snapshot.prompts.map((prompt) => (
            <Pressable
              key={prompt.id}
              style={[
                settingsStyles.card,
                settingsStyles.cardItem,
                selectedId === prompt.id && settingsStyles.cardSelected,
              ]}
              onPress={() => {
                onOpen(prompt.id);
              }}
            >
              <Text style={settingsStyles.rowTitle}>{prompt.title}</Text>
              <Text style={settingsStyles.technical}>/{prompt.slug}</Text>
            </Pressable>
          ))
        )}
        <Pressable
          style={[settingsStyles.addCardButton, adding && settingsStyles.cardSelected]}
          onPress={onAdd}
        >
          <Text style={settingsStyles.addCardLabel}>添加提示词</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

type PromptEditorProps = {
  id?: string;
  onSaved: () => void;
  onActionsChange: SettingsDetailActionChange;
};

export function PromptEditor({ id, onSaved, onActionsChange }: PromptEditorProps) {
  useSettingsLeaveGuard({ editor: true });
  const [error, setError] = useState<string | null>(null);
  const snapshot = getMobileSettings().prompts.getSnapshot();
  const initial = id == null ? null : (snapshot.prompts.find((prompt) => prompt.id === id) ?? null);

  return (
    <PromptForm
      initial={initial}
      error={error}
      onError={setError}
      onSaved={() => {
        onSaved();
      }}
      onActionsChange={onActionsChange}
    />
  );
}

type PromptFormProps = {
  initial: AiPromptConfigPublic | null;
  error: string | null;
  onError: (message: string | null) => void;
  onSaved: () => void;
  onActionsChange: SettingsDetailActionChange;
};

function PromptForm({ initial, error, onError, onSaved, onActionsChange }: PromptFormProps) {
  const session = getMobileSettings();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const dirty =
    title !== (initial?.title ?? "") ||
    slug !== (initial?.slug ?? "") ||
    prompt !== (initial?.prompt ?? "");

  useSettingsFormDirty(dirty);

  const save = () => {
    try {
      session.upsertPrompt({ id: initial?.id, title, slug, prompt });
      setSettingsDirty(false);
      onSaved();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  const remove = initial
    ? () => {
        try {
          session.removePrompt(initial.id);
          setSettingsDirty(false);
          onSaved();
        } catch (caught) {
          onError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    : undefined;
  useSettingsDetailActions(onActionsChange, { save, remove });

  return (
    <View style={settingsStyles.detail}>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ScrollView contentContainerStyle={settingsStyles.form}>
        <SettingsTextField label="标题" value={title} onChangeText={setTitle} />
        <SettingsTextField
          label="调用名"
          hint="小写字母开头，仅含 a-z、0-9、_、-。"
          value={slug}
          onChangeText={setSlug}
          monospace
        />
        <SettingsTextField
          label="内容"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          markdown
        />
      </ScrollView>
    </View>
  );
}
