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
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getMobileSettings } from "../../../shared/settings/session";
import { AI_ADAPTER_OPTIONS } from "../ai-adapter-labels";
import { SettingsChoiceField, SettingsSwitchField, SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import type { SettingsDetailActionChange } from "../settings-detail-actions";
import { useSettingsDetailActions } from "../settings-detail-actions";
import { setSettingsDirty, useSettingsFormDirty } from "../settings-leave-guard";
import { useSettingsLeaveGuard } from "../use-settings-leave-guard";

type AiModelsListProps = {
  selectedProviderId?: string;
  selectedModelId?: string;
  onOpen: (
    target:
      | { type: "provider"; id: string }
      | { type: "model"; id: string }
      | { type: "new-model"; providerId: string },
  ) => void;
};

export function AiModelsList({ selectedProviderId, selectedModelId, onOpen }: AiModelsListProps) {
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const session = getMobileSettings();
  const snapshot = session.models.getSnapshot();
  void tick;

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  return (
    <View style={settingsStyles.detail}>
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
                  style={[
                    settingsStyles.row,
                    selectedProviderId === provider.id && settingsStyles.rowSelected,
                  ]}
                  onPress={() => {
                    onOpen({ type: "provider", id: provider.id });
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
                    style={[
                      settingsStyles.row,
                      { paddingLeft: 28 },
                      selectedModelId === model.id && settingsStyles.rowSelected,
                    ]}
                    onPress={() => {
                      onOpen({ type: "model", id: model.id });
                    }}
                    onLongPress={() => {
                      try {
                        session.setDefaultModel(
                          snapshot.defaultModelId === model.id ? null : model.id,
                        );
                        setTick((value) => value + 1);
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : String(caught));
                      }
                    }}
                  >
                    <Text style={settingsStyles.rowTitle}>
                      {model.name}
                      {snapshot.defaultModelId === model.id ? " · 默认" : ""}
                    </Text>
                    <Text style={settingsStyles.technical}>{model.model}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={settingsStyles.row}
                  onPress={() => {
                    onOpen({ type: "new-model", providerId: provider.id });
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

type ProviderEditorProps = {
  id?: string;
  onSaved: () => void;
  onActionsChange: SettingsDetailActionChange;
};

export function ProviderEditor({ id, onSaved, onActionsChange }: ProviderEditorProps) {
  useSettingsLeaveGuard({ editor: true });
  const [error, setError] = useState<string | null>(null);
  const snapshot = getMobileSettings().models.getSnapshot();
  const editor =
    id == null ? ({ type: "create-provider" } as const) : ({ type: "edit-provider", id } as const);

  return (
    <View style={settingsStyles.detail}>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ProviderForm
        editor={editor}
        providers={snapshot.providers}
        onError={setError}
        onSaved={() => {
          onSaved();
        }}
        onActionsChange={onActionsChange}
      />
    </View>
  );
}

type ModelEditorProps = {
  id?: string;
  providerId?: string;
  onSaved: () => void;
  onActionsChange: SettingsDetailActionChange;
};

export function ModelEditor({ id, providerId, onSaved, onActionsChange }: ModelEditorProps) {
  useSettingsLeaveGuard({ editor: true });
  const [error, setError] = useState<string | null>(null);
  const snapshot = getMobileSettings().models.getSnapshot();
  const editor =
    id == null
      ? ({ type: "create-model", providerId: providerId ?? "" } as const)
      : ({ type: "edit-model", id } as const);

  return (
    <View style={settingsStyles.detail}>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ModelForm
        editor={editor}
        providers={snapshot.providers}
        models={snapshot.models}
        onError={setError}
        onSaved={() => {
          onSaved();
        }}
        onActionsChange={onActionsChange}
      />
    </View>
  );
}

type ProviderFormProps = {
  editor: { type: "create-provider" } | { type: "edit-provider"; id: string };
  providers: AiProviderConfigPublic[];
  onError: (message: string | null) => void;
  onSaved: () => void;
  onActionsChange: SettingsDetailActionChange;
};

function ProviderForm({ editor, providers, onError, onSaved, onActionsChange }: ProviderFormProps) {
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

  useSettingsFormDirty(dirty);

  const save = () => {
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
  };
  const remove = initial
    ? () => {
        try {
          session.removeProvider(initial.id);
          setSettingsDirty(false);
          onSaved();
        } catch (caught) {
          onError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    : undefined;
  useSettingsDetailActions(onActionsChange, { save, remove });

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
        monospace
        keyboardType="url"
        placeholder="https://"
      />
      <SettingsTextField
        label="API Key"
        hint={initial?.hasApiKey ? "已保存密钥。填写则替换，或勾选清除。" : "明文保存在本机。"}
        value={apiKey}
        onChangeText={setApiKey}
        monospace
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
    </ScrollView>
  );
}

type ModelFormProps = {
  editor: { type: "create-model"; providerId: string } | { type: "edit-model"; id: string };
  providers: AiProviderConfigPublic[];
  models: AiModelConfigPublic[];
  onError: (message: string | null) => void;
  onSaved: () => void;
  onActionsChange: SettingsDetailActionChange;
};

function ModelForm({
  editor,
  providers,
  models,
  onError,
  onSaved,
  onActionsChange,
}: ModelFormProps) {
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
  const baselineLevels = initial?.availableReasoningLevels ?? [];
  const dirty =
    providerId !== defaultProviderId ||
    name !== (initial?.name ?? "") ||
    model !== (initial?.model ?? "") ||
    maxOutputTokens !== String(initial?.maxOutputTokens ?? DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS) ||
    contextLength !== (initial?.contextLength != null ? String(initial.contextLength) : "") ||
    availableReasoningLevels.length !== baselineLevels.length ||
    availableReasoningLevels.some((level) => !baselineLevels.includes(level)) ||
    defaultReasoningLevel !== (initial?.defaultReasoningLevel ?? null) ||
    temperature !== (initial?.temperature != null ? String(initial.temperature) : "") ||
    cacheMode !== (initial?.cache.mode ?? "") ||
    cacheKey !== (initial?.cache.key ?? "") ||
    cacheTtl !== (initial?.cache.ttl ?? "") ||
    supportsTools !== (initial?.supportsTools ?? true);

  useSettingsFormDirty(dirty);

  const save = () => {
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
  };
  const remove = initial
    ? () => {
        try {
          session.removeModel(initial.id);
          setSettingsDirty(false);
          onSaved();
        } catch (caught) {
          onError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    : undefined;
  useSettingsDetailActions(onActionsChange, { save, remove });

  return (
    <ScrollView contentContainerStyle={settingsStyles.form}>
      <SettingsChoiceField
        label="供应商"
        value={providerId}
        options={providers.map((item) => ({ value: item.id, label: item.name }))}
        onChange={setProviderId}
      />
      <SettingsTextField label="显示名称" value={name} onChangeText={setName} />
      <SettingsTextField label="模型 ID" value={model} onChangeText={setModel} monospace />
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
      <SettingsTextField label="Cache key" value={cacheKey} onChangeText={setCacheKey} monospace />
      <SettingsTextField label="Cache TTL" value={cacheTtl} onChangeText={setCacheTtl} />
      <SettingsSwitchField
        label="支持工具调用"
        value={toolless ? false : supportsTools}
        onValueChange={setSupportsTools}
        disabled={toolless}
        hint={toolless ? "delta-completions 不支持工具。" : undefined}
      />
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
