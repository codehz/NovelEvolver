import type { AiPromptConfigPublic } from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getMobileSettings } from "../../../shared/settings/session";
import { SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import { requestSettingsLeave, setSettingsDirty } from "../settings-leave-guard";

type Editor = { type: "closed" } | { type: "create" } | { type: "edit"; id: string };

export function AiPromptsPanel() {
  const [tick, setTick] = useState(0);
  const [editor, setEditor] = useState<Editor>({ type: "closed" });
  const [error, setError] = useState<string | null>(null);
  const snapshot = getMobileSettings().prompts.getSnapshot();
  void tick;

  const openEditor = async (next: Editor) => {
    if (!(await requestSettingsLeave())) {
      return;
    }
    setError(null);
    setEditor(next);
  };

  if (editor.type !== "closed") {
    const initial =
      editor.type === "edit" ? snapshot.prompts.find((prompt) => prompt.id === editor.id) : null;
    return (
      <PromptForm
        initial={initial ?? null}
        error={error}
        onBack={() => {
          void openEditor({ type: "closed" });
        }}
        onError={setError}
        onSaved={() => {
          setError(null);
          setEditor({ type: "closed" });
          setTick((value) => value + 1);
        }}
      />
    );
  }

  return (
    <View style={settingsStyles.detail}>
      <View style={settingsStyles.header}>
        <Text style={settingsStyles.headerTitle}>AI 提示词</Text>
        <Pressable
          style={settingsStyles.headerAction}
          onPress={() => {
            void openEditor({ type: "create" });
          }}
        >
          <Text style={settingsStyles.headerActionLabel}>添加</Text>
        </Pressable>
      </View>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ScrollView style={settingsStyles.list}>
        {snapshot.prompts.length === 0 ? (
          <Text style={settingsStyles.empty}>还没有自定义提示词。</Text>
        ) : (
          snapshot.prompts.map((prompt) => (
            <Pressable
              key={prompt.id}
              style={settingsStyles.row}
              onPress={() => {
                void openEditor({ type: "edit", id: prompt.id });
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

type PromptFormProps = {
  initial: AiPromptConfigPublic | null;
  error: string | null;
  onBack: () => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
};

function PromptForm({ initial, error, onBack, onError, onSaved }: PromptFormProps) {
  const session = getMobileSettings();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");

  useEffect(() => {
    setSettingsDirty(true);
    return () => {
      setSettingsDirty(false);
    };
  }, []);

  return (
    <View style={settingsStyles.detail}>
      <View style={settingsStyles.header}>
        <Pressable style={settingsStyles.headerAction} onPress={onBack}>
          <Text style={settingsStyles.headerActionLabel}>返回</Text>
        </Pressable>
        <Text style={settingsStyles.headerTitle}>{initial ? "编辑提示词" : "添加提示词"}</Text>
      </View>
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
