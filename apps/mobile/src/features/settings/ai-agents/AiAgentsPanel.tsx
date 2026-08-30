import { AI_AGENT_DESCRIPTION_MAX_LENGTH } from "@novelevolver/domain/settings/ai-settings";
import type { AiAgentConfigPublic } from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getMobileSettings } from "../../../shared/settings/session";
import { SettingsSwitchField, SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import { requestSettingsLeave, setSettingsDirty } from "../settings-leave-guard";

type Editor = { type: "closed" } | { type: "create" } | { type: "edit"; id: string };

export function AiAgentsPanel() {
  const [tick, setTick] = useState(0);
  const [editor, setEditor] = useState<Editor>({ type: "closed" });
  const [error, setError] = useState<string | null>(null);
  const session = getMobileSettings();
  const snapshot = session.agents.getSnapshot();
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
      editor.type === "edit" ? snapshot.agents.find((agent) => agent.id === editor.id) : null;
    return (
      <AgentForm
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
        <Text style={settingsStyles.headerTitle}>AI Agent</Text>
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
        {snapshot.agents.map((agent) => (
          <Pressable
            key={agent.id}
            style={settingsStyles.row}
            onPress={() => {
              void openEditor({ type: "edit", id: agent.id });
            }}
          >
            <Text style={settingsStyles.rowTitle}>{agent.name}</Text>
            <Text style={settingsStyles.rowMeta}>
              {agent.builtin ? "内置" : "自定义"}
              {agent.textOnlyMode ? " · 纯文本" : ` · ${agent.availableToolNames.length} 个工具`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

type AgentFormProps = {
  initial: AiAgentConfigPublic | null;
  error: string | null;
  onBack: () => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
};

function AgentForm({ initial, error, onBack, onError, onSaved }: AgentFormProps) {
  const session = getMobileSettings();
  const models = session.models.getSnapshot();
  const tools = session.agents.getSnapshot().tools;
  const builtin = initial?.builtin ?? false;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [defaultModelId, setDefaultModelId] = useState(initial?.defaultModelId ?? "");
  const [availableToolNames, setAvailableToolNames] = useState(initial?.availableToolNames ?? []);
  const [userSelectable, setUserSelectable] = useState(initial?.userSelectable ?? true);
  const [subagentEligible, setSubagentEligible] = useState(initial?.subagentEligible ?? false);
  const [textOnlyMode, setTextOnlyMode] = useState(initial?.textOnlyMode ?? false);

  useEffect(() => {
    setSettingsDirty(true);
    return () => {
      setSettingsDirty(false);
    };
  }, []);

  const modelOptions = [
    { value: "", label: "继承默认模型" },
    ...models.models.map((model) => ({ value: model.id, label: model.name })),
  ];

  return (
    <View style={settingsStyles.detail}>
      <View style={settingsStyles.header}>
        <Pressable style={settingsStyles.headerAction} onPress={onBack}>
          <Text style={settingsStyles.headerActionLabel}>返回</Text>
        </Pressable>
        <Text style={settingsStyles.headerTitle}>{initial ? initial.name : "添加 Agent"}</Text>
      </View>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ScrollView contentContainerStyle={settingsStyles.form}>
        <SettingsTextField label="名称" value={name} onChangeText={setName} editable={!builtin} />
        <SettingsTextField
          label="简介"
          hint={`最多 ${AI_AGENT_DESCRIPTION_MAX_LENGTH} 字。`}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <SettingsTextField
          label="系统提示词"
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          multiline
        />
        <View style={settingsStyles.field}>
          <Text style={settingsStyles.fieldLabel}>默认模型</Text>
          <View style={settingsStyles.chipRow}>
            {modelOptions.map((option) => {
              const selected = defaultModelId === option.value;
              return (
                <Pressable
                  key={option.value || "inherit"}
                  style={[settingsStyles.chip, selected && settingsStyles.chipSelected]}
                  onPress={() => {
                    setDefaultModelId(option.value);
                  }}
                >
                  <Text
                    style={[settingsStyles.chipLabel, selected && settingsStyles.chipLabelSelected]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {!builtin ? (
          <View style={settingsStyles.field}>
            <Text style={settingsStyles.fieldLabel}>工具</Text>
            {tools.map((tool) => {
              const selected = availableToolNames.includes(tool.name);
              return (
                <Pressable
                  key={tool.name}
                  style={[settingsStyles.option, selected && settingsStyles.optionSelected]}
                  onPress={() => {
                    setAvailableToolNames(
                      selected
                        ? availableToolNames.filter((name) => name !== tool.name)
                        : [...availableToolNames, tool.name],
                    );
                  }}
                >
                  <Text style={settingsStyles.optionLabel}>{tool.name}</Text>
                  <Text style={settingsStyles.rowMeta} numberOfLines={2}>
                    {tool.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <SettingsSwitchField
          label="出现在对话选择器"
          value={userSelectable}
          onValueChange={setUserSelectable}
        />
        <SettingsSwitchField
          label="可作为子代理"
          value={subagentEligible}
          onValueChange={(value) => {
            setSubagentEligible(value);
            if (!value) {
              setTextOnlyMode(false);
            }
          }}
        />
        <SettingsSwitchField
          label="纯文本子代理"
          value={textOnlyMode}
          onValueChange={setTextOnlyMode}
          disabled={!subagentEligible}
        />
        <Pressable
          style={settingsStyles.optionSelected}
          onPress={() => {
            try {
              session.upsertAgent({
                id: initial?.id,
                name,
                description,
                systemPrompt,
                defaultModelId: defaultModelId === "" ? null : defaultModelId,
                availableToolNames,
                userSelectable,
                subagentEligible,
                textOnlyMode,
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
        {initial && !initial.builtin ? (
          <Pressable
            onPress={() => {
              try {
                session.removeAgent(initial.id);
                setSettingsDirty(false);
                onSaved();
              } catch (caught) {
                onError(caught instanceof Error ? caught.message : String(caught));
              }
            }}
          >
            <Text style={settingsStyles.headerDangerLabel}>删除 Agent</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
