import type { AiRuntimePolicySnapshot } from "@novelevolver/domain/settings/ai-settings";
import {
  AI_RUNTIME_POLICY_LIMITS,
  DEFAULT_AI_RUNTIME_POLICY,
} from "@novelevolver/domain/settings/ai-settings";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getMobileSettings } from "../../../shared/settings/session";
import { SettingsTextField } from "../fields";
import { settingsStyles } from "../settings-chrome";
import { setSettingsDirty, useSettingsFormDirty } from "../settings-leave-guard";
import { useSettingsLeaveGuard } from "../use-settings-leave-guard";

const FIELDS: readonly {
  key: keyof AiRuntimePolicySnapshot;
  label: string;
  hint: string;
}[] = [
  {
    key: "maxToolRounds",
    label: "主代理最大工具轮数",
    hint: `默认 ${DEFAULT_AI_RUNTIME_POLICY.maxToolRounds}。`,
  },
  {
    key: "maxSubagentToolRounds",
    label: "子代理最大工具轮数",
    hint: `默认 ${DEFAULT_AI_RUNTIME_POLICY.maxSubagentToolRounds}。`,
  },
  {
    key: "maxParallelReadOnlySubagents",
    label: "只读/纯文本子代理并行度",
    hint: `默认 ${DEFAULT_AI_RUNTIME_POLICY.maxParallelReadOnlySubagents}。`,
  },
  {
    key: "maxParentSummaryChars",
    label: "父摘要最大字数",
    hint: `默认 ${DEFAULT_AI_RUNTIME_POLICY.maxParentSummaryChars}。`,
  },
  {
    key: "maxFocusTargets",
    label: "焦点预载目标数",
    hint: `默认 ${DEFAULT_AI_RUNTIME_POLICY.maxFocusTargets}。`,
  },
  {
    key: "maxFocusContentChars",
    label: "单焦点正文最大字数",
    hint: `默认 ${DEFAULT_AI_RUNTIME_POLICY.maxFocusContentChars}。`,
  },
];

type AiRuntimePolicyPanelProps = {
  onSaved?: () => void;
};

export function AiRuntimePolicyPanel({ onSaved }: AiRuntimePolicyPanelProps) {
  useSettingsLeaveGuard();
  const session = getMobileSettings();
  const [baseline, setBaseline] = useState(() => session.policy.getSnapshot());
  const [form, setForm] = useState<Record<keyof AiRuntimePolicySnapshot, string>>(() =>
    toForm(baseline),
  );
  const [error, setError] = useState<string | null>(null);

  const dirty = FIELDS.some((field) => form[field.key] !== String(baseline[field.key]));
  useSettingsFormDirty(dirty);

  return (
    <View style={settingsStyles.detail}>
      {error ? <Text style={settingsStyles.error}>{error}</Text> : null}
      <ScrollView contentContainerStyle={settingsStyles.form}>
        <Pressable
          style={settingsStyles.headerAction}
          onPress={() => {
            setForm(toForm(DEFAULT_AI_RUNTIME_POLICY));
          }}
        >
          <Text style={settingsStyles.headerActionLabel}>恢复默认</Text>
        </Pressable>
        {FIELDS.map((field) => (
          <SettingsTextField
            key={field.key}
            label={field.label}
            hint={`${field.hint} 范围 ${AI_RUNTIME_POLICY_LIMITS[field.key].min}–${AI_RUNTIME_POLICY_LIMITS[field.key].max}。`}
            value={form[field.key]}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, [field.key]: value }));
            }}
            keyboardType="numeric"
          />
        ))}
        <Pressable
          style={settingsStyles.optionSelected}
          onPress={() => {
            try {
              session.setPolicy({
                maxToolRounds: Number(form.maxToolRounds),
                maxSubagentToolRounds: Number(form.maxSubagentToolRounds),
                maxParallelReadOnlySubagents: Number(form.maxParallelReadOnlySubagents),
                maxParentSummaryChars: Number(form.maxParentSummaryChars),
                maxFocusTargets: Number(form.maxFocusTargets),
                maxFocusContentChars: Number(form.maxFocusContentChars),
              });
              const next = session.policy.getSnapshot();
              setBaseline(next);
              setForm(toForm(next));
              setSettingsDirty(false);
              setError(null);
              onSaved?.();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        >
          <Text style={settingsStyles.headerActionLabel}>保存</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function toForm(policy: AiRuntimePolicySnapshot): Record<keyof AiRuntimePolicySnapshot, string> {
  return {
    maxToolRounds: String(policy.maxToolRounds),
    maxSubagentToolRounds: String(policy.maxSubagentToolRounds),
    maxParallelReadOnlySubagents: String(policy.maxParallelReadOnlySubagents),
    maxParentSummaryChars: String(policy.maxParentSummaryChars),
    maxFocusTargets: String(policy.maxFocusTargets),
    maxFocusContentChars: String(policy.maxFocusContentChars),
  };
}
