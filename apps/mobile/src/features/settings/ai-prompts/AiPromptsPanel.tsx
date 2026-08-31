import type { AiPromptConfigPublic } from "@novelevolver/domain/settings/ai-settings";
import { useFocusEffect, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { AiPromptsStackParamList } from "../../../app/navigation-types";
import { getMobileSettings } from "../../../shared/settings/session";
import { SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import { setSettingsDirty, useSettingsFormDirty } from "../settings-leave-guard";
import { useSettingsLeaveGuard } from "../use-settings-leave-guard";

export function AiPromptsList() {
  const navigation = useNavigation<NativeStackNavigationProp<AiPromptsStackParamList>>();
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
      <ScrollView style={settingsStyles.list}>
        {snapshot.prompts.length === 0 ? (
          <Text style={settingsStyles.empty}>还没有自定义提示词。</Text>
        ) : (
          snapshot.prompts.map((prompt) => (
            <Pressable
              key={prompt.id}
              style={settingsStyles.row}
              onPress={() => {
                navigation.navigate("PromptEditor", { id: prompt.id });
              }}
            >
              <Text style={settingsStyles.rowTitle}>{prompt.title}</Text>
              <Text style={settingsStyles.rowMeta}>/{prompt.slug}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

type PromptEditorProps = StaticScreenProps<{ id?: string }>;

export function PromptEditor({ route }: PromptEditorProps) {
  useSettingsLeaveGuard({ editor: true });
  const navigation = useNavigation();
  const [error, setError] = useState<string | null>(null);
  const snapshot = getMobileSettings().prompts.getSnapshot();
  const initial =
    route.params.id == null
      ? null
      : (snapshot.prompts.find((prompt) => prompt.id === route.params.id) ?? null);

  return (
    <PromptForm
      initial={initial}
      error={error}
      onError={setError}
      onSaved={() => {
        navigation.goBack();
      }}
    />
  );
}

type PromptFormProps = {
  initial: AiPromptConfigPublic | null;
  error: string | null;
  onError: (message: string | null) => void;
  onSaved: () => void;
};

function PromptForm({ initial, error, onError, onSaved }: PromptFormProps) {
  const session = getMobileSettings();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const dirty =
    title !== (initial?.title ?? "") ||
    slug !== (initial?.slug ?? "") ||
    prompt !== (initial?.prompt ?? "");

  useSettingsFormDirty(dirty);

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
        />
        <SettingsTextField label="内容" value={prompt} onChangeText={setPrompt} multiline />
        <Pressable
          style={settingsStyles.optionSelected}
          onPress={() => {
            try {
              session.upsertPrompt({
                id: initial?.id,
                title,
                slug,
                prompt,
              });
              setSettingsDirty(false);
              onSaved();
            } catch (caught) {
              onError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        >
          <Text style={settingsStyles.headerActionLabel}>保存</Text>
        </Pressable>
        {initial ? (
          <Pressable
            onPress={() => {
              try {
                session.removePrompt(initial.id);
                setSettingsDirty(false);
                onSaved();
              } catch (caught) {
                onError(caught instanceof Error ? caught.message : String(caught));
              }
            }}
          >
            <Text style={settingsStyles.headerDangerLabel}>删除提示词</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
