import type {
  AiAdapterKind,
  AiModelConfigPublic,
  AiPromptCacheMode,
  AiProviderConfigPublic,
  AiReasoningLevel,
} from "@novelevolver/domain/settings/ai-settings";
import {
  AI_PROMPT_CACHE_MODE_LABELS,
  AI_PROMPT_CACHE_MODES,
  AI_REASONING_LEVEL_LABELS,
  AI_REASONING_LEVELS,
  DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS,
  isToollessAdapterKind,
  requiresAdapterBaseUrl,
} from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getMobileSettings } from "../../../shared/settings/session";
import { AI_ADAPTER_OPTIONS } from "../ai-adapter-labels";
import { SettingsChoiceField, SettingsSwitchField, SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import { requestSettingsLeave, setSettingsDirty } from "../settings-leave-guard";

type Editor =
  | { type: "closed" }
  | { type: "create-provider" }
  | { type: "edit-provider"; id: string }
  | { type: "create-model"; providerId: string }
  | { type: "edit-model"; id: string };

export function AiModelsPanel() {
  const [tick, setTick] = useState(0);
  const [editor, setEditor] = useState<Editor>({ type: "closed" });
  const [error, setError] = useState<string | null>(null);
  const session = getMobileSettings();
  const snapshot = session.models.getSnapshot();

  const refresh = () => {
    setTick((value) => value + 1);
  };
  void tick;

  const openEditor = async (next: Editor) => {
    if (!(await requestSettingsLeave())) {
      return;
    }
    setError(null);
    setEditor(next);
  };

  if (editor.type !== "closed") {
    return (
      <AiModelsEditor
        editor={editor}
        error={error}
        providers={snapshot.providers}
        models={snapshot.models}
        onBack={() => {
          void openEditor({ type: "closed" });
        }}
        onError={setError}
        onSaved={() => {
          setError(null);
          setEditor({ type: "closed" });
          refresh();
        }}
      />
    );
  }

  return (
    <View style={settingsStyles.detail}>
      <View style={settingsStyles.header}>
        <Text style={settingsStyles.headerTitle}>AI 模型</Text>
        <Pressable
          style={settingsStyles.headerAction}
          onPress={() => {
            void openEditor({ type: "create-provider" });
          }}
        >
          <Text style={settingsStyles.headerActionLabel}>添加供应商</Text>
        </Pressable>
      </View>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ScrollView style={settingsStyles.list}>
        {snapshot.providers.length === 0 ? (
          <Text style={settingsStyles.empty}>还没有供应商。先添加一个 API 供应商。</Text>
        ) : (
          snapshot.providers.map((provider) => {
            const models = snapshot.models.filter((model) => model.providerId === provider.id);
            return (
              <View key={provider.id}>
                <Pressable
                  style={settingsStyles.row}
                  onPress={() => {
                    void openEditor({ type: "edit-provider", id: provider.id });
                  }}
                >
                  <Text style={settingsStyles.rowTitle}>{provider.name}</Text>
                  <Text style={settingsStyles.rowMeta}>
                    {provider.kind}
                    {provider.hasApiKey ? " · 已保存密钥" : " · 无密钥"}
                  </Text>
                </Pressable>
                {models.map((model) => (
                  <Pressable
                    key={model.id}
                    style={[settingsStyles.row, { paddingLeft: 28 }]}
                    onPress={() => {
                      void openEditor({ type: "edit-model", id: model.id });
                    }}
                    onLongPress={() => {
                      try {
                        session.setDefaultModel(
                          snapshot.defaultModelId === model.id ? null : model.id,
                        );
                        refresh();
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : String(caught));
                      }
                    }}
                  >
                    <Text style={settingsStyles.rowTitle}>
                      {model.name}
                      {snapshot.defaultModelId === model.id ? " · 默认" : ""}
                    </Text>
                    <Text style={settingsStyles.rowMeta}>{model.model}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={settingsStyles.row}
                  onPress={() => {
                    void openEditor({ type: "create-model", providerId: provider.id });
                  }}
                >
                  <Text style={settingsStyles.headerActionLabel}>添加模型</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

type AiModelsEditorProps = {
  editor: Exclude<Editor, { type: "closed" }>;
  error: string | null;
  providers: AiProviderConfigPublic[];
  models: AiModelConfigPublic[];
  onBack: () => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
};

function AiModelsEditor({
  editor,
  error,
  providers,
  models,
  onBack,
  onError,
  onSaved,
}: AiModelsEditorProps) {
  const isProvider = editor.type === "create-provider" || editor.type === "edit-provider";
  return (
    <View style={settingsStyles.detail}>
      <View style={settingsStyles.header}>
        <Pressable style={settingsStyles.headerAction} onPress={onBack}>
          <Text style={settingsStyles.headerActionLabel}>返回</Text>
        </Pressable>
        <Text style={settingsStyles.headerTitle}>{editorTitle(editor)}</Text>
      </View>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      {isProvider ? (
        <ProviderForm editor={editor} providers={providers} onError={onError} onSaved={onSaved} />
      ) : (
        <ModelForm
          editor={editor}
          providers={providers}
          models={models}
          onError={onError}
          onSaved={onSaved}
        />
      )}
    </View>
  );
}

function editorTitle(editor: Exclude<Editor, { type: "closed" }>): string {
  switch (editor.type) {
    case "create-provider":
      return "添加供应商";
    case "edit-provider":
      return "编辑供应商";
    case "create-model":
      return "添加模型";
    case "edit-model":
      return "编辑模型";
  }
}

type ProviderFormProps = {
  editor: { type: "create-provider" } | { type: "edit-provider"; id: string };
  providers: AiProviderConfigPublic[];
  onError: (message: string | null) => void;
  onSaved: () => void;
};

function ProviderForm({ editor, providers, onError, onSaved }: ProviderFormProps) {
  const session = getMobileSettings();
  const initial =
    editor.type === "edit-provider" ? providers.find((item) => item.id === editor.id) : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AiAdapterKind>(initial?.kind ?? "responses");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);

  const dirty =
    name !== (initial?.name ?? "") ||
    kind !== (initial?.kind ?? "responses") ||
    baseUrl !== (initial?.baseUrl ?? "") ||
    apiKey !== "" ||
    clearApiKey;

  useEffect(() => {
    setSettingsDirty(dirty);
    return () => {
      setSettingsDirty(false);
    };
  }, [dirty]);

  return (
    <ScrollView contentContainerStyle={settingsStyles.form}>
      <SettingsTextField label="名称" value={name} onChangeText={setName} />
      <SettingsChoiceField
        label="API 形式"
        value={kind}
        options={AI_ADAPTER_OPTIONS}
        onChange={setKind}
      />
      <SettingsTextField
        label="Endpoint"
        hint={
          requiresAdapterBaseUrl(kind)
            ? "delta-completions 必须填写。"
            : "留空则使用适配器默认地址。"
        }
        value={baseUrl}
        onChangeText={setBaseUrl}
        keyboardType="url"
        placeholder="https://"
      />
      <SettingsTextField
        label="API Key"
        hint={initial?.hasApiKey ? "已保存密钥。填写则替换，或勾选清除。" : "明文保存在本机。"}
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        editable={!clearApiKey}
      />
      {initial?.hasApiKey ? (
        <SettingsSwitchField
          label="清除已保存密钥"
          value={clearApiKey}
          onValueChange={setClearApiKey}
        />
      ) : null}
      <Pressable
        style={settingsStyles.optionSelected}
        onPress={() => {
          try {
            session.upsertProvider({
              id: initial?.id,
              name,
              kind,
              baseUrl,
              apiKey: clearApiKey ? "" : apiKey === "" ? undefined : apiKey,
            });
            setSettingsDirty(false);
            onSaved();
          } catch (caught) {
            onError(caught instanceof Error ? caught.message : String(caught));
          }
        }}
      >
        <Text style={settingsStyles.headerActionLabel}>{initial ? "保存" : "添加"}</Text>
      </Pressable>
      {initial ? (
        <Pressable
          onPress={() => {
            try {
              session.removeProvider(initial.id);
              setSettingsDirty(false);
              onSaved();
            } catch (caught) {
              onError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        >
          <Text style={settingsStyles.headerDangerLabel}>删除供应商</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

type ModelFormProps = {
  editor: { type: "create-model"; providerId: string } | { type: "edit-model"; id: string };
  providers: AiProviderConfigPublic[];
  models: AiModelConfigPublic[];
  onError: (message: string | null) => void;
  onSaved: () => void;
};

function ModelForm({ editor, providers, models, onError, onSaved }: ModelFormProps) {
  const session = getMobileSettings();
  const initial =
    editor.type === "edit-model" ? models.find((item) => item.id === editor.id) : null;
  const defaultProviderId =
    editor.type === "create-model" ? editor.providerId : (initial?.providerId ?? "");
  const [providerId, setProviderId] = useState(defaultProviderId);
  const [name, setName] = useState(initial?.name ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    String(initial?.maxOutputTokens ?? DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS),
  );
  const [contextLength, setContextLength] = useState(
    initial?.contextLength != null ? String(initial.contextLength) : "",
  );
  const [availableReasoningLevels, setAvailableReasoningLevels] = useState<AiReasoningLevel[]>(
    initial?.availableReasoningLevels ?? [],
  );
  const [defaultReasoningLevel, setDefaultReasoningLevel] = useState<AiReasoningLevel | null>(
    initial?.defaultReasoningLevel ?? null,
  );
  const [temperature, setTemperature] = useState(
    initial?.temperature != null ? String(initial.temperature) : "",
  );
  const [cacheMode, setCacheMode] = useState<"" | AiPromptCacheMode>(initial?.cache.mode ?? "");
  const [cacheKey, setCacheKey] = useState(initial?.cache.key ?? "");
  const [cacheTtl, setCacheTtl] = useState(initial?.cache.ttl ?? "");
  const [supportsTools, setSupportsTools] = useState(initial?.supportsTools ?? true);

  const provider = providers.find((item) => item.id === providerId);
  const toolless = provider ? isToollessAdapterKind(provider.kind) : false;

  useEffect(() => {
    setSettingsDirty(true);
    return () => {
      setSettingsDirty(false);
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={settingsStyles.form}>
      <SettingsChoiceField
        label="供应商"
        value={providerId}
        options={providers.map((item) => ({ value: item.id, label: item.name }))}
        onChange={setProviderId}
      />
      <SettingsTextField label="显示名称" value={name} onChangeText={setName} />
      <SettingsTextField label="模型 ID" value={model} onChangeText={setModel} />
      <SettingsTextField
        label="最大输出 token"
        value={maxOutputTokens}
        onChangeText={setMaxOutputTokens}
        keyboardType="numeric"
      />
      <SettingsTextField
        label="上下文长度"
        hint="留空表示不配置。"
        value={contextLength}
        onChangeText={setContextLength}
        keyboardType="numeric"
      />
      <SettingsFieldLike label="可用 reasoning">
        <View style={settingsStyles.chipRow}>
          {AI_REASONING_LEVELS.map((level) => {
            const selected = availableReasoningLevels.includes(level);
            return (
              <Pressable
                key={level}
                style={[settingsStyles.chip, selected && settingsStyles.chipSelected]}
                onPress={() => {
                  const next = selected
                    ? availableReasoningLevels.filter((item) => item !== level)
                    : [...availableReasoningLevels, level];
                  setAvailableReasoningLevels(next);
                  if (next.length === 0) {
                    setDefaultReasoningLevel(null);
                  } else if (!defaultReasoningLevel || !next.includes(defaultReasoningLevel)) {
                    setDefaultReasoningLevel(next[0]!);
                  }
                }}
              >
                <Text
                  style={[settingsStyles.chipLabel, selected && settingsStyles.chipLabelSelected]}
                >
                  {AI_REASONING_LEVEL_LABELS[level]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsFieldLike>
      {availableReasoningLevels.length > 0 ? (
        <SettingsChoiceField
          label="默认 reasoning"
          value={defaultReasoningLevel ?? availableReasoningLevels[0]!}
          options={availableReasoningLevels.map((level) => ({
            value: level,
            label: AI_REASONING_LEVEL_LABELS[level],
          }))}
          onChange={setDefaultReasoningLevel}
        />
      ) : null}
      <SettingsTextField
        label="Temperature"
        hint="留空表示不配置。"
        value={temperature}
        onChangeText={setTemperature}
        keyboardType="numeric"
      />
      <SettingsChoiceField
        label="Prompt cache"
        value={cacheMode}
        options={[
          { value: "", label: "未配置" },
          ...AI_PROMPT_CACHE_MODES.map((mode) => ({
            value: mode,
            label: AI_PROMPT_CACHE_MODE_LABELS[mode],
          })),
        ]}
        onChange={setCacheMode}
      />
      <SettingsTextField label="Cache key" value={cacheKey} onChangeText={setCacheKey} />
      <SettingsTextField label="Cache TTL" value={cacheTtl} onChangeText={setCacheTtl} />
      <SettingsSwitchField
        label="支持工具调用"
        value={toolless ? false : supportsTools}
        onValueChange={setSupportsTools}
        disabled={toolless}
        hint={toolless ? "delta-completions 不支持工具。" : undefined}
      />
      <Pressable
        style={settingsStyles.optionSelected}
        onPress={() => {
          try {
            session.upsertModel({
              id: initial?.id,
              providerId,
              name,
              model,
              maxOutputTokens: Number(maxOutputTokens),
              contextLength: contextLength.trim() === "" ? null : Number(contextLength),
              availableReasoningLevels,
              defaultReasoningLevel,
              temperature: temperature.trim() === "" ? null : Number(temperature),
              cache: {
                ...(cacheMode === "" ? {} : { mode: cacheMode }),
                ...(cacheKey.trim() === "" ? {} : { key: cacheKey }),
                ...(cacheTtl.trim() === "" ? {} : { ttl: cacheTtl }),
              },
              supportsTools: toolless ? false : supportsTools,
            });
            setSettingsDirty(false);
            onSaved();
          } catch (caught) {
            onError(caught instanceof Error ? caught.message : String(caught));
          }
        }}
      >
        <Text style={settingsStyles.headerActionLabel}>{initial ? "保存" : "添加"}</Text>
      </Pressable>
      {initial ? (
        <Pressable
          onPress={() => {
            try {
              session.removeModel(initial.id);
              setSettingsDirty(false);
              onSaved();
            } catch (caught) {
              onError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        >
          <Text style={settingsStyles.headerDangerLabel}>删除模型</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function SettingsFieldLike({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={settingsStyles.field}>
      <Text style={settingsStyles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
